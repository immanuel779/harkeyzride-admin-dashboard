type Env = {
  apiBaseUrl: string
  useMockApi: boolean
  isDev: boolean
}

function readEnv(): Env {
  const raw = import.meta.env
  const apiBaseUrl = raw.VITE_API_BASE_URL as string | undefined
  const useMockRaw = (raw.VITE_USE_MOCK_API as string | undefined) ?? 'true'
  const useMockApi = useMockRaw === 'true'

  if (!apiBaseUrl && !useMockApi) {
    console.warn('[env] VITE_API_BASE_URL is not set — falling back to mock mode')
  }

  return {
    apiBaseUrl: apiBaseUrl ?? 'http://localhost:4000/api/v1',
    useMockApi,
    isDev: !!raw.DEV,
  }
}

export const env = readEnv()