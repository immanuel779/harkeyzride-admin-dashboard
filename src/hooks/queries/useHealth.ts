import { useQuery } from '@tanstack/react-query'

import { env } from '../../config/env'

type HealthRaw = {
  success: boolean
  message: string
  data: {
    service?: string
    environment?: string
    database?: string
    timestamp?: string
    uptime?: number
  } | null
  error: unknown
}

export type HealthResponse = {
  success: boolean
  database: string
  environment: string
  service: string
}

async function fetchHealth(): Promise<HealthResponse> {
  // Use the same base URL as the rest of the app — dev proxy handles CORS
  const rootUrl = env.apiBaseUrl.replace(/\/api\/v1\/?$/, '')
  const res = await fetch(`${rootUrl}/health`)
  if (!res.ok) throw new Error(`Health check failed: HTTP ${res.status}`)
  const json = (await res.json()) as HealthRaw
  return {
    success: json.success,
    database: json.data?.database ?? 'unknown',
    environment: json.data?.environment ?? 'unknown',
    service: json.data?.service ?? 'unknown',
  }
}

export function useHealth() {
  return useQuery<HealthResponse>({
    queryKey: ['health'],
    queryFn: fetchHealth,
    refetchInterval: 60 * 1000,
    retry: 1,
    staleTime: 30 * 1000,
  })
}