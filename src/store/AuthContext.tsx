import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import {
  clearSession,
  loadSession,
  loginAdmin,
  logoutAdmin,
  saveSession,
} from '../services/auth'
import type { AdminRole, AdminUser, AuthSession, AuthStatus } from '../types/auth'

/* ==========================================================================
   TYPES
   ========================================================================== */

type AuthContextValue = {
  status: AuthStatus
  user: AdminUser | null
  session: AuthSession | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (roles: AdminRole[]) => boolean
  hasMinRole: (minRole: AdminRole) => boolean
  isSessionExpired: () => boolean
  refreshSession: () => Promise<void>
  // diagnostics
  lastError: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/* ==========================================================================
   ROLE HIERARCHY
   ========================================================================== */

// Lower index = more privileged. If your backend uses different role names,
// adjust the array — everything downstream reads from this order.
const ROLE_ORDER: AdminRole[] = [
  'super_admin' as AdminRole,
  'admin' as AdminRole,
  'manager' as AdminRole,
  'support' as AdminRole,
  'viewer' as AdminRole,
].filter((r) => r)

function roleRank(role: AdminRole): number {
  const idx = ROLE_ORDER.indexOf(role)
  return idx === -1 ? ROLE_ORDER.length : idx
}

/* ==========================================================================
   SESSION HELPERS
   ========================================================================== */

const SESSION_KEY = 'harkeyzride.admin.session.v1'

function tokenExpiresAt(session: AuthSession | null): number | null {
  if (!session) return null
  const tokens = (session as unknown as { tokens?: { expiresAt?: number } })
    .tokens
  return tokens?.expiresAt ?? null
}

function isSessionExpired(session: AuthSession | null, skewMs = 30_000): boolean {
  const exp = tokenExpiresAt(session)
  if (!exp) return false
  return Date.now() >= exp - skewMs
}

/* ==========================================================================
   PROVIDER
   ========================================================================== */

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [session, setSession] = useState<AuthSession | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  const expiryTimerRef = useRef<number | null>(null)

  /* ---------------------------- bootstrap ---------------------------- */

  useEffect(() => {
    const stored = loadSession()
    if (stored && isSessionExpired(stored)) {
      // Expired on boot — try to log out cleanly
      void logoutAdmin().catch(() => {})
      clearSession()
      setSession(null)
      setStatus('unauthenticated')
      return
    }
    setSession(stored)
    setStatus(stored ? 'authenticated' : 'unauthenticated')
  }, [])

  /* ---------------------------- auto sign-out ---------------------------- */

  useEffect(() => {
    if (expiryTimerRef.current) {
      window.clearTimeout(expiryTimerRef.current)
      expiryTimerRef.current = null
    }

    if (!session) return
    const exp = tokenExpiresAt(session)
    if (!exp) return

    const msLeft = exp - Date.now()
    if (msLeft <= 0) {
      // Already expired
      clearSession()
      setSession(null)
      setStatus('unauthenticated')
      return
    }

    // Auto sign-out 30s before expiry so the UI can react
    const timeout = Math.max(0, msLeft - 30_000)
    expiryTimerRef.current = window.setTimeout(() => {
      clearSession()
      setSession(null)
      setStatus('unauthenticated')
    }, timeout)

    return () => {
      if (expiryTimerRef.current) {
        window.clearTimeout(expiryTimerRef.current)
        expiryTimerRef.current = null
      }
    }
  }, [session])

  /* ---------------------------- cross-tab sync ---------------------------- */

  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key !== SESSION_KEY) return
      const stored = loadSession()
      setSession(stored)
      setStatus(stored ? 'authenticated' : 'unauthenticated')
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  /* ---------------------------- sign in ---------------------------- */

  const signIn = useCallback(async (email: string, password: string) => {
    setLastError(null)
    try {
      const next = await loginAdmin(email, password)
      saveSession(next)
      setSession(next)
      setStatus('authenticated')
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Login failed. Please try again.'
      setLastError(message)
      // Keep session null, status unauthenticated — but propagate so the
      // login page can show the exact error returned by the backend.
      setStatus('unauthenticated')
      throw err
    }
  }, [])

  /* ---------------------------- sign out ---------------------------- */

  const signOut = useCallback(async () => {
    try {
      await logoutAdmin()
    } catch {
      // ignore — local sign out always proceeds
    }
    clearSession()
    setSession(null)
    setStatus('unauthenticated')
    setLastError(null)
  }, [])

  /* ---------------------------- refresh ---------------------------- */

  const refreshSession = useCallback(async () => {
    if (!session) return
    try {
      const fresh = await loginAdmin(
        session.user.email,
        // can't refresh without password on most backends — this is a no-op
        // unless your service exposes a refresh endpoint. Left here as an
        // extension point.
        '',
      )
      saveSession(fresh)
      setSession(fresh)
    } catch {
      // silent — session remains valid until natural expiry
    }
  }, [session])

  /* ---------------------------- role checks ---------------------------- */

  const hasRole = useCallback(
    (roles: AdminRole[]) => {
      if (!session) return false
      return roles.includes(session.user.role)
    },
    [session],
  )

  const hasMinRole = useCallback(
    (minRole: AdminRole) => {
      if (!session) return false
      return roleRank(session.user.role) <= roleRank(minRole)
    },
    [session],
  )

  const isSessionExpiredFn = useCallback(() => {
    return isSessionExpired(session)
  }, [session])

  const clearError = useCallback(() => setLastError(null), [])

  /* ---------------------------- value ---------------------------- */

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      signIn,
      signOut,
      hasRole,
      hasMinRole,
      isSessionExpired: isSessionExpiredFn,
      refreshSession,
      lastError,
      clearError,
    }),
    [
      status,
      session,
      signIn,
      signOut,
      hasRole,
      hasMinRole,
      isSessionExpiredFn,
      refreshSession,
      lastError,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/* ==========================================================================
   HOOK
   ========================================================================== */

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}