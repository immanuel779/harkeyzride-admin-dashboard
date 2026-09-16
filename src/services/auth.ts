import type { AuthSession } from '../types/auth'

const SESSION_KEY = 'switchride.admin.session.v1'
const USE_MOCK_API = true

// Mock admin credentials — REPLACE with real backend auth in Phase 8
const MOCK_EMAIL = 'admin@switchride.dev'
const MOCK_PASSWORD = 'SwitchRide2026!'

// 🟡 BACKEND REQUIRED — Oladayo's endpoints
// POST /admin/auth/login     { email, password } → AuthSession
// POST /admin/auth/logout
// GET  /admin/auth/me        → AdminUser

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AuthSession> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 700))
    if (email.trim().toLowerCase() !== MOCK_EMAIL || password !== MOCK_PASSWORD) {
      throw new Error('Invalid email or password')
    }
    return {
      user: {
        id: 'admin_001',
        email: MOCK_EMAIL,
        firstName: 'Damilare',
        lastName: 'Opeyemi',
        role: 'admin',
        avatarUrl: null,
      },
      tokens: {
        accessToken: `mock_access_${Date.now()}`,
        refreshToken: `mock_refresh_${Date.now()}`,
      },
    }
  }
  // Real API call:
  // return apiRequest<AuthSession>('/api/admin/auth/login', {
  //   method: 'POST',
  //   body: { email, password },
  // })
  throw new Error('Real backend not wired yet')
}

export async function logoutAdmin(): Promise<void> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200))
    return
  }
  // await apiRequest('/api/admin/auth/logout', { method: 'POST' })
}

// ---------- Local session persistence ----------

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // localStorage may be blocked in some contexts — fail silently
  }
}

export function loadSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // ignore
  }
}