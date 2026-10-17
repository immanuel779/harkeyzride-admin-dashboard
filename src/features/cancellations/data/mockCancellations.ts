export type CancellationBy = 'rider' | 'driver' | 'system'
export type CancellationReason =
  | 'rider_changed_mind'
  | 'driver_too_far'
  | 'driver_no_show'
  | 'rider_no_show'
  | 'no_driver_found'
  | 'safety_concern'
  | 'other'

export type GraceStatus = 'within_grace' | 'after_grace' | 'waived'

export type CancellationEntry = {
  id: string
  rideId: string
  riderName: string
  driverName: string
  cancelledBy: CancellationBy
  reason: CancellationReason
  graceStatus: GraceStatus
  fee: number
  minutesElapsed: number
  cancelledAt: string
  overriddenBy: string | null
  overriddenAt: string | null
  overrideNote: string | null
}
import { api } from '../../../lib/apiClient'
import {
  unwrapList,
  type BackendAuditLog,
} from '../../../services/adapters'
export type CancellationSnapshot = {
  penaltiesToday: number
  penaltiesAmount: number
  waiversToday: number
  disputed: number
  driverCancels: number
  currency: string
}

export const MOCK_SNAPSHOT: CancellationSnapshot = {
  penaltiesToday: 18,
  penaltiesAmount: 3600,
  waiversToday: 4,
  disputed: 2,
  driverCancels: 3,
  currency: '₦',
}

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

export const REASON_LABELS: Record<CancellationReason, string> = {
  rider_changed_mind: 'Rider changed mind',
  driver_too_far: 'Driver too far',
  driver_no_show: 'Driver no-show',
  rider_no_show: 'Rider no-show',
  no_driver_found: 'No driver found',
  safety_concern: 'Safety concern',
  other: 'Other',
}

const INITIAL: CancellationEntry[] = [
  { id: 'c1', rideId: 'rd_4821', riderName: 'Seyi Ariyo', driverName: 'John Smith', cancelledBy: 'rider', reason: 'rider_changed_mind', graceStatus: 'after_grace', fee: 200, minutesElapsed: 6, cancelledAt: minutesAgo(8), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c2', rideId: 'rd_4819', riderName: 'Bola Ariyo', driverName: 'Ahmed Bello', cancelledBy: 'rider', reason: 'rider_changed_mind', graceStatus: 'within_grace', fee: 0, minutesElapsed: 2, cancelledAt: minutesAgo(22), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c3', rideId: 'rd_4816', riderName: 'Grace Nwosu', driverName: 'Musa Ibrahim', cancelledBy: 'driver', reason: 'driver_no_show', graceStatus: 'after_grace', fee: 0, minutesElapsed: 8, cancelledAt: minutesAgo(41), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c4', rideId: 'rd_4812', riderName: 'Tunde Bakare', driverName: 'Kunle Adebayo', cancelledBy: 'rider', reason: 'safety_concern', graceStatus: 'after_grace', fee: 200, minutesElapsed: 5, cancelledAt: minutesAgo(58), overriddenBy: 'Damilare Opeyemi', overriddenAt: minutesAgo(45), overrideNote: 'Verified safety concern — penalty waived' },
  { id: 'c5', rideId: 'rd_4808', riderName: 'Yusuf Adeleke', driverName: 'Emeka Okafor', cancelledBy: 'rider', reason: 'driver_too_far', graceStatus: 'after_grace', fee: 200, minutesElapsed: 7, cancelledAt: minutesAgo(95), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c6', rideId: 'rd_4805', riderName: 'Chidinma Okoye', driverName: '—', cancelledBy: 'system', reason: 'no_driver_found', graceStatus: 'within_grace', fee: 0, minutesElapsed: 0, cancelledAt: minutesAgo(120), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c7', rideId: 'rd_4801', riderName: 'Ibrahim Sule', driverName: 'Femi Akinyemi', cancelledBy: 'rider', reason: 'rider_changed_mind', graceStatus: 'after_grace', fee: 200, minutesElapsed: 12, cancelledAt: minutesAgo(180), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c8', rideId: 'rd_4798', riderName: 'Funke Adeyemi', driverName: 'Segun Oladipo', cancelledBy: 'driver', reason: 'driver_no_show', graceStatus: 'after_grace', fee: 0, minutesElapsed: 9, cancelledAt: minutesAgo(240), overriddenBy: null, overriddenAt: null, overrideNote: null },
  { id: 'c9', rideId: 'rd_4795', riderName: 'Grace Nwosu', driverName: 'John Smith', cancelledBy: 'rider', reason: 'rider_no_show', graceStatus: 'after_grace', fee: 200, minutesElapsed: 10, cancelledAt: minutesAgo(310), overriddenBy: 'Oladayo Ayomide', overriddenAt: minutesAgo(280), overrideNote: 'Rider reported network issue — waived once' },
  { id: 'c10', rideId: 'rd_4790', riderName: 'Seyi Ariyo', driverName: 'Musa Ibrahim', cancelledBy: 'rider', reason: 'other', graceStatus: 'within_grace', fee: 0, minutesElapsed: 3, cancelledAt: minutesAgo(420), overriddenBy: null, overriddenAt: null, overrideNote: null },
]

// ---------- Mutable in-memory store ----------

let store: CancellationEntry[] = INITIAL.map((c) => ({ ...c }))
export const MOCK_CANCELLATIONS: CancellationEntry[] = INITIAL.map((c) => ({ ...c }))

// ============================================================================
// METADATA — canonical lists, labels, severities, defaults
// ============================================================================

export const ALL_CANCELLATION_BY: CancellationBy[] = ['rider', 'driver', 'system']

export const ALL_REASONS: CancellationReason[] = [
  'rider_changed_mind',
  'driver_too_far',
  'driver_no_show',
  'rider_no_show',
  'no_driver_found',
  'safety_concern',
  'other',
]

export const ALL_GRACE_STATUSES: GraceStatus[] = ['within_grace', 'after_grace', 'waived']

export type CancellationSeverity = 'critical' | 'high' | 'medium' | 'low'

export const SEVERITY_ORDER: Record<CancellationSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export const REASON_META: Record<
  CancellationReason,
  {
    label: string
    icon: string
    severity: CancellationSeverity
    tone: string
    category: 'rider' | 'driver' | 'system' | 'safety'
    defaultFee: number
    chargeableTo: CancellationBy
    description: string
  }
> = {
  rider_changed_mind: {
    label: 'Rider changed mind',
    icon: 'user-x',
    severity: 'low',
    tone: 'slate',
    category: 'rider',
    defaultFee: 200,
    chargeableTo: 'rider',
    description: 'Rider initiated cancellation after the grace window',
  },
  driver_too_far: {
    label: 'Driver too far',
    icon: 'map-pin-off',
    severity: 'low',
    tone: 'slate',
    category: 'rider',
    defaultFee: 0,
    chargeableTo: 'rider',
    description: 'Rider cancelled because the assigned driver was too far',
  },
  driver_no_show: {
    label: 'Driver no-show',
    icon: 'user-x',
    severity: 'high',
    tone: 'red',
    category: 'driver',
    defaultFee: 0,
    chargeableTo: 'driver',
    description: 'Driver failed to arrive — rider must not be penalised',
  },
  rider_no_show: {
    label: 'Rider no-show',
    icon: 'user-x',
    severity: 'medium',
    tone: 'amber',
    category: 'rider',
    defaultFee: 200,
    chargeableTo: 'rider',
    description: 'Rider did not appear within the pickup window',
  },
  no_driver_found: {
    label: 'No driver found',
    icon: 'search-x',
    severity: 'low',
    tone: 'slate',
    category: 'system',
    defaultFee: 0,
    chargeableTo: 'system',
    description: 'System cancelled — no available driver matched the request',
  },
  safety_concern: {
    label: 'Safety concern',
    icon: 'shield-alert',
    severity: 'critical',
    tone: 'red',
    category: 'safety',
    defaultFee: 0,
    chargeableTo: 'system',
    description: 'Safety-driven cancellation — always waived on verification',
  },
  other: {
    label: 'Other',
    icon: 'more-horizontal',
    severity: 'low',
    tone: 'slate',
    category: 'system',
    defaultFee: 0,
    chargeableTo: 'system',
    description: 'Catch-all for uncategorised cancellations',
  },
}

export const BY_META: Record<
  CancellationBy,
  { label: string; tone: 'danger' | 'warning' | 'neutral'; color: string }
> = {
  rider: { label: 'Rider', tone: 'warning', color: '#f59e0b' },
  driver: { label: 'Driver', tone: 'danger', color: '#ef4444' },
  system: { label: 'System', tone: 'neutral', color: '#64748b' },
}

export const GRACE_META: Record<
  GraceStatus,
  { label: string; tone: 'success' | 'danger' | 'info'; description: string }
> = {
  within_grace: {
    label: 'Within grace',
    tone: 'success',
    description: 'Cancelled inside the grace window — no fee assessed',
  },
  after_grace: {
    label: 'After grace',
    tone: 'danger',
    description: 'Cancelled after the grace window — fee may apply',
  },
  waived: {
    label: 'Waived',
    tone: 'info',
    description: 'Fee reversed by an administrator',
  },
}

// ============================================================================
// GUARDS
// ============================================================================

export function isCancellationBy(value: unknown): value is CancellationBy {
  return typeof value === 'string' && ALL_CANCELLATION_BY.includes(value as CancellationBy)
}

export function isCancellationReason(value: unknown): value is CancellationReason {
  return typeof value === 'string' && ALL_REASONS.includes(value as CancellationReason)
}

export function isGraceStatus(value: unknown): value is GraceStatus {
  return typeof value === 'string' && ALL_GRACE_STATUSES.includes(value as GraceStatus)
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateCancellationEntry(entry: Partial<CancellationEntry>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!entry.id) errors.push('id is required')
  if (!entry.rideId) errors.push('rideId is required')
  if (!entry.riderName) errors.push('riderName is required')
  if (!entry.driverName) errors.push('driverName is required')
  if (!isCancellationBy(entry.cancelledBy)) errors.push('cancelledBy is invalid')
  if (!isCancellationReason(entry.reason)) errors.push('reason is invalid')
  if (!isGraceStatus(entry.graceStatus)) errors.push('graceStatus is invalid')
  if (typeof entry.fee !== 'number' || entry.fee < 0) errors.push('fee must be a non-negative number')
  if (typeof entry.minutesElapsed !== 'number' || entry.minutesElapsed < 0) {
    errors.push('minutesElapsed must be a non-negative number')
  }
  if (!entry.cancelledAt) errors.push('cancelledAt is required')
  else if (Number.isNaN(Date.parse(entry.cancelledAt))) {
    errors.push('cancelledAt must be a valid ISO date')
  }
  return { valid: errors.length === 0, errors }
}

// ============================================================================
// BUSINESS RULES
// ============================================================================

export const DEFAULT_GRACE_MINUTES = 5
export const DEFAULT_PENALTY_FEE = 200
export const HIGH_FEE_THRESHOLD = 500
export const REPEAT_OFFENDER_THRESHOLD = 2
export const REPEAT_WINDOW_DAYS = 7

export function isWithinGrace(
  minutesElapsed: number,
  graceMinutes: number = DEFAULT_GRACE_MINUTES,
): boolean {
  return minutesElapsed <= graceMinutes
}

/**
 * Calculate what the penalty *should* be based on platform rules.
 * Does not modify any data — a pure decision helper for the UI / API.
 */
export function calculatePenalty(input: {
  reason: CancellationReason
  cancelledBy: CancellationBy
  minutesElapsed: number
  graceMinutes?: number
}): { fee: number; waived: boolean; why: string } {
  const graceMinutes = input.graceMinutes ?? DEFAULT_GRACE_MINUTES
  const meta = REASON_META[input.reason]

  // Safety and system reasons are always free
  if (meta.category === 'safety') {
    return { fee: 0, waived: true, why: 'Safety cancellations are always waived' }
  }
  if (input.cancelledBy === 'system') {
    return { fee: 0, waived: true, why: 'System cancellations carry no rider fee' }
  }
  if (input.cancelledBy === 'driver') {
    return { fee: 0, waived: true, why: 'Driver-caused cancellations never penalise the rider' }
  }
  if (isWithinGrace(input.minutesElapsed, graceMinutes)) {
    return {
      fee: 0,
      waived: true,
      why: `Cancelled within ${graceMinutes}-minute grace window`,
    }
  }
  if (meta.defaultFee === 0) {
    return { fee: 0, waived: true, why: 'This reason carries no penalty' }
  }
  return {
    fee: meta.defaultFee,
    waived: false,
    why: `Rider cancelled after ${graceMinutes}-minute grace (${input.minutesElapsed}m elapsed)`,
  }
}

/**
 * Suggest whether an existing entry should be auto-waived.
 * Useful for surfacing "auto-candidate" suggestions in the review queue.
 */
export function shouldAutoWaive(entry: CancellationEntry): {
  waive: boolean
  why: string
} {
  if (entry.overriddenBy) return { waive: false, why: 'Already waived' }
  if (entry.fee === 0) return { waive: false, why: 'No fee to waive' }
  if (entry.reason === 'safety_concern') {
    return { waive: true, why: 'Safety concern — policy mandates waiver' }
  }
  if (entry.reason === 'driver_no_show') {
    return { waive: true, why: 'Driver no-show — rider is not at fault' }
  }
  if (entry.graceStatus === 'within_grace') {
    return { waive: true, why: 'Cancelled inside the grace window' }
  }
  return { waive: false, why: 'Does not meet auto-waive criteria' }
}

export function suggestWaiveReason(entry: CancellationEntry): string {
  if (entry.reason === 'safety_concern') return 'Safety concern — policy waiver'
  if (entry.reason === 'driver_no_show') return 'Driver no-show — rider not at fault'
  if (entry.graceStatus === 'within_grace') return 'Cancelled within grace window'
  return 'Admin-reviewed waiver'
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatNaira(amount: number, currency = '₦'): string {
  return `${currency}${amount.toLocaleString()}`
}

export function formatFee(fee: number, currency = '₦'): string {
  return fee === 0 ? '—' : formatNaira(fee, currency)
}

export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
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

export function formatReason(reason: CancellationReason): string {
  return REASON_META[reason]?.label ?? REASON_LABELS[reason] ?? reason
}

export function formatCancelledBy(by: CancellationBy): string {
  return BY_META[by]?.label ?? by
}

export function formatGrace(status: GraceStatus): string {
  return GRACE_META[status]?.label ?? status
}

export function describeEntry(entry: CancellationEntry): string {
  const who = formatCancelledBy(entry.cancelledBy).toLowerCase()
  const what = formatReason(entry.reason).toLowerCase()
  return `#${entry.rideId.replace('rd_', '')} — ${entry.riderName} ${who}-cancelled (${what})`
}

export function severityOf(entry: CancellationEntry): CancellationSeverity {
  return REASON_META[entry.reason]?.severity ?? 'low'
}

export function isHighValue(entry: CancellationEntry): boolean {
  return entry.fee >= HIGH_FEE_THRESHOLD && !entry.overriddenBy
}

// ============================================================================
// FILTERING
// ============================================================================

export type CancellationFilters = {
  from?: string | null
  to?: string | null
  cancelledBy?: CancellationBy[]
  reasons?: CancellationReason[]
  graceStatuses?: GraceStatus[]
  severities?: CancellationSeverity[]
  onlyWaivable?: boolean
  onlyWaived?: boolean
  minFee?: number
  maxFee?: number
  search?: string
}

export function filterCancellations(
  entries: CancellationEntry[],
  filters: CancellationFilters,
): CancellationEntry[] {
  const bySet = filters.cancelledBy?.length ? new Set(filters.cancelledBy) : null
  const reasonSet = filters.reasons?.length ? new Set(filters.reasons) : null
  const graceSet = filters.graceStatuses?.length ? new Set(filters.graceStatuses) : null
  const sevSet = filters.severities?.length ? new Set(filters.severities) : null
  const q = filters.search?.trim().toLowerCase() ?? ''

  return entries.filter((e) => {
    if (filters.from && e.cancelledAt < filters.from) return false
    if (filters.to && e.cancelledAt > filters.to) return false
    if (bySet && !bySet.has(e.cancelledBy)) return false
    if (reasonSet && !reasonSet.has(e.reason)) return false
    if (graceSet && !graceSet.has(e.graceStatus)) return false
    if (sevSet && !sevSet.has(severityOf(e))) return false
    if (filters.onlyWaivable && !(e.fee > 0 && !e.overriddenBy)) return false
    if (filters.onlyWaived && !e.overriddenBy) return false
    if (typeof filters.minFee === 'number' && e.fee < filters.minFee) return false
    if (typeof filters.maxFee === 'number' && e.fee > filters.maxFee) return false
    if (q) {
      const haystack = [
        e.riderName,
        e.driverName,
        e.rideId,
        e.overrideNote ?? '',
        e.overriddenBy ?? '',
        e.reason,
        e.cancelledBy,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function searchCancellations(
  entries: CancellationEntry[],
  query: string,
): CancellationEntry[] {
  return filterCancellations(entries, { search: query })
}

// ============================================================================
// SORTING
// ============================================================================

export type SortField =
  | 'cancelledAt'
  | 'fee'
  | 'minutesElapsed'
  | 'riderName'
  | 'driverName'
  | 'reason'
  | 'cancelledBy'

export type SortDir = 'asc' | 'desc'

export function sortCancellations(
  entries: CancellationEntry[],
  field: SortField = 'cancelledAt',
  dir: SortDir = 'desc',
): CancellationEntry[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
    return String(av).localeCompare(String(bv)) * mul
  })
}

// ============================================================================
// GROUPING
// ============================================================================

export function groupByReason(
  entries: CancellationEntry[],
): Record<CancellationReason, CancellationEntry[]> {
  const out = ALL_REASONS.reduce<Record<CancellationReason, CancellationEntry[]>>(
    (acc, r) => {
      acc[r] = []
      return acc
    },
    {} as Record<CancellationReason, CancellationEntry[]>,
  )
  for (const e of entries) out[e.reason].push(e)
  return out
}

export function groupByCancelledBy(
  entries: CancellationEntry[],
): Record<CancellationBy, CancellationEntry[]> {
  const out = ALL_CANCELLATION_BY.reduce<Record<CancellationBy, CancellationEntry[]>>(
    (acc, b) => {
      acc[b] = []
      return acc
    },
    {} as Record<CancellationBy, CancellationEntry[]>,
  )
  for (const e of entries) out[e.cancelledBy].push(e)
  return out
}

export function groupByGraceStatus(
  entries: CancellationEntry[],
): Record<GraceStatus, CancellationEntry[]> {
  const out = ALL_GRACE_STATUSES.reduce<Record<GraceStatus, CancellationEntry[]>>(
    (acc, g) => {
      acc[g] = []
      return acc
    },
    {} as Record<GraceStatus, CancellationEntry[]>,
  )
  for (const e of entries) out[e.graceStatus].push(e)
  return out
}

export function groupByRider(entries: CancellationEntry[]): Record<string, CancellationEntry[]> {
  const out: Record<string, CancellationEntry[]> = {}
  for (const e of entries) {
    if (!out[e.riderName]) out[e.riderName] = []
    out[e.riderName].push(e)
  }
  return out
}

export function groupByDriver(entries: CancellationEntry[]): Record<string, CancellationEntry[]> {
  const out: Record<string, CancellationEntry[]> = {}
  for (const e of entries) {
    if (!out[e.driverName]) out[e.driverName] = []
    out[e.driverName].push(e)
  }
  return out
}

export function groupByDay(entries: CancellationEntry[]): Record<string, CancellationEntry[]> {
  const out: Record<string, CancellationEntry[]> = {}
  for (const e of entries) {
    const day = e.cancelledAt.slice(0, 10)
    if (!out[day]) out[day] = []
    out[day].push(e)
  }
  return out
}

// ============================================================================
// STATISTICS
// ============================================================================

export type CancellationStats = {
  total: number
  byReason: Record<CancellationReason, number>
  byCancelledBy: Record<CancellationBy, number>
  byGraceStatus: Record<GraceStatus, number>
  bySeverity: Record<CancellationSeverity, number>
  totalFeesAssessed: number
  totalFeesWaived: number
  totalFeesOutstanding: number
  waiveRate: number
  penaltyRate: number
  uniqueRiders: number
  uniqueDrivers: number
  highValueCount: number
  firstAt: string | null
  lastAt: string | null
}

export function computeCancellationStats(
  entries: CancellationEntry[],
): CancellationStats {
  const byReason = ALL_REASONS.reduce<Record<CancellationReason, number>>(
    (acc, r) => {
      acc[r] = 0
      return acc
    },
    {} as Record<CancellationReason, number>,
  )
  const byCancelledBy = ALL_CANCELLATION_BY.reduce<Record<CancellationBy, number>>(
    (acc, b) => {
      acc[b] = 0
      return acc
    },
    {} as Record<CancellationBy, number>,
  )
  const byGraceStatus = ALL_GRACE_STATUSES.reduce<Record<GraceStatus, number>>(
    (acc, g) => {
      acc[g] = 0
      return acc
    },
    {} as Record<GraceStatus, number>,
  )
  const bySeverity: Record<CancellationSeverity, number> = {
    critical: 0, high: 0, medium: 0, low: 0,
  }
  const riders = new Set<string>()
  const drivers = new Set<string>()
  let totalAssessed = 0
  let totalWaived = 0
  let totalOutstanding = 0
  let highValueCount = 0
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const e of entries) {
    byReason[e.reason] += 1
    byCancelledBy[e.cancelledBy] += 1
    byGraceStatus[e.graceStatus] += 1
    bySeverity[severityOf(e)] += 1
    riders.add(e.riderName)
    if (e.driverName && e.driverName !== '—') drivers.add(e.driverName)
    if (e.overriddenBy) {
      totalWaived += REASON_META[e.reason]?.defaultFee ?? DEFAULT_PENALTY_FEE
    } else if (e.fee > 0) {
      totalAssessed += e.fee
      totalOutstanding += e.fee
      if (e.fee >= HIGH_FEE_THRESHOLD) highValueCount += 1
    }
    if (!firstAt || e.cancelledAt < firstAt) firstAt = e.cancelledAt
    if (!lastAt || e.cancelledAt > lastAt) lastAt = e.cancelledAt
  }

  const total = entries.length
  const waivers = byGraceStatus.waived
  const waiveRate = total > 0 ? waivers / total : 0
  const penaltyRate = total > 0 ? totalOutstanding > 0 ? (totalAssessed > 0 ? 1 : 0) : 0 : 0

  return {
    total,
    byReason,
    byCancelledBy,
    byGraceStatus,
    bySeverity,
    totalFeesAssessed: totalAssessed,
    totalFeesWaived: totalWaived,
    totalFeesOutstanding: totalOutstanding,
    waiveRate,
    penaltyRate,
    uniqueRiders: riders.size,
    uniqueDrivers: drivers.size,
    highValueCount,
    firstAt,
    lastAt,
  }
}

export type ReasonBreakdownRow = {
  reason: CancellationReason
  label: string
  count: number
  share: number
  totalFees: number
  waivedCount: number
  severity: CancellationSeverity
}

export function computeReasonBreakdown(
  entries: CancellationEntry[],
): ReasonBreakdownRow[] {
  const total = entries.length || 1
  const map = new Map<CancellationReason, { count: number; totalFees: number; waived: number }>()
  for (const e of entries) {
    let row = map.get(e.reason)
    if (!row) {
      row = { count: 0, totalFees: 0, waived: 0 }
      map.set(e.reason, row)
    }
    row.count += 1
    if (e.overriddenBy) row.waived += 1
    else row.totalFees += e.fee
  }
  return [...map.entries()]
    .map(([reason, { count, totalFees, waived }]) => ({
      reason,
      label: formatReason(reason),
      count,
      share: count / total,
      totalFees,
      waivedCount: waived,
      severity: REASON_META[reason]?.severity ?? 'low',
    }))
    .sort((a, b) => b.count - a.count)
}

export type WhoBreakdownRow = {
  cancelledBy: CancellationBy
  label: string
  count: number
  share: number
}

export function computeWhoBreakdown(
  entries: CancellationEntry[],
): WhoBreakdownRow[] {
  const total = entries.length || 1
  const counts = ALL_CANCELLATION_BY.reduce<Record<CancellationBy, number>>(
    (acc, b) => {
      acc[b] = 0
      return acc
    },
    {} as Record<CancellationBy, number>,
  )
  for (const e of entries) counts[e.cancelledBy] += 1
  return ALL_CANCELLATION_BY.map((b) => ({
    cancelledBy: b,
    label: formatCancelledBy(b),
    count: counts[b],
    share: counts[b] / total,
  })).filter((r) => r.count > 0)
}

// ============================================================================
// RISK SCORING
// ============================================================================

export type RiderRiskRow = {
  riderName: string
  totalCancels: number
  feeBearingCancels: number
  waivedCancels: number
  totalFees: number
  lastAt: string
  riskScore: number
  isRepeatOffender: boolean
}

export function computeRiderRisk(
  entries: CancellationEntry[],
  options: {
    threshold?: number
    windowDays?: number
    now?: number
  } = {},
): RiderRiskRow[] {
  const threshold = options.threshold ?? REPEAT_OFFENDER_THRESHOLD
  const windowDays = options.windowDays ?? REPEAT_WINDOW_DAYS
  const now = options.now ?? Date.now()
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000

  const map = new Map<string, RiderRiskRow>()
  for (const e of entries) {
    let row = map.get(e.riderName)
    if (!row) {
      row = {
        riderName: e.riderName,
        totalCancels: 0,
        feeBearingCancels: 0,
        waivedCancels: 0,
        totalFees: 0,
        lastAt: e.cancelledAt,
        riskScore: 0,
        isRepeatOffender: false,
      }
      map.set(e.riderName, row)
    }
    row.totalCancels += 1
    if (e.overriddenBy) row.waivedCancels += 1
    else if (e.fee > 0) {
      row.feeBearingCancels += 1
      row.totalFees += e.fee
    }
    if (e.cancelledAt > row.lastAt) row.lastAt = e.cancelledAt
  }

  // Risk score: fee-bearing cancels weighted 2x, waived weighted 0.5x, + severity bonus
  for (const row of map.values()) {
    const recentCount = entries.filter(
      (e) => e.riderName === row.riderName && Date.parse(e.cancelledAt) >= cutoff,
    ).length
    const base =
      row.feeBearingCancels * 2 +
      row.waivedCancels * 0.5 +
      row.totalCancels * 0.25
    row.riskScore = Math.round(base * 10) / 10
    row.isRepeatOffender = recentCount >= threshold
  }

  return [...map.values()].sort((a, b) => b.riskScore - a.riskScore)
}

export type DriverRiskRow = {
  driverName: string
  totalCancels: number
  noShowCount: number
  riskScore: number
  lastAt: string
}

export function computeDriverRisk(entries: CancellationEntry[]): DriverRiskRow[] {
  const map = new Map<string, DriverRiskRow>()
  for (const e of entries) {
    if (e.cancelledBy !== 'driver' || !e.driverName || e.driverName === '—') continue
    let row = map.get(e.driverName)
    if (!row) {
      row = {
        driverName: e.driverName,
        totalCancels: 0,
        noShowCount: 0,
        riskScore: 0,
        lastAt: e.cancelledAt,
      }
      map.set(e.driverName, row)
    }
    row.totalCancels += 1
    if (e.reason === 'driver_no_show') row.noShowCount += 1
    if (e.cancelledAt > row.lastAt) row.lastAt = e.cancelledAt
  }
  for (const row of map.values()) {
    row.riskScore = row.noShowCount * 3 + row.totalCancels
  }
  return [...map.values()].sort((a, b) => b.riskScore - a.riskScore)
}

// ============================================================================
// TIMELINE
// ============================================================================

export type TimelineBucket = {
  bucket: string
  label: string
  total: number
  fees: number
  waivers: number
}

export function computeCancellationTimeline(
  entries: CancellationEntry[],
  granularity: 'hour' | 'day' | 'week' = 'day',
): TimelineBucket[] {
  if (entries.length === 0) return []

  const keyFor = (iso: string): { key: string; label: string } => {
    const d = new Date(iso)
    if (granularity === 'hour') {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}`
      return { key, label: `${String(d.getHours()).padStart(2, '0')}:00` }
    }
    if (granularity === 'week') {
      const tmp = new Date(d)
      tmp.setDate(tmp.getDate() - tmp.getDay())
      const key = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`
      return {
        key,
        label: `Week of ${tmp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
      }
    }
    const key = iso.slice(0, 10)
    return {
      key,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    }
  }

  const map = new Map<string, TimelineBucket>()
  for (const e of entries) {
    const { key, label } = keyFor(e.cancelledAt)
    let b = map.get(key)
    if (!b) {
      b = { bucket: key, label, total: 0, fees: 0, waivers: 0 }
      map.set(key, b)
    }
    b.total += 1
    if (e.overriddenBy) b.waivers += 1
    else b.fees += e.fee
  }

  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

export type HourBucket = {
  hour: number
  label: string
  count: number
}

export function computeHourlyHeatmap(entries: CancellationEntry[]): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    count: 0,
  }))
  for (const e of entries) {
    const h = new Date(e.cancelledAt).getHours()
    buckets[h].count += 1
  }
  return buckets
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export type AnomalyType =
  | 'repeat-rider'
  | 'repeat-driver'
  | 'high-value-fee'
  | 'back-to-back'
  | 'off-hours'

export type CancellationAnomaly = {
  id: string
  type: AnomalyType
  severity: CancellationSeverity
  message: string
  entryIds: string[]
}

export function detectCancellationAnomalies(
  entries: CancellationEntry[],
  options: {
    threshold?: number
    windowDays?: number
  } = {},
): CancellationAnomaly[] {
  const threshold = options.threshold ?? REPEAT_OFFENDER_THRESHOLD
  const windowDays = options.windowDays ?? REPEAT_WINDOW_DAYS
  const anomalies: CancellationAnomaly[] = []

  // Repeat riders
  const byRider = groupByRider(entries)
  for (const [riderName, list] of Object.entries(byRider)) {
    if (riderName === '—') continue
    if (list.length >= threshold) {
      anomalies.push({
        id: `rr-${riderName}`,
        type: 'repeat-rider',
        severity: 'high',
        message: `${riderName} cancelled ${list.length} times in the current window`,
        entryIds: list.map((e) => e.id),
      })
    }
  }

  // Repeat drivers cancelling
  const driverCancels = entries.filter((e) => e.cancelledBy === 'driver')
  const byDriver = groupByDriver(driverCancels)
  for (const [driverName, list] of Object.entries(byDriver)) {
    if (driverName === '—') continue
    if (list.length >= threshold) {
      anomalies.push({
        id: `rd-${driverName}`,
        type: 'repeat-driver',
        severity: 'high',
        message: `${driverName} cancelled ${list.length} rides as driver`,
        entryIds: list.map((e) => e.id),
      })
    }
  }

  // High-value fees
  for (const e of entries) {
    if (isHighValue(e)) {
      anomalies.push({
        id: `hv-${e.id}`,
        type: 'high-value-fee',
        severity: 'medium',
        message: `${formatNaira(e.fee)} fee on #${e.rideId.replace('rd_', '')} (${formatReason(e.reason)})`,
        entryIds: [e.id],
      })
    }
  }

  // Back-to-back cancels by same rider within 10 minutes
  const riderTimelines = new Map<string, CancellationEntry[]>()
  for (const e of entries) {
    if (!riderTimelines.has(e.riderName)) riderTimelines.set(e.riderName, [])
    riderTimelines.get(e.riderName)!.push(e)
  }
  for (const [riderName, list] of riderTimelines.entries()) {
    const sorted = [...list].sort((a, b) => a.cancelledAt.localeCompare(b.cancelledAt))
    for (let i = 1; i < sorted.length; i++) {
      const diff = Math.abs(
        Date.parse(sorted[i].cancelledAt) - Date.parse(sorted[i - 1].cancelledAt),
      )
      if (diff <= 10 * 60 * 1000) {
        anomalies.push({
          id: `btb-${sorted[i].id}`,
          type: 'back-to-back',
          severity: 'medium',
          message: `${riderName} cancelled twice within 10 minutes`,
          entryIds: [sorted[i - 1].id, sorted[i].id],
        })
      }
    }
  }

  // Off-hours cancellations (before 06:00 or after 23:00)
  for (const e of entries) {
    const h = new Date(e.cancelledAt).getHours()
    if (h < 6 || h >= 23) {
      anomalies.push({
        id: `oh-${e.id}`,
        type: 'off-hours',
        severity: 'low',
        message: `Cancellation at ${formatDateTime(e.cancelledAt)} (off-hours)`,
        entryIds: [e.id],
      })
    }
  }

  return anomalies.sort(
    (a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity],
  )
}

// ============================================================================
// DIFF
// ============================================================================

export type CancellationFieldDiff = {
  field: keyof CancellationEntry
  before: string
  after: string
}

export function diffCancellations(
  a: CancellationEntry,
  b: CancellationEntry,
): CancellationFieldDiff[] {
  const fields: (keyof CancellationEntry)[] = [
    'rideId', 'riderName', 'driverName', 'cancelledBy', 'reason',
    'graceStatus', 'fee', 'minutesElapsed', 'cancelledAt',
    'overriddenBy', 'overriddenAt', 'overrideNote',
  ]
  const out: CancellationFieldDiff[] = []
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
  { regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, replacement: '[ip]' },
]

export function redactPII(value: string): string {
  let out = value
  for (const p of PII_PATTERNS) out = out.replace(p.regex, p.replacement)
  return out
}

// ============================================================================
// EXPORT
// ============================================================================

const CSV_HEADERS = [
  'id', 'rideId', 'riderName', 'driverName',
  'cancelledBy', 'reason', 'severity',
  'graceStatus', 'fee', 'minutesElapsed',
  'cancelledAt', 'overriddenBy', 'overriddenAt', 'overrideNote',
] as const

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

export function toCSV(
  entries: CancellationEntry[],
  options: { redact?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const lines: string[] = [CSV_HEADERS.join(',')]
  for (const e of entries) {
    const row = CSV_HEADERS.map((h) => {
      let raw: string
      if (h === 'severity') raw = severityOf(e)
      else raw = String(e[h] ?? '')
      return escapeCSV(redact ? redactPII(raw) : raw)
    })
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function toJSON(
  entries: CancellationEntry[],
  options: { redact?: boolean; pretty?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const payload = entries.map((e) => ({
    ...e,
    severity: severityOf(e),
    autoWaive: shouldAutoWaive(e),
    notes: redact && e.overrideNote ? redactPII(e.overrideNote) : e.overrideNote,
  }))
  const wrapper = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries: payload,
  }
  return options.pretty === false
    ? JSON.stringify(wrapper)
    : JSON.stringify(wrapper, null, 2)
}

export function estimateExportSize(
  entries: CancellationEntry[],
  format: 'csv' | 'json',
): number {
  const body = format === 'csv' ? toCSV(entries) : toJSON(entries, { pretty: false })
  return new TextEncoder().encode(body).byteLength
}

export function suggestExportFormat(recordCount: number): 'csv' | 'pdf' {
  return recordCount > 100 ? 'pdf' : 'csv'
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
// MUTATIONS — beyond the original waivePenaltyApi
// ============================================================================

type UndoBuffer = {
  entry: CancellationEntry
  at: number
}

const _undoStack: UndoBuffer[] = []

export function getLastUndo(): CancellationEntry | null {
  const last = _undoStack[_undoStack.length - 1]
  return last ? last.entry : null
}

export async function reinstatePenalty(
  id: string,
  adminName: string,
  note: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 500))
  store = store.map((c) => {
    if (c.id !== id) return c
    _undoStack.push({ entry: { ...c }, at: Date.now() })
    return {
      ...c,
      graceStatus: 'after_grace',
      fee: REASON_META[c.reason]?.defaultFee ?? DEFAULT_PENALTY_FEE,
      overriddenBy: null,
      overriddenAt: null,
      overrideNote: `Reinstated by ${adminName}: ${note}`,
    }
  })
}

export async function undoLastWaive(): Promise<void> {
  const last = _undoStack.pop()
  if (!last) return
  store = store.map((c) => (c.id === last.entry.id ? last.entry : c))
}

export async function adjustFee(
  id: string,
  newFee: number,
  adminName: string,
  note: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 500))
  if (newFee < 0) throw new Error('Fee cannot be negative')
  store = store.map((c) => {
    if (c.id !== id) return c
    _undoStack.push({ entry: { ...c }, at: Date.now() })
    return {
      ...c,
      fee: newFee,
      overrideNote: `Adjusted to ${formatNaira(newFee)} by ${adminName}: ${note}`,
    }
  })
}

export type BulkWaiveResult = {
  succeeded: string[]
  failed: { id: string; error: string }[]
}

export async function waivePenaltyBulk(
  ids: string[],
  note: string,
  adminName: string,
): Promise<BulkWaiveResult> {
  const result: BulkWaiveResult = { succeeded: [], failed: [] }
  for (const id of ids) {
    try {
      await waivePenaltyApi(id, note, adminName)
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

export function getStoreSnapshot(): CancellationEntry[] {
  return store.map((c) => ({ ...c }))
}

export function resetStore(): void {
  store = INITIAL.map((c) => ({ ...c }))
  _undoStack.length = 0
}

// ============================================================================
// ASYNC FETCHERS (with optional cache)
// ============================================================================

type CacheSlot<T> = { at: number; data: T }
const _cache = new Map<string, CacheSlot<unknown>>()

export async function fetchCancellationSnapshot(): Promise<CancellationSnapshot> {
  await new Promise((r) => setTimeout(r, 400))
  // Derive snapshot from current store state
  const penalties = store.filter(
    (c) => c.fee > 0 && !c.overriddenBy,
  ).length
  const waivers = store.filter((c) => !!c.overriddenBy).length
  const driverCancels = store.filter((c) => c.cancelledBy === 'driver').length

  return {
    ...MOCK_SNAPSHOT,
    penaltiesToday: penalties,
    penaltiesAmount: penalties * 200,
    waiversToday: waivers,
    driverCancels,
  }
}

export async function fetchCancellations(options: {
  force?: boolean
  ttlMs?: number
} = {}): Promise<CancellationEntry[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'cancellations:list'
  const hit = _cache.get(key) as CacheSlot<CancellationEntry[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) {
    return hit.data.map((c) => ({ ...c }))
  }
  await new Promise((r) => setTimeout(r, 500))
  const data = store.map((c) => ({ ...c }))
  _cache.set(key, { at: Date.now(), data })
  return data
}

// 🟡 BACKEND REQUIRED — POST /admin/penalties or dedicated waive endpoint
export async function waivePenaltyApi(
  id: string,
  note: string,
  adminName: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  store = store.map((c) =>
    c.id === id
      ? {
          ...c,
          graceStatus: 'waived',
          fee: 0,
          overriddenBy: adminName,
          overriddenAt: new Date().toISOString(),
          overrideNote: note,
        }
      : c,
  )
  _cache.delete('cancellations:list')
}

export async function fetchCancellationsReal(): Promise<CancellationEntry[]> {
  const res = await api.get<unknown>('/admin/penalties')
  const rows = unwrapList<BackendAuditLog>(res, 'penalties')

  return rows
    .filter((r) => r.action === 'cancel' || r.action === 'penalty')
    .map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>
      const reason = (meta.reason as string) || 'Penalty recorded'
      return {
        id: r.id,
        rideId: (meta.rideId as string) || r.resourceId || '—',
        riderName: '—',
        driverName: '—',
        cancelledBy: 'system' as const,
        reason: 'other' as const,
        graceStatus: 'after_grace' as const,
        fee: Number(meta.amount ?? 0),
        minutesElapsed: 0,
        cancelledAt: r.createdAt,
        overriddenBy: null,
        overriddenAt: null,
        overrideNote: reason,
      }
    })
}

export async function fetchCancellationSnapshotReal(): Promise<CancellationSnapshot> {
  try {
    const list = await fetchCancellationsReal()
    const penalties = list.filter((c) => c.fee > 0).length
    return {
      penaltiesToday: penalties,
      penaltiesAmount: penalties * 200,
      waiversToday: 0,
      disputed: 0,
      driverCancels: 0,
      currency: '₦',
    }
  } catch {
    return {
      penaltiesToday: 0,
      penaltiesAmount: 0,
      waiversToday: 0,
      disputed: 0,
      driverCancels: 0,
      currency: '₦',
    }
  }
}

export function clearCancellationCache(): void {
  _cache.clear()
}