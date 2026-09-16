export type AlertStatus = 'open' | 'acknowledged' | 'resolved'
export type AlertSeverity = 'critical' | 'high' | 'medium'

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

// 🟡 BACKEND REQUIRED — GET /admin/sos/alerts
// 🟡 Real-time: subscribe to WebSocket 'sos:new_alert'
const minutesAgo = (m: number) => new Date(Date.now() - m * 60 * 1000).toISOString()

export const MOCK_ALERTS: SosAlert[] = [
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
// ---------- Async fetchers (used by TanStack Query) ----------

// 🟡 BACKEND REQUIRED — GET /admin/sos/alerts
export async function fetchSosAlerts(): Promise<SosAlert[]> {
  await new Promise((r) => setTimeout(r, 500))
  return MOCK_ALERTS
}

// 🟡 BACKEND REQUIRED — POST /admin/sos/:id/acknowledge
export async function acknowledgeSosApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 500))
  console.log('[mock api] acknowledged SOS', id)
}

// 🟡 BACKEND REQUIRED — POST /admin/sos/:id/resolve { note }
export async function resolveSosApi(id: string, note: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 600))
  console.log('[mock api] resolved SOS', id, 'note:', note)
}