import { env } from '../../../config/env'
import { api } from '../../../lib/apiClient'
import { fetchSosAlerts } from '../../sos/data/mockAlerts'
import { fetchRidesReal } from '../../rides/data/mockRides'
import { fetchDrivers } from '../../drivers/data/mockDrivers'
import { fetchRiders } from '../../riders/data/mockRiders'

export type NotificationSeverity = 'critical' | 'high' | 'normal' | 'low'
export type NotificationCategory =
  | 'safety'
  | 'rides'
  | 'drivers'
  | 'riders'
  | 'finance'
  | 'system'

export type NotificationType =
  | 'sos'
  | 'ride'
  | 'driver'
  | 'rider'
  | 'audit'
  | 'system'

export type AdminNotification = {
  id: string
  type: NotificationType
  category: NotificationCategory
  severity: NotificationSeverity
  title: string
  description: string
  linkTo: string | null
  isRead: boolean
  createdAt: string
}

// ---------- Read state (localStorage) ----------

const READ_KEY = 'harkeyzride.notifications.read.v1'

function getReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveReadIds(ids: Set<string>) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]))
  } catch {
    // ignore
  }
}

// ---------- Mock data (used when VITE_USE_MOCK_API=true) ----------

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

const MOCK: AdminNotification[] = [
  {
    id: 'mock:sos:001',
    type: 'sos',
    category: 'safety',
    severity: 'critical',
    title: 'SOS triggered — Ride #4821',
    description: 'Rider Seyi Ariyo triggered SOS in Bodija.',
    linkTo: '/sos',
    isRead: false,
    createdAt: minutesAgo(2),
  },
  {
    id: 'mock:driver:002',
    type: 'driver',
    category: 'drivers',
    severity: 'normal',
    title: 'New driver application',
    description: 'Musa Ibrahim awaiting verification.',
    linkTo: '/drivers',
    isRead: false,
    createdAt: minutesAgo(15),
  },
  {
    id: 'mock:ride:003',
    type: 'ride',
    category: 'rides',
    severity: 'normal',
    title: 'Ride completed — ₦1,200',
    description: 'Bodija → Sweet Sensation',
    linkTo: '/rides',
    isRead: true,
    createdAt: minutesAgo(45),
  },
]

// ---------- Real aggregator ----------

function shortId(id: string) {
  if (id.startsWith('rd_')) return id.replace('rd_', '')
  return id.slice(0, 8).toUpperCase()
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  return `${Math.floor(hrs / 24)}d`
}

async function aggregateFromBackend(): Promise<AdminNotification[]> {
  const results = await Promise.allSettled([
    fetchSosAlerts(),
    fetchRidesReal(),
    fetchDrivers(),
    fetchRiders(),
    api.get<{ logs: { items: unknown[] } }>('/admin/audit-logs', {
      query: { limit: 30 },
    }),
  ])

  const out: AdminNotification[] = []

  // ---------- SOS ----------
  const sosResult = results[0]
  if (sosResult.status === 'fulfilled') {
    for (const s of sosResult.value) {
      out.push({
        id: `sos:${s.id}:${s.status}`,
        type: 'sos',
        category: 'safety',
        severity: s.status === 'open' ? 'critical' : s.status === 'acknowledged' ? 'high' : 'low',
        title:
          s.status === 'open'
            ? `SOS triggered — Ride #${shortId(s.rideId)}`
            : s.status === 'acknowledged'
              ? `SOS acknowledged — Ride #${shortId(s.rideId)}`
              : `SOS resolved — Ride #${shortId(s.rideId)}`,
        description: s.notes[0] ?? s.location,
        linkTo: '/sos',
        isRead: false,
        createdAt: s.triggeredAt,
      })
    }
  }

  // ---------- Rides ----------
  const ridesResult = results[1]
  if (ridesResult.status === 'fulfilled') {
    for (const r of ridesResult.value) {
      const severity: NotificationSeverity =
        r.status === 'sos' ? 'critical' : r.status === 'cancelled' ? 'high' : 'normal'
      out.push({
        id: `ride:${r.id}:${r.status}`,
        type: 'ride',
        category: 'rides',
        severity,
        title:
          r.status === 'sos'
            ? `Ride #${shortId(r.id)} flagged SOS`
            : r.status === 'cancelled'
              ? `Ride #${shortId(r.id)} cancelled`
              : r.status === 'completed'
                ? `Ride #${shortId(r.id)} completed — ₦${r.fare.toLocaleString()}`
                : `New ride #${shortId(r.id)} requested`,
        description: `${r.rider} · ${r.pickup} → ${r.destination}`,
        linkTo: `/rides/${r.id}`,
        isRead: false,
        createdAt: r.startedAt,
      })
    }
  }

  // ---------- Drivers ----------
  const driversResult = results[2]
  if (driversResult.status === 'fulfilled') {
    for (const d of driversResult.value) {
      const severity: NotificationSeverity = d.status === 'pending' ? 'high' : 'normal'
      out.push({
        id: `driver:${d.id}:${d.status}`,
        type: 'driver',
        category: 'drivers',
        severity,
        title:
          d.status === 'pending'
            ? `Driver registration pending — ${d.name}`
            : d.status === 'approved'
              ? `Driver approved — ${d.name}`
              : `Driver rejected — ${d.name}`,
        description: `${d.phone} · ${d.city}`,
        linkTo: `/drivers/${d.id}`,
        isRead: false,
        createdAt: d.submittedAt + 'T00:00:00.000Z',
      })
    }
  }

  // ---------- Riders ----------
  const ridersResult = results[3]
  if (ridersResult.status === 'fulfilled') {
    for (const r of ridersResult.value) {
      out.push({
        id: `rider:${r.id}:${r.status}`,
        type: 'rider',
        category: 'riders',
        severity: r.status === 'suspended' ? 'high' : 'low',
        title:
          r.status === 'suspended'
            ? `Rider suspended — ${r.name}`
            : `New rider registered — ${r.name}`,
        description: `${r.phone} · ${r.city}`,
        linkTo: `/riders/${r.id}`,
        isRead: false,
        createdAt: r.joinedAt + 'T00:00:00.000Z',
      })
    }
  }

  // ---------- Audit log ----------
  const auditResult = results[4]
  if (auditResult.status === 'fulfilled') {
    const items = auditResult.value?.logs?.items ?? []
    for (const a of items as Array<{
      id: string
      actorId: string
      action: string
      resource: string
      resourceId: string
      createdAt: string
    }>) {
      out.push({
        id: `audit:${a.id}`,
        type: 'audit',
        category: 'system',
        severity: 'low',
        title: `Admin action — ${a.action}`,
        description: `${a.resource} ${a.resourceId?.slice(0, 8) ?? ''}`,
        linkTo: '/audit',
        isRead: false,
        createdAt: a.createdAt,
      })
    }
  }

  // Sort newest first, keep last 60
  out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return out.slice(0, 60)
}

// ---------- Public fetch ----------

export async function fetchNotifications(): Promise<AdminNotification[]> {
  const raw = env.useMockApi ? MOCK : await aggregateFromBackend()
  const read = getReadIds()
  return raw.map((n) => ({
    ...n,
    isRead: read.has(n.id),
  }))
}

// ---------- Mutations ----------

export async function markNotificationReadApi(id: string): Promise<void> {
  const read = getReadIds()
  read.add(id)
  saveReadIds(read)
}

export async function markAllReadApi(ids: string[]): Promise<void> {
  const read = getReadIds()
  ids.forEach((id) => read.add(id))
  saveReadIds(read)
}

export function clearAllReadState(): void {
  try {
    localStorage.removeItem(READ_KEY)
  } catch {
    // ignore
  }
}

export { timeAgo }