import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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

type AuthContextValue = {
  status: AuthStatus
  user: AdminUser | null
  session: AuthSession | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  hasRole: (roles: AdminRole[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('booting')
  const [session, setSession] = useState<AuthSession | null>(null)

  useEffect(() => {
    const stored = loadSession()
    setSession(stored)
    setStatus(stored ? 'authenticated' : 'unauthenticated')
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const next = await loginAdmin(email, password)
    saveSession(next)
    setSession(next)
    setStatus('authenticated')
  }, [])

  const signOut = useCallback(async () => {
    try {
      await logoutAdmin()
    } catch {
      // ignore — local sign out always proceeds
    }
    clearSession()
    setSession(null)
    setStatus('unauthenticated')
  }, [])

  const hasRole = useCallback(
    (roles: AdminRole[]) => {
      if (!session) return false
      return roles.includes(session.user.role)
    },
    [session],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user: session?.user ?? null,
      session,
      signIn,
      signOut,
      hasRole,
    }),
    [status, session, signIn, signOut, hasRole],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside <AuthProvider>')
  }
  return ctx
}