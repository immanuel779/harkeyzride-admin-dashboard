export type RiderStatus = 'active' | 'suspended' | 'nin_pending'

export type Rider = {
  id: string
  name: string
  phone: string
  email: string
  city: string
  walletBalance: number
  totalRides: number
  rating: number
  status: RiderStatus
  joinedAt: string
  nin: string | null
}
import { env } from '../../../config/env'
import { api } from '../../../lib/apiClient'
import {
  adaptRider,
  adaptRiderList,
  type BackendPagination,
  type BackendUser,
} from '../../../services/adapters'
const INITIAL: Rider[] = [
  { id: 'r1', name: 'Seyi Ariyo', phone: '+234 708 958 4607', email: 'seyi.ariyo@example.com', city: 'Ibadan', walletBalance: 4500, totalRides: 28, rating: 4.9, status: 'active', joinedAt: '2026-08-01', nin: '12345678901' },
  { id: 'r2', name: 'Tunde Bakare', phone: '+234 802 345 6789', email: 'tunde.b@example.com', city: 'Ibadan', walletBalance: 1200, totalRides: 15, rating: 4.7, status: 'active', joinedAt: '2026-08-12', nin: '23456789012' },
  { id: 'r3', name: 'Bola Ariyo', phone: '+234 803 456 7890', email: 'bola.a@example.com', city: 'Ibadan', walletBalance: 0, totalRides: 8, rating: 4.5, status: 'nin_pending', joinedAt: '2026-08-25', nin: null },
  { id: 'r4', name: 'Chidinma Okoye', phone: '+234 804 567 8901', email: 'chidinma.o@example.com', city: 'Lagos', walletBalance: 12000, totalRides: 42, rating: 5.0, status: 'active', joinedAt: '2026-07-15', nin: '34567890123' },
  { id: 'r5', name: 'Yusuf Adeleke', phone: '+234 805 678 9012', email: 'yusuf.a@example.com', city: 'Ibadan', walletBalance: 800, totalRides: 6, rating: 4.2, status: 'suspended', joinedAt: '2026-09-01', nin: '45678901234' },
  { id: 'r6', name: 'Grace Nwosu', phone: '+234 806 789 0123', email: 'grace.n@example.com', city: 'Abuja', walletBalance: 15000, totalRides: 55, rating: 4.8, status: 'active', joinedAt: '2026-06-20', nin: '56789012345' },
  { id: 'r7', name: 'Ibrahim Sule', phone: '+234 807 890 1234', email: 'ibrahim.s@example.com', city: 'Ibadan', walletBalance: 3200, totalRides: 19, rating: 4.6, status: 'active', joinedAt: '2026-08-18', nin: '67890123456' },
  { id: 'r8', name: 'Funke Adeyemi', phone: '+234 808 901 2345', email: 'funke.a@example.com', city: 'Lagos', walletBalance: 2200, totalRides: 11, rating: 4.4, status: 'active', joinedAt: '2026-09-02', nin: '78901234567' },
]

// ---------- Mutable in-memory store ----------
//
// Behaves like a real backend: mutations persist across fetches until
// page reload. Refetches return the CURRENT state, not initial state.
//
// 🟡 BACKEND REQUIRED — replace fetch + mutations with real API calls.
//   GET    /admin/riders
//   GET    /admin/riders/:id
//   POST   /admin/riders/:id/suspend
//   POST   /admin/riders/:id/reinstate

let store: Rider[] = INITIAL.map((r) => ({ ...r }))

export function getRiderById(id: string | undefined): Rider | null {
  if (!id) return null
  const rider = store.find((r) => r.id === id)
  return rider ? { ...rider } : null
}

// ---------- Async fetchers ----------

export async function fetchRiders(): Promise<Rider[]> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 500))
    return store.map((r) => ({ ...r }))
  }
  const res = await api.get<BackendPagination<BackendUser>>('/admin/riders', {
    query: { limit: 100 },
  })
  return adaptRiderList(res.items)
}

export async function fetchRider(id: string): Promise<Rider> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 400))
    const rider = store.find((r) => r.id === id)
    if (!rider) throw new Error('Rider not found')
    return { ...rider }
  }
  const res = await api.get<BackendPagination<BackendUser>>('/admin/riders', {
    query: { limit: 200 },
  })
  const found = res.items.find((r) => r.id === id)
  if (!found) throw new Error('Rider not found')
  return adaptRider(found)
}

export async function suspendRiderApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  store = store.map((r) =>
    r.id === id ? { ...r, status: 'suspended' } : r,
  )
}

export async function reinstateRiderApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  store = store.map((r) =>
    r.id === id ? { ...r, status: 'active' } : r,
  )
}
// ---------- Extended detail data ----------

export type RiderTrip = {
  id: string
  rideId: string
  driverName: string
  pickup: string
  destination: string
  fare: number
  status: 'completed' | 'cancelled' | 'in_progress'
  completedAt: string
  rating: number | null
}

export type WalletTransaction = {
  id: string
  type: 'credit' | 'debit'
  category: 'funding' | 'ride_payment' | 'refund' | 'tip' | 'cancellation'
  description: string
  amount: number
  balanceAfter: number
  createdAt: string
}

export type SupportTicket = {
  id: string
  subject: string
  category: 'ride' | 'payment' | 'driver' | 'account' | 'safety' | 'other'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  createdAt: string
  updatedAt: string
  lastMessage: string
}

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString()

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString()

export function getRiderTrips(_id: string): RiderTrip[] {
  return [
    { id: 'rt_1', rideId: 'rd_4821', driverName: 'John Smith', pickup: 'Bodija', destination: 'Sweet Sensation', fare: 1200, status: 'completed', completedAt: hoursAgo(2), rating: 5 },
    { id: 'rt_2', rideId: 'rd_4820', driverName: 'Musa Ibrahim', pickup: 'Ring Road', destination: 'Palms Mall', fare: 1500, status: 'completed', completedAt: hoursAgo(5), rating: 5 },
    { id: 'rt_3', rideId: 'rd_4815', driverName: 'Ahmed Bello', pickup: 'UI Gate', destination: 'Dugbe', fare: 900, status: 'completed', completedAt: hoursAgo(11), rating: 4 },
    { id: 'rt_4', rideId: 'rd_4810', driverName: 'Emeka Okafor', pickup: 'Challenge', destination: 'Ring Road', fare: 1100, status: 'completed', completedAt: hoursAgo(20), rating: 5 },
    { id: 'rt_5', rideId: 'rd_4805', driverName: '—', pickup: 'Akobo', destination: 'UI', fare: 200, status: 'cancelled', completedAt: hoursAgo(28), rating: null },
    { id: 'rt_6', rideId: 'rd_4798', driverName: 'Femi Akinyemi', pickup: 'Total Filling', destination: 'UI-Sango', fare: 700, status: 'completed', completedAt: daysAgo(2), rating: 5 },
  ]
}

export function getWalletTransactions(_id: string): WalletTransaction[] {
  return [
    { id: 'wt_1', type: 'debit', category: 'ride_payment', description: 'Ride to Sweet Sensation', amount: 1200, balanceAfter: 4500, createdAt: hoursAgo(2) },
    { id: 'wt_2', type: 'credit', category: 'funding', description: 'Wallet funding via Wema', amount: 5000, balanceAfter: 5700, createdAt: hoursAgo(5) },
    { id: 'wt_3', type: 'debit', category: 'cancellation', description: 'Cancellation fee', amount: 200, balanceAfter: 700, createdAt: hoursAgo(28) },
    { id: 'wt_4', type: 'credit', category: 'refund', description: 'Refund for cancelled ride', amount: 1200, balanceAfter: 900, createdAt: daysAgo(2) },
    { id: 'wt_5', type: 'debit', category: 'ride_payment', description: 'Ride to Palms Mall', amount: 1500, balanceAfter: 2200, createdAt: daysAgo(3) },
    { id: 'wt_6', type: 'credit', category: 'funding', description: 'Wallet funding via Wema', amount: 3000, balanceAfter: 3700, createdAt: daysAgo(5) },
    { id: 'wt_7', type: 'debit', category: 'tip', description: 'Tip for John Smith', amount: 200, balanceAfter: 700, createdAt: daysAgo(6) },
  ]
}

export function getSupportTickets(_id: string): SupportTicket[] {
  return [
    { id: 'st_1', subject: 'Driver took longer route', category: 'ride', status: 'open', priority: 'normal', createdAt: hoursAgo(6), updatedAt: hoursAgo(4), lastMessage: 'Rider reports unexpected detour during last trip.' },
    { id: 'st_2', subject: 'Wallet funding not reflected', category: 'payment', status: 'in_progress', priority: 'high', createdAt: daysAgo(1), updatedAt: hoursAgo(8), lastMessage: 'Payment confirmed by provider — awaiting reconciliation.' },
    { id: 'st_3', subject: 'Cannot update phone number', category: 'account', status: 'resolved', priority: 'low', createdAt: daysAgo(4), updatedAt: daysAgo(3), lastMessage: 'Verified email and updated contact successfully.' },
  ]
}

// 🟡 BACKEND REQUIRED — PUT /admin/complaints/:id (status update)
export async function updateTicketStatusApi(
  _ticketId: string,
  _status: 'open' | 'in_progress' | 'resolved' | 'closed',
): Promise<void> {
  await new Promise((r) => setTimeout(r, 500))
}

// ============================================================================
// METADATA — canonical lists, labels, tones, thresholds
// ============================================================================

export const ALL_RIDER_STATUSES: RiderStatus[] = ['active', 'suspended', 'nin_pending']

export const RIDER_STATUS_META: Record<
  RiderStatus,
  { label: string; tone: 'success' | 'warning' | 'danger'; color: string; description: string }
> = {
  active: {
    label: 'Active',
    tone: 'success',
    color: '#10b981',
    description: 'Rider has full booking access',
  },
  suspended: {
    label: 'Suspended',
    tone: 'danger',
    color: '#ef4444',
    description: 'Rider cannot book rides until reinstated',
  },
  nin_pending: {
    label: 'NIN Pending',
    tone: 'warning',
    color: '#f59e0b',
    description: 'Rider must verify NIN to unlock bookings',
  },
}

export const TRIP_STATUS_META: Record<
  RiderTrip['status'],
  { label: string; tone: 'success' | 'danger' | 'info' }
> = {
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  in_progress: { label: 'In progress', tone: 'info' },
}

export const TICKET_STATUS_META: Record<
  SupportTicket['status'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'; isOpen: boolean }
> = {
  open: { label: 'Open', tone: 'danger', isOpen: true },
  in_progress: { label: 'In Progress', tone: 'info', isOpen: true },
  resolved: { label: 'Resolved', tone: 'success', isOpen: false },
  closed: { label: 'Closed', tone: 'neutral', isOpen: false },
}

export const TICKET_PRIORITY_META: Record<
  SupportTicket['priority'],
  { label: string; tone: 'danger' | 'warning' | 'info' | 'neutral'; weight: number }
> = {
  urgent: { label: 'Urgent', tone: 'danger', weight: 4 },
  high: { label: 'High', tone: 'warning', weight: 3 },
  normal: { label: 'Normal', tone: 'info', weight: 2 },
  low: { label: 'Low', tone: 'neutral', weight: 1 },
}

export const TICKET_CATEGORY_LABELS: Record<SupportTicket['category'], string> = {
  ride: 'Ride issue',
  payment: 'Payment issue',
  driver: 'Driver complaint',
  account: 'Account issue',
  safety: 'Safety concern',
  other: 'Other',
}

export const WALLET_CATEGORY_LABELS: Record<WalletTransaction['category'], string> = {
  funding: 'Wallet funding',
  ride_payment: 'Ride payment',
  refund: 'Refund',
  tip: 'Driver tip',
  cancellation: 'Cancellation fee',
}

export const LOW_RATING_THRESHOLD = 4.0
export const LOW_WALLET_THRESHOLD = 500
export const HIGH_WALLET_THRESHOLD = 20000
export const NEW_RIDER_DAYS = 30
export const DORMANT_DAYS = 90
export const SLA_HOURS = 24
export const HIGH_RISK_SCORE = 60
export const MEDIUM_RISK_SCORE = 30

// ============================================================================
// GUARDS
// ============================================================================

export function isRiderStatus(value: unknown): value is RiderStatus {
  return typeof value === 'string' && ALL_RIDER_STATUSES.includes(value as RiderStatus)
}

export function isRider(value: unknown): value is Rider {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<Rider>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.phone === 'string' &&
    typeof v.email === 'string' &&
    typeof v.city === 'string' &&
    typeof v.walletBalance === 'number' &&
    typeof v.totalRides === 'number' &&
    typeof v.rating === 'number' &&
    isRiderStatus(v.status) &&
    typeof v.joinedAt === 'string'
  )
}

// ============================================================================
// VALIDATION
// ============================================================================

const NIN_PATTERN = /^\d{11}$/
const NIGERIAN_PHONE_PATTERN = /^(\+?234|0)[789]\d{9}$/
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidNin(nin: string | null | undefined): boolean {
  if (!nin) return false
  return NIN_PATTERN.test(nin)
}

export function isValidPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s-]/g, '')
  return NIGERIAN_PHONE_PATTERN.test(cleaned)
}

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email)
}

export function validateRider(rider: Partial<Rider>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!rider.id) errors.push('id is required')
  if (!rider.name) errors.push('name is required')
  if (!rider.phone) errors.push('phone is required')
  else if (!isValidPhone(rider.phone)) errors.push('phone is malformed')
  if (!rider.email) errors.push('email is required')
  else if (!isValidEmail(rider.email)) errors.push('email is malformed')
  if (!rider.city) errors.push('city is required')
  if (typeof rider.walletBalance !== 'number' || rider.walletBalance < 0) {
    errors.push('walletBalance must be a non-negative number')
  }
  if (typeof rider.totalRides !== 'number' || rider.totalRides < 0) {
    errors.push('totalRides must be a non-negative number')
  }
  if (typeof rider.rating !== 'number' || rider.rating < 0 || rider.rating > 5) {
    errors.push('rating must be between 0 and 5')
  }
  if (!isRiderStatus(rider.status)) errors.push('status is invalid')
  if (!rider.joinedAt) errors.push('joinedAt is required')
  else if (Number.isNaN(Date.parse(rider.joinedAt))) {
    errors.push('joinedAt must be a valid date')
  }
  if (rider.nin != null && !isValidNin(rider.nin)) {
    errors.push('nin must be an 11-digit number')
  }
  return { valid: errors.length === 0, errors }
}

// ============================================================================
// BUSINESS RULES — risk, tiering, lifecycle
// ============================================================================

export type RiskTier = 'low' | 'medium' | 'high'

export type RiskAssessment = {
  score: number
  tier: RiskTier
  reasons: string[]
  recommendedAction: 'none' | 'review' | 'suspend' | 'verify' | 'topup'
}

/**
 * Compute a 0-100 risk score for a rider based on status, rating,
 * verification, wallet health, and open support tickets.
 */
export function computeRiderRisk(
  rider: Rider,
  tickets: SupportTicket[] = [],
): RiskAssessment {
  let score = 0
  const reasons: string[] = []
  const actions = new Set<string>()

  if (rider.status === 'suspended') {
    score += 40
    reasons.push('Currently suspended')
    actions.add('review')
  }
  if (rider.status === 'nin_pending' || !isValidNin(rider.nin)) {
    score += 25
    reasons.push('NIN verification incomplete')
    actions.add('verify')
  }
  if (rider.rating < LOW_RATING_THRESHOLD && rider.totalRides >= 3) {
    score += 20
    reasons.push(`Low rating (${rider.rating.toFixed(1)}★)`)
    actions.add('review')
  }
  const urgent = tickets.filter(
    (t) =>
      TICKET_STATUS_META[t.status].isOpen && t.priority === 'urgent',
  ).length
  if (urgent > 0) {
    score += 15
    reasons.push(`${urgent} urgent ticket${urgent === 1 ? '' : 's'}`)
    actions.add('review')
  }
  if (rider.walletBalance < LOW_WALLET_THRESHOLD && rider.totalRides > 0) {
    score += 10
    reasons.push('Wallet balance low')
    actions.add('topup')
  }
  if (rider.walletBalance >= HIGH_WALLET_THRESHOLD) {
    score += 5
    reasons.push('High-value wallet')
  }

  score = Math.min(100, score)
  const tier: RiskTier =
    score >= HIGH_RISK_SCORE
      ? 'high'
      : score >= MEDIUM_RISK_SCORE
        ? 'medium'
        : 'low'

  let recommendedAction: RiskAssessment['recommendedAction'] = 'none'
  if (actions.has('suspend')) recommendedAction = 'suspend'
  else if (actions.has('verify')) recommendedAction = 'verify'
  else if (actions.has('review')) recommendedAction = 'review'
  else if (actions.has('topup')) recommendedAction = 'topup'

  return { score, tier, reasons, recommendedAction }
}

export type RiderLifecycle = 'new' | 'active' | 'loyal' | 'dormant' | 'churned'

export function computeLifecycle(rider: Rider): {
  stage: RiderLifecycle
  daysSinceJoined: number
  ridesPerMonth: number
  label: string
} {
  const daysSinceJoined = rider.joinedAt
    ? Math.floor((Date.now() - Date.parse(rider.joinedAt)) / (24 * 60 * 60 * 1000))
    : 0
  const months = Math.max(1, daysSinceJoined / 30)
  const ridesPerMonth = rider.totalRides / months

  let stage: RiderLifecycle
  if (daysSinceJoined <= NEW_RIDER_DAYS && rider.totalRides < 3) stage = 'new'
  else if (rider.totalRides >= 30) stage = 'loyal'
  else if (rider.totalRides >= 3) stage = 'active'
  else if (daysSinceJoined > DORMANT_DAYS && rider.totalRides === 0) stage = 'churned'
  else stage = 'dormant'

  const label = {
    new: 'New rider',
    active: 'Active',
    loyal: 'Loyal',
    dormant: 'Dormant',
    churned: 'Churned',
  }[stage]

  return { stage, daysSinceJoined, ridesPerMonth, label }
}

export function verificationChecks(rider: Rider): Array<{
  key: string
  label: string
  ok: boolean
}> {
  return [
    { key: 'nin', label: 'NIN verified', ok: isValidNin(rider.nin) },
    { key: 'phone', label: 'Phone valid', ok: isValidPhone(rider.phone) },
    { key: 'email', label: 'Email valid', ok: isValidEmail(rider.email) },
    { key: 'active', label: 'Account active', ok: rider.status === 'active' },
    { key: 'ride', label: 'First ride completed', ok: rider.totalRides > 0 },
  ]
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatNaira(amount: number, currency = '₦'): string {
  return `${currency}${amount.toLocaleString()}`
}

export function formatRelativeTime(iso: string | number, now = Date.now()): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (Number.isNaN(t)) return String(iso)
  const diff = Math.max(0, now - t)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatStatus(status: RiderStatus): string {
  return RIDER_STATUS_META[status]?.label ?? status
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function describeRider(rider: Rider): string {
  return `${rider.name} · ${formatStatus(rider.status)} · ${formatNaira(
    rider.walletBalance,
  )} · ${rider.totalRides} rides`
}

// ============================================================================
// FILTERING
// ============================================================================

export type RiderFilters = {
  statuses?: RiderStatus[]
  cities?: string[]
  minWallet?: number
  maxWallet?: number
  minRides?: number
  maxRides?: number
  minRating?: number
  maxRating?: number
  onlyVerified?: boolean
  onlyUnverified?: boolean
  search?: string
}

export function filterRiders(riders: Rider[], filters: RiderFilters): Rider[] {
  const statusSet = filters.statuses?.length ? new Set(filters.statuses) : null
  const citySet = filters.cities?.length ? new Set(filters.cities) : null
  const q = filters.search?.trim().toLowerCase() ?? ''

  return riders.filter((r) => {
    if (statusSet && !statusSet.has(r.status)) return false
    if (citySet && !citySet.has(r.city)) return false
    if (typeof filters.minWallet === 'number' && r.walletBalance < filters.minWallet) return false
    if (typeof filters.maxWallet === 'number' && r.walletBalance > filters.maxWallet) return false
    if (typeof filters.minRides === 'number' && r.totalRides < filters.minRides) return false
    if (typeof filters.maxRides === 'number' && r.totalRides > filters.maxRides) return false
    if (typeof filters.minRating === 'number' && r.rating < filters.minRating) return false
    if (typeof filters.maxRating === 'number' && r.rating > filters.maxRating) return false
    if (filters.onlyVerified && !isValidNin(r.nin)) return false
    if (filters.onlyUnverified && isValidNin(r.nin)) return false
    if (q) {
      const haystack = [r.name, r.phone, r.email, r.city, r.id, r.nin ?? '']
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function searchRiders(riders: Rider[], query: string): Rider[] {
  return filterRiders(riders, { search: query })
}

// ============================================================================
// SORTING
// ============================================================================

export type RiderSortField =
  | 'name'
  | 'city'
  | 'walletBalance'
  | 'totalRides'
  | 'rating'
  | 'joinedAt'
  | 'status'

export type SortDir = 'asc' | 'desc'

export function sortRiders(
  riders: Rider[],
  field: RiderSortField = 'joinedAt',
  dir: SortDir = 'desc',
): Rider[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...riders].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
    return String(av).localeCompare(String(bv)) * mul
  })
}

// ============================================================================
// GROUPING
// ============================================================================

export function groupByStatus(
  riders: Rider[],
): Record<RiderStatus, Rider[]> {
  const out = ALL_RIDER_STATUSES.reduce<Record<RiderStatus, Rider[]>>(
    (acc, s) => {
      acc[s] = []
      return acc
    },
    {} as Record<RiderStatus, Rider[]>,
  )
  for (const r of riders) out[r.status].push(r)
  return out
}

export function groupByCity(riders: Rider[]): Record<string, Rider[]> {
  const out: Record<string, Rider[]> = {}
  for (const r of riders) {
    if (!out[r.city]) out[r.city] = []
    out[r.city].push(r)
  }
  return out
}

export function groupByLifecycle(
  riders: Rider[],
): Record<RiderLifecycle, Rider[]> {
  const out: Record<RiderLifecycle, Rider[]> = {
    new: [],
    active: [],
    loyal: [],
    dormant: [],
    churned: [],
  }
  for (const r of riders) out[computeLifecycle(r).stage].push(r)
  return out
}

export function groupByRisk(
  riders: Rider[],
): Record<RiskTier, Rider[]> {
  const out: Record<RiskTier, Rider[]> = { low: [], medium: [], high: [] }
  for (const r of riders) out[computeRiderRisk(r).tier].push(r)
  return out
}

// ============================================================================
// STATISTICS
// ============================================================================

export type RiderStats = {
  total: number
  active: number
  suspended: number
  ninPending: number
  verified: number
  unverified: number
  totalWallet: number
  avgWallet: number
  totalRides: number
  avgRides: number
  avgRating: number
  highRatingCount: number
  lowRatingCount: number
  newRiders: number
  loyalRiders: number
  dormantRiders: number
}

export function computeRiderStats(riders: Rider[]): RiderStats {
  const total = riders.length
  let active = 0
  let suspended = 0
  let ninPending = 0
  let verified = 0
  let totalWallet = 0
  let totalRides = 0
  let totalRating = 0
  let highRatingCount = 0
  let lowRatingCount = 0
  let newRiders = 0
  let loyalRiders = 0
  let dormantRiders = 0

  for (const r of riders) {
    if (r.status === 'active') active += 1
    else if (r.status === 'suspended') suspended += 1
    else ninPending += 1
    if (isValidNin(r.nin)) verified += 1
    totalWallet += r.walletBalance
    totalRides += r.totalRides
    totalRating += r.rating
    if (r.rating >= 4.5) highRatingCount += 1
    if (r.rating < LOW_RATING_THRESHOLD && r.totalRides >= 3) lowRatingCount += 1
    const lc = computeLifecycle(r).stage
    if (lc === 'new') newRiders += 1
    else if (lc === 'loyal') loyalRiders += 1
    else if (lc === 'dormant' || lc === 'churned') dormantRiders += 1
  }

  return {
    total,
    active,
    suspended,
    ninPending,
    verified,
    unverified: total - verified,
    totalWallet,
    avgWallet: total > 0 ? Math.round(totalWallet / total) : 0,
    totalRides,
    avgRides: total > 0 ? Math.round(totalRides / total) : 0,
    avgRating: total > 0 ? Math.round((totalRating / total) * 100) / 100 : 0,
    highRatingCount,
    lowRatingCount,
    newRiders,
    loyalRiders,
    dormantRiders,
  }
}

export type CityBreakdownRow = {
  city: string
  count: number
  share: number
  totalWallet: number
  avgRating: number
  totalRides: number
}

export function computeCityBreakdown(riders: Rider[]): CityBreakdownRow[] {
  const total = riders.length || 1
  const map = new Map<
    string,
    { count: number; wallet: number; rating: number; rides: number }
  >()
  for (const r of riders) {
    let row = map.get(r.city)
    if (!row) {
      row = { count: 0, wallet: 0, rating: 0, rides: 0 }
      map.set(r.city, row)
    }
    row.count += 1
    row.wallet += r.walletBalance
    row.rating += r.rating
    row.rides += r.totalRides
  }
  return [...map.entries()]
    .map(([city, { count, wallet, rating, rides }]) => ({
      city,
      count,
      share: count / total,
      totalWallet: wallet,
      avgRating: count > 0 ? Math.round((rating / count) * 100) / 100 : 0,
      totalRides: rides,
    }))
    .sort((a, b) => b.count - a.count)
}

export type LeaderRow = {
  key: string
  label: string
  value: number
  count: number
  share: number
}

export function computeWalletLeaderboard(riders: Rider[]): LeaderRow[] {
  const rows = [...riders].sort((a, b) => b.walletBalance - a.walletBalance)
  const max = rows[0]?.walletBalance ?? 1
  return rows.map((r) => ({
    key: r.id,
    label: r.name,
    value: r.walletBalance,
    count: r.totalRides,
    share: max > 0 ? r.walletBalance / max : 0,
  }))
}

export function computeTopRiders(riders: Rider[], limit = 10): LeaderRow[] {
  const rows = [...riders].sort((a, b) => b.totalRides - a.totalRides)
  const max = rows[0]?.totalRides ?? 1
  return rows.slice(0, limit).map((r) => ({
    key: r.id,
    label: r.name,
    value: r.totalRides,
    count: r.totalRides,
    share: max > 0 ? r.totalRides / max : 0,
  }))
}

export function computeTopRated(riders: Rider[], limit = 10): LeaderRow[] {
  const rows = [...riders]
    .filter((r) => r.totalRides >= 3)
    .sort((a, b) => b.rating - a.rating)
  return rows.slice(0, limit).map((r) => ({
    key: r.id,
    label: r.name,
    value: r.rating,
    count: r.totalRides,
    share: r.rating / 5,
  }))
}

// ============================================================================
// TRIP ANALYTICS
// ============================================================================

export type TripStats = {
  total: number
  completed: number
  cancelled: number
  inProgress: number
  totalFare: number
  avgFare: number
  completionRate: number
  cancelRate: number
  avgRating: number
  ratedCount: number
}

export function computeTripStats(trips: RiderTrip[]): TripStats {
  let completed = 0
  let cancelled = 0
  let inProgress = 0
  let totalFare = 0
  let totalRating = 0
  let ratedCount = 0

  for (const t of trips) {
    if (t.status === 'completed') {
      completed += 1
      totalFare += t.fare
      if (t.rating != null) {
        totalRating += t.rating
        ratedCount += 1
      }
    } else if (t.status === 'cancelled') cancelled += 1
    else inProgress += 1
  }

  const total = trips.length || 1
  return {
    total: trips.length,
    completed,
    cancelled,
    inProgress,
    totalFare,
    avgFare: completed > 0 ? Math.round(totalFare / completed) : 0,
    completionRate: completed / total,
    cancelRate: cancelled / total,
    avgRating: ratedCount > 0 ? Math.round((totalRating / ratedCount) * 100) / 100 : 0,
    ratedCount,
  }
}

export type TripSortField = 'completedAt' | 'fare' | 'rating'

export function sortTrips(
  trips: RiderTrip[],
  field: TripSortField = 'completedAt',
  dir: SortDir = 'desc',
): RiderTrip[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...trips].sort((a, b) => {
    if (field === 'completedAt') {
      return (Date.parse(a.completedAt) - Date.parse(b.completedAt)) * mul
    }
    const av = (a[field] ?? 0) as number
    const bv = (b[field] ?? 0) as number
    return (av - bv) * mul
  })
}

export function filterTrips(
  trips: RiderTrip[],
  filters: {
    statuses?: RiderTrip['status'][]
    minFare?: number
    maxFare?: number
    minRating?: number
    search?: string
  },
): RiderTrip[] {
  const statusSet = filters.statuses?.length ? new Set(filters.statuses) : null
  const q = filters.search?.trim().toLowerCase() ?? ''
  return trips.filter((t) => {
    if (statusSet && !statusSet.has(t.status)) return false
    if (typeof filters.minFare === 'number' && t.fare < filters.minFare) return false
    if (typeof filters.maxFare === 'number' && t.fare > filters.maxFare) return false
    if (typeof filters.minRating === 'number' && (t.rating ?? 0) < filters.minRating) return false
    if (q) {
      const haystack = [t.rideId, t.driverName, t.pickup, t.destination]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

// ============================================================================
// WALLET ANALYTICS
// ============================================================================

export type WalletStats = {
  totalCredits: number
  totalDebits: number
  netFlow: number
  transactionCount: number
  avgCredit: number
  avgDebit: number
  byCategory: Record<WalletTransaction['category'], { count: number; amount: number }>
}

export function computeWalletStats(
  txns: WalletTransaction[],
): WalletStats {
  const byCategory = (
    ['funding', 'ride_payment', 'refund', 'tip', 'cancellation'] as const
  ).reduce(
    (acc, c) => {
      acc[c] = { count: 0, amount: 0 }
      return acc
    },
    {} as WalletStats['byCategory'],
  )

  let totalCredits = 0
  let totalDebits = 0
  let creditCount = 0
  let debitCount = 0

  for (const t of txns) {
    byCategory[t.category].count += 1
    byCategory[t.category].amount += t.amount
    if (t.type === 'credit') {
      totalCredits += t.amount
      creditCount += 1
    } else {
      totalDebits += t.amount
      debitCount += 1
    }
  }

  return {
    totalCredits,
    totalDebits,
    netFlow: totalCredits - totalDebits,
    transactionCount: txns.length,
    avgCredit: creditCount > 0 ? Math.round(totalCredits / creditCount) : 0,
    avgDebit: debitCount > 0 ? Math.round(totalDebits / debitCount) : 0,
    byCategory,
  }
}

export function filterTransactions(
  txns: WalletTransaction[],
  filters: {
    types?: WalletTransaction['type'][]
    categories?: WalletTransaction['category'][]
    minAmount?: number
    maxAmount?: number
    search?: string
  },
): WalletTransaction[] {
  const typeSet = filters.types?.length ? new Set(filters.types) : null
  const catSet = filters.categories?.length ? new Set(filters.categories) : null
  const q = filters.search?.trim().toLowerCase() ?? ''
  return txns.filter((t) => {
    if (typeSet && !typeSet.has(t.type)) return false
    if (catSet && !catSet.has(t.category)) return false
    if (typeof filters.minAmount === 'number' && t.amount < filters.minAmount) return false
    if (typeof filters.maxAmount === 'number' && t.amount > filters.maxAmount) return false
    if (q && !t.description.toLowerCase().includes(q)) return false
    return true
  })
}

export function computeBalanceTrend(txns: WalletTransaction[]): number[] {
  const sorted = [...txns].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  )
  return sorted.map((t) => t.balanceAfter)
}

// ============================================================================
// SUPPORT ANALYTICS
// ============================================================================

export type SupportStats = {
  total: number
  open: number
  inProgress: number
  resolved: number
  closed: number
  urgentOpen: number
  slaBreached: number
  avgResolutionHours: number
  byCategory: Record<SupportTicket['category'], number>
  byPriority: Record<SupportTicket['priority'], number>
}

export function computeSupportStats(tickets: SupportTicket[]): SupportStats {
  const byCategory = (['ride', 'payment', 'driver', 'account', 'safety', 'other'] as const).reduce(
    (acc, c) => {
      acc[c] = 0
      return acc
    },
    {} as Record<SupportTicket['category'], number>,
  )
  const byPriority = (['low', 'normal', 'high', 'urgent'] as const).reduce(
    (acc, p) => {
      acc[p] = 0
      return acc
    },
    {} as Record<SupportTicket['priority'], number>,
  )

  let open = 0
  let inProgress = 0
  let resolved = 0
  let closed = 0
  let urgentOpen = 0
  let slaBreached = 0
  let totalResolutionHours = 0
  let resolutionCount = 0

  for (const t of tickets) {
    if (t.status === 'open') open += 1
    else if (t.status === 'in_progress') inProgress += 1
    else if (t.status === 'resolved') resolved += 1
    else closed += 1
    byCategory[t.category] += 1
    byPriority[t.priority] += 1

    const isOpen = t.status === 'open' || t.status === 'in_progress'
    if (isOpen && t.priority === 'urgent') urgentOpen += 1

    const hoursOpen =
      (Date.now() - Date.parse(t.createdAt)) / (60 * 60 * 1000)
    if (isOpen && hoursOpen > SLA_HOURS) slaBreached += 1

    if (t.status === 'resolved' || t.status === 'closed') {
      totalResolutionHours +=
        (Date.parse(t.updatedAt) - Date.parse(t.createdAt)) / (60 * 60 * 1000)
      resolutionCount += 1
    }
  }

  return {
    total: tickets.length,
    open,
    inProgress,
    resolved,
    closed,
    urgentOpen,
    slaBreached,
    avgResolutionHours:
      resolutionCount > 0
        ? Math.round((totalResolutionHours / resolutionCount) * 10) / 10
        : 0,
    byCategory,
    byPriority,
  }
}

export function filterTickets(
  tickets: SupportTicket[],
  filters: {
    statuses?: SupportTicket['status'][]
    priorities?: SupportTicket['priority'][]
    categories?: SupportTicket['category'][]
    onlyBreached?: boolean
    search?: string
  },
): SupportTicket[] {
  const statusSet = filters.statuses?.length ? new Set(filters.statuses) : null
  const prioritySet = filters.priorities?.length ? new Set(filters.priorities) : null
  const catSet = filters.categories?.length ? new Set(filters.categories) : null
  const q = filters.search?.trim().toLowerCase() ?? ''

  return tickets.filter((t) => {
    if (statusSet && !statusSet.has(t.status)) return false
    if (prioritySet && !prioritySet.has(t.priority)) return false
    if (catSet && !catSet.has(t.category)) return false
    if (filters.onlyBreached) {
      const isOpen = t.status === 'open' || t.status === 'in_progress'
      const hoursOpen = (Date.now() - Date.parse(t.createdAt)) / (60 * 60 * 1000)
      if (!isOpen || hoursOpen <= SLA_HOURS) return false
    }
    if (q) {
      const haystack = [t.subject, t.lastMessage, t.category].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function isSlaBreached(ticket: SupportTicket): boolean {
  const isOpen = ticket.status === 'open' || ticket.status === 'in_progress'
  if (!isOpen) return false
  const hoursOpen = (Date.now() - Date.parse(ticket.createdAt)) / (60 * 60 * 1000)
  return hoursOpen > SLA_HOURS
}

// ============================================================================
// UNIFIED ACTIVITY FEED
// ============================================================================

export type ActivityKind = 'trip' | 'wallet' | 'ticket' | 'note'

export type ActivityItem = {
  id: string
  at: number
  kind: ActivityKind
  title: string
  meta?: string
  tone: 'success' | 'danger' | 'warning' | 'info' | 'default'
}

export type AdminNote = {
  id: string
  body: string
  createdAt: number
  author: string
}

export function buildActivityFeed(input: {
  trips: RiderTrip[]
  walletTxns: WalletTransaction[]
  tickets: SupportTicket[]
  notes: AdminNote[]
}): ActivityItem[] {
  const { trips, walletTxns, tickets, notes } = input
  const items: ActivityItem[] = []

  for (const t of trips) {
    items.push({
      id: `trip-${t.id}`,
      at: Date.parse(t.completedAt),
      kind: 'trip',
      title: `Ride #${t.rideId.replace('rd_', '')} · ${t.status.replace('_', ' ')}`,
      meta: `with ${t.driverName} · ${formatNaira(t.fare)}`,
      tone:
        t.status === 'completed'
          ? 'success'
          : t.status === 'cancelled'
            ? 'default'
            : 'info',
    })
  }
  for (const w of walletTxns) {
    items.push({
      id: `w-${w.id}`,
      at: Date.parse(w.createdAt),
      kind: 'wallet',
      title: `${w.type === 'credit' ? '+' : '-'}${formatNaira(w.amount)} · ${w.description}`,
      meta: `Balance ${formatNaira(w.balanceAfter)}`,
      tone: w.type === 'credit' ? 'success' : 'warning',
    })
  }
  for (const t of tickets) {
    items.push({
      id: `t-${t.id}`,
      at: Date.parse(t.createdAt),
      kind: 'ticket',
      title: `Ticket: ${t.subject}`,
      meta: `${TICKET_STATUS_META[t.status].label} · ${TICKET_PRIORITY_META[t.priority].label}`,
      tone: t.status === 'resolved' ? 'success' : t.status === 'closed' ? 'default' : 'danger',
    })
  }
  for (const n of notes) {
    items.push({
      id: `n-${n.id}`,
      at: n.createdAt,
      kind: 'note',
      title: 'Admin note',
      meta: n.body.slice(0, 80),
      tone: 'info',
    })
  }
  return items.sort((a, b) => b.at - a.at)
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export type RiderAnomalyType =
  | 'high_wallet'
  | 'low_rating'
  | 'nin_pending'
  | 'new_no_rides'
  | 'dormant'
  | 'high_cancel_rate'
  | 'sla_breached'

export type RiderAnomaly = {
  id: string
  type: RiderAnomalyType
  severity: 'critical' | 'high' | 'medium' | 'low'
  message: string
}

export function detectRiderAnomalies(
  rider: Rider,
  tickets: SupportTicket[] = [],
  trips: RiderTrip[] = [],
): RiderAnomaly[] {
  const out: RiderAnomaly[] = []
  const lc = computeLifecycle(rider)

  if (rider.walletBalance >= HIGH_WALLET_THRESHOLD) {
    out.push({
      id: `hw-${rider.id}`,
      type: 'high_wallet',
      severity: 'medium',
      message: `High wallet balance: ${formatNaira(rider.walletBalance)}`,
    })
  }
  if (rider.rating < LOW_RATING_THRESHOLD && rider.totalRides >= 3) {
    out.push({
      id: `lr-${rider.id}`,
      type: 'low_rating',
      severity: 'high',
      message: `Low rating: ${rider.rating.toFixed(1)}★ across ${rider.totalRides} rides`,
    })
  }
  if (rider.status === 'nin_pending' || !isValidNin(rider.nin)) {
    out.push({
      id: `np-${rider.id}`,
      type: 'nin_pending',
      severity: 'high',
      message: 'NIN verification incomplete',
    })
  }
  if (lc.stage === 'new' && rider.totalRides === 0) {
    out.push({
      id: `nn-${rider.id}`,
      type: 'new_no_rides',
      severity: 'low',
      message: `New rider, no rides yet (joined ${lc.daysSinceJoined}d ago)`,
    })
  }
  if (lc.stage === 'dormant' || lc.stage === 'churned') {
    out.push({
      id: `dm-${rider.id}`,
      type: 'dormant',
      severity: 'medium',
      message: `Dormant ${lc.daysSinceJoined}d with ${rider.totalRides} rides`,
    })
  }
  if (trips.length >= 4) {
    const stats = computeTripStats(trips)
    if (stats.cancelRate >= 0.3) {
      out.push({
        id: `cr-${rider.id}`,
        type: 'high_cancel_rate',
        severity: 'high',
        message: `Cancel rate ${Math.round(stats.cancelRate * 100)}%`,
      })
    }
  }
  const breached = tickets.filter(isSlaBreached).length
  if (breached > 0) {
    out.push({
      id: `sla-${rider.id}`,
      type: 'sla_breached',
      severity: 'critical',
      message: `${breached} SLA-breached ticket${breached === 1 ? '' : 's'}`,
    })
  }
  return out
}

// ============================================================================
// DIFF
// ============================================================================

export type RiderFieldDiff = {
  field: keyof Rider
  before: string
  after: string
}

export function diffRiders(a: Rider, b: Rider): RiderFieldDiff[] {
  const fields: (keyof Rider)[] = [
    'name', 'phone', 'email', 'city', 'walletBalance', 'totalRides',
    'rating', 'status', 'joinedAt', 'nin',
  ]
  const out: RiderFieldDiff[] = []
  for (const f of fields) {
    const av = String(a[f] ?? '')
    const bv = String(b[f] ?? '')
    if (av !== bv) out.push({ field: f, before: av, after: bv })
  }
  return out
}

// ============================================================================
// PII REDACTION
// ============================================================================

const PII_PATTERNS: { regex: RegExp; replacement: string }[] = [
  { regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[email]' },
  { regex: /\b(?:\+?234|0)[789]\d{9}\b/g, replacement: '[phone]' },
  { regex: /\b\d{11}\b/g, replacement: '[nin]' },
]

export function redactPII(value: string): string {
  let out = value
  for (const p of PII_PATTERNS) out = out.replace(p.regex, p.replacement)
  return out
}

// ============================================================================
// EXPORT
// ============================================================================

const RIDER_CSV_HEADERS = [
  'id', 'name', 'phone', 'email', 'city',
  'walletBalance', 'totalRides', 'rating', 'status', 'joinedAt', 'nin',
] as const

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

export function ridersToCSV(
  riders: Rider[],
  options: { redact?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const lines: string[] = [RIDER_CSV_HEADERS.join(',')]
  for (const r of riders) {
    const row = RIDER_CSV_HEADERS.map((h) => {
      const raw = String(r[h] ?? '')
      return escapeCSV(redact ? redactPII(raw) : raw)
    })
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function ridersToJSON(
  riders: Rider[],
  options: { redact?: boolean; pretty?: boolean; includeRisk?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const includeRisk = options.includeRisk ?? true
  const payload = riders.map((r) => {
    const base: Record<string, unknown> = { ...r }
    if (redact) {
      base.phone = '[phone]'
      base.email = '[email]'
      base.nin = r.nin ? '[nin]' : null
    }
    if (includeRisk) {
      base.risk = computeRiderRisk(r)
      base.lifecycle = computeLifecycle(r)
    }
    return base
  })
  const wrapper = {
    generatedAt: new Date().toISOString(),
    count: riders.length,
    stats: computeRiderStats(riders),
    riders: payload,
  }
  return options.pretty === false
    ? JSON.stringify(wrapper)
    : JSON.stringify(wrapper, null, 2)
}

export function estimateExportSize(
  riders: Rider[],
  format: 'csv' | 'json',
): number {
  const body =
    format === 'csv'
      ? ridersToCSV(riders)
      : ridersToJSON(riders, { pretty: false })
  return new TextEncoder().encode(body).byteLength
}

// ============================================================================
// PAGINATION
// ============================================================================

export type Page<T> = {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function paginate<T>(items: T[], page = 1, pageSize = 25): Page<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    items: items.slice(start, start + pageSize),
    total,
    page: safePage,
    pageSize,
    totalPages,
    hasNext: safePage < totalPages,
    hasPrev: safePage > 1,
  }
}

// ============================================================================
// NOTES — per-rider admin notes
// ============================================================================

const NOTES_KEY_PREFIX = 'hr.rider.notes.'

export function loadRiderNotes(riderId: string): AdminNote[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY_PREFIX + riderId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

export function persistRiderNotes(riderId: string, notes: AdminNote[]): void {
  try {
    window.localStorage.setItem(NOTES_KEY_PREFIX + riderId, JSON.stringify(notes))
  } catch {
    /* storage unavailable */
  }
}

export function clearRiderNotes(riderId: string): void {
  try {
    window.localStorage.removeItem(NOTES_KEY_PREFIX + riderId)
  } catch {
    /* storage unavailable */
  }
}

// ============================================================================
// MUTATIONS — beyond suspend/reinstate
// ============================================================================

export type BulkResult = {
  succeeded: string[]
  failed: { id: string; error: string }[]
}

export async function suspendRiderBulk(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] }
  for (const id of ids) {
    try {
      await suspendRiderApi(id)
      result.succeeded.push(id)
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
  return result
}

export async function reinstateRiderBulk(ids: string[]): Promise<BulkResult> {
  const result: BulkResult = { succeeded: [], failed: [] }
  for (const id of ids) {
    try {
      await reinstateRiderApi(id)
      result.succeeded.push(id)
    } catch (err) {
      result.failed.push({
        id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
  return result
}

export async function verifyNinApi(id: string, nin: string): Promise<void> {
  if (!isValidNin(nin)) throw new Error('NIN must be 11 digits')
  await new Promise((r) => setTimeout(r, 600))
  store = store.map((r) =>
    r.id === id
      ? { ...r, nin, status: r.status === 'nin_pending' ? 'active' : r.status }
      : r,
  )
}

export async function adjustWalletApi(
  id: string,
  delta: number,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 500))
  store = store.map((r) =>
    r.id === id
      ? { ...r, walletBalance: Math.max(0, r.walletBalance + delta) }
      : r,
  )
}

export function getRiderSnapshot(): Rider[] {
  return store.map((r) => ({ ...r }))
}

export function resetRiderStore(): void {
  store = INITIAL.map((r) => ({ ...r }))
  _cache.clear()
}

// ============================================================================
// CACHED FETCH LAYER
// ============================================================================

type CacheSlot<T> = { at: number; data: T }
const _cache = new Map<string, CacheSlot<unknown>>()

export async function fetchRidersCached(options: {
  force?: boolean
  ttlMs?: number
} = {}): Promise<Rider[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'riders:list'
  const hit = _cache.get(key) as CacheSlot<Rider[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) {
    return hit.data.map((r) => ({ ...r }))
  }
  const data = await fetchRiders()
  _cache.set(key, { at: Date.now(), data })
  return data
}

export async function fetchRiderCached(id: string, options: {
  force?: boolean
  ttlMs?: number
} = {}): Promise<Rider> {
  const { force = true, ttlMs = 0 } = options
  const key = `riders:${id}`
  const hit = _cache.get(key) as CacheSlot<Rider> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) {
    return { ...hit.data }
  }
  const data = await fetchRider(id)
  _cache.set(key, { at: Date.now(), data })
  return data
}

export function clearRiderCache(): void {
  _cache.clear()
}