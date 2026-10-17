export type AlertStatus = 'open' | 'acknowledged' | 'resolved'
export type AlertSeverity = 'critical' | 'high' | 'medium'

import { env } from '../../../config/env'
import { api } from '../../../lib/apiClient'
import {
  adaptSosList,
  type BackendPagination,
  type BackendSos,
} from '../../../services/adapters'

export type SosAlert = {
  id: string
  rideId: string
  riderName: string
  riderPhone: string
  driverName: string
  driverPhone: string
  location: string
  coordinates: { lat: number; lng: number }
  severity: AlertSeverity
  status: AlertStatus
  triggeredAt: string
  acknowledgedBy: string | null
  resolvedBy: string | null
  notes: string[]
}

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

const INITIAL: SosAlert[] = [
  {
    id: 'sos_001',
    rideId: 'rd_4821',
    riderName: 'Seyi Ariyo',
    riderPhone: '+234 708 958 4607',
    driverName: 'John Smith',
    driverPhone: '+234 801 234 5678',
    location: 'Bodija Market, Ibadan',
    coordinates: { lat: 7.418, lng: 3.9024 },
    severity: 'critical',
    status: 'open',
    triggeredAt: minutesAgo(2),
    acknowledgedBy: null,
    resolvedBy: null,
    notes: [],
  },
  {
    id: 'sos_002',
    rideId: 'rd_4819',
    riderName: 'Bola Ariyo',
    riderPhone: '+234 803 456 7890',
    driverName: 'Ahmed Bello',
    driverPhone: '+234 803 456 7890',
    location: 'UI Gate, Oduduwa Road, Ibadan',
    coordinates: { lat: 7.4422, lng: 3.8996 },
    severity: 'high',
    status: 'open',
    triggeredAt: minutesAgo(7),
    acknowledgedBy: null,
    resolvedBy: null,
    notes: [],
  },
  {
    id: 'sos_003',
    rideId: 'rd_4805',
    riderName: 'Yusuf Adeleke',
    riderPhone: '+234 805 678 9012',
    driverName: 'Kunle Adebayo',
    driverPhone: '+234 804 567 8901',
    location: 'Challenge, Ibadan',
    coordinates: { lat: 7.3554, lng: 3.8763 },
    severity: 'medium',
    status: 'acknowledged',
    triggeredAt: minutesAgo(18),
    acknowledgedBy: 'Damilare O.',
    resolvedBy: null,
    notes: ['Called rider — no answer. Escalating to driver.'],
  },
]

// ---------- Mutable in-memory store ----------

let store: SosAlert[] = INITIAL.map((a) => ({
  ...a,
  coordinates: { ...a.coordinates },
  notes: [...a.notes],
}))

// ---------- Async fetchers ----------

// ---------- Real API (SOS list is nested: data.alerts.items) ----------

export async function fetchSosAlerts(): Promise<SosAlert[]> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 500))
    return store.map((a) => ({
      ...a,
      coordinates: { ...a.coordinates },
      notes: [...a.notes],
    }))
  }
  const res = await api.get<{
    alerts: BackendPagination<BackendSos> | BackendSos[]
  }>('/admin/sos', { query: { limit: 100 } })

  const rows = Array.isArray(res.alerts)
    ? res.alerts
    : res.alerts?.items ?? []

  return adaptSosList(rows)
}

export async function acknowledgeSosApi(id: string): Promise<void> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 500))
    store = store.map((a) =>
      a.id === id ? { ...a, status: 'acknowledged' } : a,
    )
    return
  }
  await api.put(`/admin/sos/${id}`, { status: 'acknowledged' })
}

export async function resolveSosApi(id: string, note: string): Promise<void> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 600))
    store = store.map((a) =>
      a.id === id
        ? { ...a, status: 'resolved', notes: [...a.notes, note] }
        : a,
    )
    return
  }
  await api.put(`/admin/sos/${id}`, { status: 'resolved', note })
}