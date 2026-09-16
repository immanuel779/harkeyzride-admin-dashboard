export type AdminRole = 'admin' | 'ops' | 'finance' | 'support' | 'auditor'

export type AdminUser = {
  id: string
  email: string
  firstName: string
  lastName: string
  role: AdminRole
  avatarUrl: string | null
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export type AuthSession = {
  user: AdminUser
  tokens: AuthTokens
}

export type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated'