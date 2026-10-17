import { env } from '../config/env'

/* ==========================================================================
   TYPES
   ========================================================================== */

export type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T | null
  error: { code?: string; details?: unknown } | null
}

export class ApiError extends Error {
  status: number
  code?: string
  details?: unknown
  endpoint: string
  method: string

  constructor(params: {
    status: number
    message: string
    code?: string
    details?: unknown
    endpoint?: string
    method?: string
  }) {
    super(params.message)
    this.name = 'ApiError'
    this.status = params.status
    this.code = params.code
    this.details = params.details
    this.endpoint = params.endpoint ?? ''
    this.method = params.method ?? ''
  }
}

/* ==========================================================================
   DEBUG FLAG — self-contained, does not require env.debug to exist
   ========================================================================== */

const DEBUG: boolean = (() => {
  try {
    const e = env as unknown as { debug?: unknown }
    if (typeof e.debug === 'boolean') return e.debug
  } catch {
    /* ignore */
  }
  try {
    const meta = import.meta as unknown as {
      env?: { DEV?: boolean; VITE_DEBUG?: string }
    }
    return meta.env?.DEV === true || meta.env?.VITE_DEBUG === 'true'
  } catch {
    return false
  }
})()

/* ==========================================================================
   SESSION / TOKEN ACCESS
   ========================================================================== */

const SESSION_KEY = 'harkeyzride.admin.session.v1'

type StoredSessionShape = {
  tokens?: {
    accessToken?: string
    refreshToken?: string
    expiresAt?: number
  }
  user?: unknown
}

function readStoredSession(): StoredSessionShape | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSessionShape
  } catch {
    return null
  }
}

function readAccessToken(): string | null {
  const parsed = readStoredSession()
  return parsed?.tokens?.accessToken ?? null
}

function readRefreshToken(): string | null {
  const parsed = readStoredSession()
  return parsed?.tokens?.refreshToken ?? null
}

function readExpiresAt(): number | null {
  const parsed = readStoredSession()
  return parsed?.tokens?.expiresAt ?? null
}

function isTokenExpired(skewMs = 30_000): boolean {
  const expires = readExpiresAt()
  if (!expires) return false
  return Date.now() >= expires - skewMs
}

function handleUnauthorized() {
  try {
    localStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined') {
    const next = encodeURIComponent(window.location.pathname)
    window.location.href = `/login?from=${next}`
  }
}

/* ==========================================================================
   REFRESH HANDLING — single-flight to prevent storms
   ========================================================================== */

let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise

  const refreshToken = readRefreshToken()
  if (!refreshToken) return null

  refreshPromise = (async () => {
    try {
      const url = buildUrl('/auth/refresh')
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (!res.ok) return null

      const text = await res.text()
      if (!text) return null

      const payload = JSON.parse(text) as ApiEnvelope<{
        accessToken?: string
        refreshToken?: string
        expiresAt?: number
      }>

      if (!payload.success || !payload.data?.accessToken) return null

      const stored = readStoredSession() ?? {}
      const next: StoredSessionShape = {
        ...stored,
        tokens: {
          ...stored.tokens,
          accessToken: payload.data.accessToken,
          refreshToken: payload.data.refreshToken ?? stored.tokens?.refreshToken,
          expiresAt: payload.data.expiresAt,
        },
      }
      try {
        localStorage.setItem(SESSION_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }

      return payload.data.accessToken
    } catch {
      return null
    } finally {
      refreshPromise = null
    }
  })()

  return refreshPromise
}

/* ==========================================================================
   LOGGING
   ========================================================================== */

function logRequest(method: string, url: string, body?: unknown, auth?: boolean) {
  if (!DEBUG) return
  // eslint-disable-next-line no-console
  console.groupCollapsed(`[api] ${method} ${url}`)
  if (auth) {
    const token = readAccessToken()
    // eslint-disable-next-line no-console
    console.log('auth:', token ? `Bearer ${token.slice(0, 12)}…` : 'none')
  }
  if (body !== undefined) {
    try {
      const copy = JSON.parse(JSON.stringify(body))
      if (copy && typeof copy === 'object' && 'password' in copy) {
        copy.password = '***'
      }
      // eslint-disable-next-line no-console
      console.log('payload:', copy)
    } catch {
      // eslint-disable-next-line no-console
      console.log('payload:', body)
    }
  }
  // eslint-disable-next-line no-console
  console.groupEnd()
}

function logResponse(method: string, url: string, status: number, body: unknown) {
  if (!DEBUG) return
  // eslint-disable-next-line no-console
  console.groupCollapsed(
    `[api] ${method} ${url} → ${status} ${status < 400 ? '✓' : '✗'}`,
  )
  // eslint-disable-next-line no-console
  console.log('response:', body)
  // eslint-disable-next-line no-console
  console.groupEnd()
}

/* ==========================================================================
   URL BUILDER
   ========================================================================== */

function buildUrl(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  const base = env.apiBaseUrl.replace(/\/$/, '')
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  let full = `${base}${cleanPath}`

  if (query) {
    const params = new URLSearchParams()
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined) params.set(k, String(v))
    })
    const qs = params.toString()
    if (qs) full += `?${qs}`
  }

  return full
}

/* ==========================================================================
   REQUEST OPTIONS
   ========================================================================== */

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  query?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
  timeoutMs?: number
  skipRefresh?: boolean
}

const DEFAULT_TIMEOUT_MS = 20_000

/* ==========================================================================
   CORE REQUEST
   ========================================================================== */

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    method = 'GET',
    body,
    auth = true,
    query,
    signal: externalSignal,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    skipRefresh = false,
  } = options

  const url = buildUrl(path, query)
  const isLoginEndpoint = path === '/auth/login' || path.endsWith('/auth/login')
  const isRefreshEndpoint = path === '/auth/refresh' || path.endsWith('/auth/refresh')

  const headers: Record<string, string> = { Accept: 'application/json' }

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json'
  }

  if (auth) {
    if (!isRefreshEndpoint && isTokenExpired()) {
      const fresh = await refreshAccessToken()
      if (fresh) headers.Authorization = `Bearer ${fresh}`
    } else {
      const token = readAccessToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }
  }

  logRequest(method, url, body, auth)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort()
    else
      externalSignal.addEventListener('abort', () => controller.abort(), {
        once: true,
      })
  }

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers,
      body:
        body !== undefined
          ? isFormData
            ? (body as FormData)
            : JSON.stringify(body)
          : undefined,
      signal: controller.signal,
      credentials: 'include',
    })
  } catch (err) {
    clearTimeout(timeoutId)
    if ((err as Error).name === 'AbortError') {
      throw new ApiError({
        status: 0,
        message: 'Request timed out. Please check your connection.',
        code: 'TIMEOUT',
        endpoint: path,
        method,
      })
    }
    throw new ApiError({
      status: 0,
      message:
        err instanceof Error
          ? `Network error: ${err.message}`
          : 'Network error',
      code: 'NETWORK_ERROR',
      endpoint: path,
      method,
    })
  }
  clearTimeout(timeoutId)

  if (response.status === 401) {
    if (!isLoginEndpoint && !isRefreshEndpoint && !skipRefresh && auth) {
      const fresh = await refreshAccessToken()
      if (fresh) {
        return apiRequest<T>(path, {
          ...options,
          auth: true,
          skipRefresh: true,
        })
      }
    }

    if (!isLoginEndpoint && !isRefreshEndpoint) {
      handleUnauthorized()
    }
  }

  let payload: ApiEnvelope<T> | null = null
  let rawText = ''
  try {
    rawText = await response.text()
    if (rawText) {
      try {
        payload = JSON.parse(rawText) as ApiEnvelope<T>
      } catch {
        logResponse(method, url, response.status, rawText.slice(0, 200))
        throw new ApiError({
          status: response.status,
          message:
            response.status === 401
              ? 'Login failed. Please check your credentials.'
              : rawText.slice(0, 200) || 'Unexpected server response',
          code: 'INVALID_JSON',
          endpoint: path,
          method,
        })
      }
    }
  } catch (err) {
    if (err instanceof ApiError) throw err
    throw new ApiError({
      status: response.status,
      message: 'Failed to read server response',
      code: 'READ_ERROR',
      endpoint: path,
      method,
    })
  }

  logResponse(method, url, response.status, payload ?? rawText.slice(0, 200))

  if (response.status === 403) {
    throw new ApiError({
      status: 403,
      message:
        payload?.message ??
        'You do not have permission to perform this action.',
      code: payload?.error?.code ?? 'FORBIDDEN',
      details: payload?.error?.details,
      endpoint: path,
      method,
    })
  }

  if (response.status === 401) {
    throw new ApiError({
      status: 401,
      message:
        payload?.message ??
        (isLoginEndpoint
          ? 'Invalid email or password.'
          : 'Session expired. Please sign in again.'),
      code: payload?.error?.code ?? 'UNAUTHORIZED',
      details: payload?.error?.details,
      endpoint: path,
      method,
    })
  }

  if (!response.ok || !payload?.success) {
    throw new ApiError({
      status: response.status,
      message:
        payload?.message ??
        `Request failed (${response.status} ${response.statusText || ''})`.trim(),
      code: payload?.error?.code ?? 'REQUEST_FAILED',
      details: payload?.error?.details,
      endpoint: path,
      method,
    })
  }

  return payload.data as T
}

/* ==========================================================================
   CONVENIENCE HELPERS
   ========================================================================== */

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),

  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => apiRequest<T>(path, { ...options, method: 'POST', body }),

  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => apiRequest<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, 'method' | 'body'>,
  ) => apiRequest<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),

  upload: <T>(path: string, formData: FormData) =>
    apiRequest<T>(path, { method: 'POST', body: formData }),
}

/* ==========================================================================
   DIAGNOSTIC HELPERS
   ========================================================================== */

export function apiClientDiagnostics(): {
  baseUrl: string
  hasSession: boolean
  hasAccessToken: boolean
  hasRefreshToken: boolean
  tokenExpiresIn: string
  tokenExpired: boolean
  useMockApi: boolean
  debug: boolean
} {
  const session = readStoredSession()
  const expires = readExpiresAt()
  const msLeft = expires ? expires - Date.now() : null
  return {
    baseUrl: env.apiBaseUrl,
    hasSession: !!session,
    hasAccessToken: !!readAccessToken(),
    hasRefreshToken: !!readRefreshToken(),
    tokenExpiresIn:
      msLeft === null
        ? 'no expiry set'
        : msLeft > 0
          ? `${Math.floor(msLeft / 1000)}s`
          : `${Math.floor(-msLeft / 1000)}s ago (EXPIRED)`,
    tokenExpired: isTokenExpired(),
    useMockApi: env.useMockApi,
    debug: DEBUG,
  }
}

export async function pingBackend(): Promise<{
  reachable: boolean
  status: number
  cors: boolean
  message: string
}> {
  const url = buildUrl('/auth/login')
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'ping@x.x', password: 'ping' }),
      credentials: 'include',
    })
    return {
      reachable: true,
      status: res.status,
      cors: true,
      message: `Backend responded ${res.status}. If 401, it's a credentials issue (not CORS).`,
    }
  } catch (err) {
    return {
      reachable: false,
      status: 0,
      cors: false,
      message:
        err instanceof Error
          ? err.message
          : 'Network error — probably CORS or wrong URL',
    }
  }
}