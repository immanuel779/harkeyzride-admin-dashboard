// Maps backend response shapes → our UI shapes
// Keeps the UI code identical whether we're on mock or live data.

import type { Driver, DriverStatus } from '../features/drivers/data/mockDrivers'
import type { Rider, RiderStatus } from '../features/riders/data/mockRiders'

// ---------- Backend shapes (as observed) ----------

export type BackendUser = {
  id: string
  name: string
  email?: string
  phone: string
  role: string
  status: string
  createdAt: string
  updatedAt: string
  ninVerified?: boolean
}

export type BackendDriver = {
  id: string
  userId: string
  status: string
  onlineStatus: boolean
  verificationStatus: string
  currentLocation: unknown
  createdAt: string
  updatedAt: string
  user: BackendUser
}

export type BackendPagination<T> = {
  items: T[]
  page: number
  limit: number
  total: number
  pages: number
}

// ---------- Backend → UI adapters ----------

function mapDriverStatus(s: string): DriverStatus {
  if (s === 'approved' || s === 'active') return 'approved'
  if (s === 'rejected' || s === 'suspended') return 'rejected'
  return 'pending'
}

function mapRiderStatus(status: string, ninVerified?: boolean): RiderStatus {
  if (status === 'suspended') return 'suspended'
  if (ninVerified === false) return 'nin_pending'
  return 'active'
}

export function adaptDriver(d: BackendDriver): Driver {
  return {
    id: d.id,
    name: d.user?.name ?? 'Unknown Driver',
    phone: d.user?.phone ?? '',
    email: d.user?.email ?? '',
    city: '—',
    vehicle: '—',
    plate: '—',
    vehicleColor: '—',
    status: mapDriverStatus(d.verificationStatus || d.status),
    submittedAt: (d.createdAt ?? '').slice(0, 10),
    nin: '—',
    selfieUrl: null,
    ninDocUrl: null,
  }
}

export function adaptDriverList(
  rows: BackendDriver[] | undefined | null,
): Driver[] {
  if (!Array.isArray(rows)) return []
  return rows.map(adaptDriver)
}

export function adaptRider(r: BackendUser): Rider {
  return {
    id: r.id,
    name: r.name ?? 'Unknown Rider',
    phone: r.phone ?? '',
    email: r.email ?? '',
    city: '—',
    walletBalance: 0,
    totalRides: 0,
    rating: 0,
    status: mapRiderStatus(r.status, r.ninVerified),
    joinedAt: (r.createdAt ?? '').slice(0, 10),
    nin: null,
  }
}

export function adaptRiderList(
  rows: BackendUser[] | undefined | null,
): Rider[] {
  if (!Array.isArray(rows)) return []
  return rows.map(adaptRider)
}

// ---------- Rides ----------

import type {
  Ride,
  RideStatus as RideUIStatus,
} from '../features/rides/data/mockRides'
import type {
  SosAlert,
  AlertStatus,
  AlertSeverity,
} from '../features/sos/data/mockAlerts'
import type {
  SubscriptionEntry,
  SubscriptionStatus,
  SubscriptionMethod,
} from '../features/subscription/data/mockSubscriptions'

export type BackendRide = {
  id: string
  riderId: string
  driverId: string | null
  pickup: { latitude: number; longitude: number; address: string }
  destination: { latitude: number; longitude: number; address: string }
  notes?: string
  paymentMethod: string
  fare: number
  fareBreakdown?: {
    baseFare?: number
    distanceFare?: number
    timeFare?: number
    distanceKm?: number
    durationMin?: number
    currency?: string
    totalFare?: number
  }
  status: string
  requestedAt?: string
  createdAt: string
  rider?: { name?: string; phone?: string } | null
  driver?: {
    user?: { name?: string; phone?: string }
  } | null
}

export type BackendSos = {
  id: string
  userId: string
  rideId: string
  source: string
  latitude: number
  longitude: number
  note?: string
  status: string
  createdAt: string
  acknowledgedBy?: string | null
  resolvedBy?: string | null
  notes?: string[]
}

export type BackendSubscription = {
  id: string
  driverId?: string
  driverName?: string
  amount?: number
  status?: string
  method?: string
  reference?: string
  balanceBefore?: number
  balanceAfter?: number
  createdAt?: string
}

function mapRideStatus(s: string): RideUIStatus {
  if (s === 'completed') return 'completed'
  if (s === 'cancelled') return 'cancelled'
  if (s === 'sos') return 'sos'
  // requested / accepted / arrived / in_progress → in_progress
  return 'in_progress'
}

export function adaptRide(r: BackendRide): Ride {
  const status = mapRideStatus(r.status)
  return {
    id: r.id,
    rider: r.rider?.name ?? 'Unknown Rider',
    driver: r.driver?.user?.name ?? 'Unassigned',
    pickup: r.pickup?.address ?? '—',
    destination: r.destination?.address ?? '—',
    fare: Number(r.fare ?? 0),
    paymentMethod: (r.paymentMethod === 'wallet' ? 'wallet' : 'cash') as
      | 'wallet'
      | 'cash',
    status,
    startedAt: r.requestedAt ?? r.createdAt,
    durationMin: Number(r.fareBreakdown?.durationMin ?? 0),
  }
}

export function adaptRideList(
  rows: BackendRide[] | undefined | null,
): Ride[] {
  if (!Array.isArray(rows)) return []
  return rows.map(adaptRide)
}

// ---------- SOS ----------

function mapSosStatus(s: string): AlertStatus {
  if (s === 'resolved' || s === 'false_alarm') return 'resolved'
  if (s === 'acknowledged' || s === 'dispatched') return 'acknowledged'
  return 'open'
}

function mapSosSeverity(source: string): AlertSeverity {
  if (source === 'driver') return 'high'
  return 'critical'
}

export function adaptSos(s: BackendSos): SosAlert {
  return {
    id: s.id,
    rideId: s.rideId,
    riderName: '—',
    riderPhone: '—',
    driverName: '—',
    driverPhone: '—',
    location: `${s.latitude.toFixed(4)}, ${s.longitude.toFixed(4)}`,
    coordinates: { lat: s.latitude, lng: s.longitude },
    severity: mapSosSeverity(s.source),
    status: mapSosStatus(s.status),
    triggeredAt: s.createdAt,
    acknowledgedBy: s.acknowledgedBy ?? null,
    resolvedBy: s.resolvedBy ?? null,
    notes: s.notes ?? (s.note ? [s.note] : []),
  }
}

export function adaptSosList(
  rows: BackendSos[] | undefined | null,
): SosAlert[] {
  if (!Array.isArray(rows)) return []
  return rows.map(adaptSos)
}

// ---------- Subscriptions ----------

function mapSubStatus(s: string): SubscriptionStatus {
  if (s === 'success' || s === 'successful' || s === 'paid') return 'success'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'pending') return 'pending'
  return 'insufficient_balance'
}

export function adaptSubscription(s: BackendSubscription): SubscriptionEntry {
  return {
    id: s.id,
    driverId: s.driverId ?? '',
    driverName: s.driverName ?? '—',
    amount: Number(s.amount ?? 1500),
    status: mapSubStatus(s.status ?? 'pending'),
    method: (s.method === 'wallet' ? 'wallet' : 'bank_transfer') as SubscriptionMethod,
    reference: s.reference ?? `SUB-${s.id.slice(0, 8)}`,
    balanceBefore: Number(s.balanceBefore ?? 0),
    balanceAfter: Number(s.balanceAfter ?? 0),
    createdAt: s.createdAt ?? new Date().toISOString(),
  }
}

export function adaptSubscriptionList(
  rows: BackendSubscription[] | undefined | null,
): SubscriptionEntry[] {
  if (!Array.isArray(rows)) return []
  return rows.map(adaptSubscription)
}
// ---------- Payments / Financials ----------

export type BackendPayment = {
  id: string
  type?: string
  amount?: number
  status?: string
  userId?: string
  userName?: string
  user?: BackendUser
  reference?: string
  rideId?: string
  provider?: string
  createdAt?: string
  method?: string
}

// ---------- CNG ----------

export type BackendCngTransaction = {
  id: string
  driverId?: string
  driverName?: string
  station?: string
  quantity?: number
  amount?: number
  cost?: number
  unit?: string
  reference?: string
  createdAt?: string
  recordedAt?: string
}

export type BackendCngStation = {
  station: string
  refuels: number
  amount: number
  quantity: number
}

// ---------- Penalties (Cancellations) ----------

export type BackendPenalty = {
  id: string
  actorId?: string
  action?: string
  resource?: string
  resourceId?: string
  metadata?: {
    driverId?: string
    rideId?: string
    amount?: number
    reason?: string
    status?: string
  }
  createdAt?: string
}

// ---------- Audit Log ----------

export type BackendAuditLog = {
  id: string
  actorId: string
  action: string
  resource: string
  resourceId: string
  metadata?: Record<string, unknown>
  createdAt: string
  actorName?: string
  actorEmail?: string
}

// ---------- Generic helpers ----------

// Extracts an array from various response wrappers:
//   { items: [...] }  |  [...]  |  { payments: [...] }  |  { payments: { items: [...] } }
export function unwrapList<T>(source: unknown, key?: string): T[] {
  if (!source) return []
  if (Array.isArray(source)) return source as T[]
  const obj = source as Record<string, unknown>
  if (key && obj[key]) {
    return unwrapList<T>(obj[key])
  }
  if (Array.isArray(obj.items)) return obj.items as T[]
  // Try common keys
  for (const k of ['data', 'results', 'rows']) {
    if (obj[k]) {
      const r = unwrapList<T>(obj[k], key)
      if (r.length > 0) return r
    }
  }
  return []
}