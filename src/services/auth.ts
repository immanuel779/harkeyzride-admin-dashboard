import { DEMO_CREDENTIALS } from '../config/brand'
import { env } from '../config/env'
import { api } from '../lib/apiClient'
import type { AuthSession } from '../types/auth'

// Reads from VITE_USE_MOCK_API in .env.local
// true  → use mock (admin@harkeyzride.dev / HarkeyzRide2026!)
// false → hit real backend /api/v1/auth/login
const USE_MOCK_API = env.useMockApi

const SESSION_KEY = 'harkeyzride.admin.session.v1'

const MOCK_EMAIL = DEMO_CREDENTIALS.email
const MOCK_PASSWORD = DEMO_CREDENTIALS.password

// ---------- Backend response shape ----------

type BackendUser = {
  id: string
  name: string
  email: string
  phone: string
  role: string
  status: string
}

type BackendAuthResponse = {
  accessToken: string
  user: BackendUser
}

// ---------- Login ----------

export async function loginAdmin(
  email: string,
  password: string,
): Promise<AuthSession> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 700))

    if (
      email.trim().toLowerCase() !== MOCK_EMAIL ||
      password !== MOCK_PASSWORD
    ) {
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

  // Real backend call
  const res = await api.post<BackendAuthResponse>(
    '/auth/login',
    {
      email: email.trim().toLowerCase(),
      password,
    },
    { auth: false },
  )

  // Backend returns a single "name" field. Split into firstName + lastName
  // for our existing UI.
  const parts = (res.user.name ?? '').trim().split(/\s+/)
  const firstName = parts[0] || 'Admin'
  const lastName = parts.slice(1).join(' ') || ''

  return {
    user: {
      id: res.user.id,
      email: res.user.email,
      firstName,
      lastName,
      role: 'admin',
      avatarUrl: null,
    },
    tokens: {
      accessToken: res.accessToken,
      refreshToken: '',
    },
  }
}

// ---------- Logout ----------

export async function logoutAdmin(): Promise<void> {
  if (USE_MOCK_API) {
    await new Promise((r) => setTimeout(r, 200))
    return
  }
  try {
    await api.post('/auth/logout')
  } catch {
    // ignore — client clears session anyway
  }
}

// ---------- Local session persistence ----------

export function saveSession(session: AuthSession): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // ignore
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