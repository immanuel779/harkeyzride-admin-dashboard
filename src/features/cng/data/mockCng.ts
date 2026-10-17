export type CngStationStatus = 'active' | 'paused' | 'pending'

export type CngStation = {
  id: string
  name: string
  location: string
  status: CngStationStatus
  rebatePerKg: number
  volumeThisMonth: number // kg
  rebateEarned: number
  driversServed: number
}
import { api } from '../../../lib/apiClient'
import {
  unwrapList,
  type BackendCngStation,
  type BackendCngTransaction,
} from '../../../services/adapters'
export type RefuelEntry = {
  id: string
  driverId: string
  driverName: string
  stationId: string
  stationName: string
  kg: number
  pricePerKg: number
  totalCost: number
  rebateEarned: number
  reference: string
  refueledAt: string
}

export type CngSnapshot = {
  volumeToday: number // kg
  volumeThisMonth: number // kg
  rebateThisMonth: number
  activeStations: number
  currency: string
}

// 🟡 BACKEND REQUIRED — GET /admin/cng/snapshot
export const MOCK_SNAPSHOT: CngSnapshot = {
  volumeToday: 1240,
  volumeThisMonth: 34860,
  rebateThisMonth: 139440,
  activeStations: 8,
  currency: '₦',
}

// 🟡 BACKEND REQUIRED — GET /admin/cng/stations
export const MOCK_STATIONS: CngStation[] = [
  { id: 's1', name: 'NIPCO Gas Bodija', location: 'Bodija, Ibadan', status: 'active', rebatePerKg: 4.0, volumeThisMonth: 8420, rebateEarned: 33680, driversServed: 62 },
  { id: 's2', name: 'NGV Ring Road', location: 'Ring Road, Ibadan', status: 'active', rebatePerKg: 4.0, volumeThisMonth: 7180, rebateEarned: 28720, driversServed: 54 },
  { id: 's3', name: 'Gaslink UI-Sango', location: 'UI-Sango, Ibadan', status: 'active', rebatePerKg: 4.0, volumeThisMonth: 6240, rebateEarned: 24960, driversServed: 41 },
  { id: 's4', name: 'Total Filling Station Dugbe', location: 'Dugbe, Ibadan', status: 'active', rebatePerKg: 3.5, volumeThisMonth: 5120, rebateEarned: 17920, driversServed: 38 },
  { id: 's5', name: 'Aiteo CNG Challenge', location: 'Challenge, Ibadan', status: 'active', rebatePerKg: 3.5, volumeThisMonth: 4010, rebateEarned: 14035, driversServed: 29 },
  { id: 's6', name: 'Mobil CNG Iwo Road', location: 'Iwo Road, Ibadan', status: 'paused', rebatePerKg: 4.0, volumeThisMonth: 2140, rebateEarned: 8560, driversServed: 18 },
  { id: 's7', name: 'Bovas CNG Challenge', location: 'Challenge, Ibadan', status: 'active', rebatePerKg: 3.5, volumeThisMonth: 1750, rebateEarned: 6125, driversServed: 14 },
  { id: 's8', name: 'Ascon CNG Akobo', location: 'Akobo, Ibadan', status: 'pending', rebatePerKg: 4.0, volumeThisMonth: 0, rebateEarned: 0, driversServed: 0 },
]

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

// 🟡 BACKEND REQUIRED — GET /admin/cng/refuels
export const MOCK_REFUELS: RefuelEntry[] = [
  { id: 'r1', driverId: 'd1', driverName: 'John Smith', stationId: 's1', stationName: 'NIPCO Gas Bodija', kg: 8.2, pricePerKg: 350, totalCost: 2870, rebateEarned: 32.8, reference: 'HR-CNG-0919-001', refueledAt: minutesAgo(12) },
  { id: 'r2', driverId: 'd3', driverName: 'Ahmed Bello', stationId: 's2', stationName: 'NGV Ring Road', kg: 6.5, pricePerKg: 350, totalCost: 2275, rebateEarned: 26.0, reference: 'HR-CNG-0919-002', refueledAt: minutesAgo(34) },
  { id: 'r3', driverId: 'd2', driverName: 'Musa Ibrahim', stationId: 's1', stationName: 'NIPCO Gas Bodija', kg: 7.8, pricePerKg: 350, totalCost: 2730, rebateEarned: 31.2, reference: 'HR-CNG-0919-003', refueledAt: minutesAgo(58) },
  { id: 'r4', driverId: 'd6', driverName: 'Emeka Okafor', stationId: 's3', stationName: 'Gaslink UI-Sango', kg: 5.4, pricePerKg: 350, totalCost: 1890, rebateEarned: 21.6, reference: 'HR-CNG-0919-004', refueledAt: minutesAgo(92) },
  { id: 'r5', driverId: 'd8', driverName: 'Femi Akinyemi', stationId: 's4', stationName: 'Total Filling Station Dugbe', kg: 6.1, pricePerKg: 350, totalCost: 2135, rebateEarned: 21.35, reference: 'HR-CNG-0919-005', refueledAt: minutesAgo(140) },
  { id: 'r6', driverId: 'd4', driverName: 'Kunle Adebayo', stationId: 's1', stationName: 'NIPCO Gas Bodija', kg: 9.0, pricePerKg: 350, totalCost: 3150, rebateEarned: 36.0, reference: 'HR-CNG-0919-006', refueledAt: minutesAgo(185) },
  { id: 'r7', driverId: 'd7', driverName: 'Tunde Bakare', stationId: 's5', stationName: 'Aiteo CNG Challenge', kg: 7.2, pricePerKg: 350, totalCost: 2520, rebateEarned: 25.2, reference: 'HR-CNG-0919-007', refueledAt: minutesAgo(230) },
  { id: 'r8', driverId: 'd1', driverName: 'John Smith', stationId: 's1', stationName: 'NIPCO Gas Bodija', kg: 8.5, pricePerKg: 350, totalCost: 2975, rebateEarned: 34.0, reference: 'HR-CNG-0918-008', refueledAt: minutesAgo(1440) },
  { id: 'r9', driverId: 'd3', driverName: 'Ahmed Bello', stationId: 's2', stationName: 'NGV Ring Road', kg: 6.8, pricePerKg: 350, totalCost: 2380, rebateEarned: 27.2, reference: 'HR-CNG-0918-009', refueledAt: minutesAgo(1500) },
  { id: 'r10', driverId: 'd5', driverName: 'Segun Oladipo', stationId: 's6', stationName: 'Mobil CNG Iwo Road', kg: 5.0, pricePerKg: 350, totalCost: 1750, rebateEarned: 20.0, reference: 'HR-CNG-0918-010', refueledAt: minutesAgo(1620) },
]

// ============================================================================
// METADATA — canonical lists, labels, tones, thresholds
// ============================================================================

export const ALL_STATION_STATUSES: CngStationStatus[] = ['active', 'paused', 'pending']

export const STATION_STATUS_META: Record<
  CngStationStatus,
  { label: string; tone: 'success' | 'warning' | 'neutral'; color: string; description: string }
> = {
  active: {
    label: 'Active',
    tone: 'success',
    color: '#10b981',
    description: 'Station is live and accepting refuels',
  },
  paused: {
    label: 'Paused',
    tone: 'warning',
    color: '#f59e0b',
    description: 'Station temporarily suspended — no new rebates accrue',
  },
  pending: {
    label: 'Pending',
    tone: 'neutral',
    color: '#64748b',
    description: 'Station onboarding not completed',
  },
}

export const HIGH_VOLUME_KG = 20
export const HIGH_REBATE_NAIRA = 500
export const LOW_EFFICIENCY_RATIO = 0.85 // rebateEarned / (kg * rebatePerKg)
export const DEFAULT_PRICE_PER_KG = 350
export const INACTIVE_DAYS = 14

// ============================================================================
// GUARDS
// ============================================================================

export function isStationStatus(value: unknown): value is CngStationStatus {
  return typeof value === 'string' && ALL_STATION_STATUSES.includes(value as CngStationStatus)
}

export function isRefuelEntry(value: unknown): value is RefuelEntry {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<RefuelEntry>
  return (
    typeof v.id === 'string' &&
    typeof v.driverName === 'string' &&
    typeof v.stationName === 'string' &&
    typeof v.kg === 'number' &&
    typeof v.totalCost === 'number' &&
    typeof v.refueledAt === 'string'
  )
}

// ============================================================================
// VALIDATION
// ============================================================================

export function validateRefuelEntry(entry: Partial<RefuelEntry>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!entry.id) errors.push('id is required')
  if (!entry.driverId) errors.push('driverId is required')
  if (!entry.driverName) errors.push('driverName is required')
  if (!entry.stationId) errors.push('stationId is required')
  if (!entry.stationName) errors.push('stationName is required')
  if (typeof entry.kg !== 'number' || entry.kg <= 0) errors.push('kg must be a positive number')
  if (typeof entry.pricePerKg !== 'number' || entry.pricePerKg < 0) {
    errors.push('pricePerKg must be a non-negative number')
  }
  if (typeof entry.totalCost !== 'number' || entry.totalCost < 0) {
    errors.push('totalCost must be a non-negative number')
  }
  if (typeof entry.rebateEarned !== 'number' || entry.rebateEarned < 0) {
    errors.push('rebateEarned must be a non-negative number')
  }
  if (!entry.reference) errors.push('reference is required')
  if (!entry.refueledAt) errors.push('refueledAt is required')
  else if (Number.isNaN(Date.parse(entry.refueledAt))) {
    errors.push('refueledAt must be a valid ISO date')
  }
  return { valid: errors.length === 0, errors }
}

export function validateStation(station: Partial<CngStation>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!station.id) errors.push('id is required')
  if (!station.name) errors.push('name is required')
  if (!station.location) errors.push('location is required')
  if (!isStationStatus(station.status)) errors.push('status is invalid')
  if (typeof station.rebatePerKg !== 'number' || station.rebatePerKg < 0) {
    errors.push('rebatePerKg must be a non-negative number')
  }
  if (typeof station.volumeThisMonth !== 'number' || station.volumeThisMonth < 0) {
    errors.push('volumeThisMonth must be a non-negative number')
  }
  if (typeof station.rebateEarned !== 'number' || station.rebateEarned < 0) {
    errors.push('rebateEarned must be a non-negative number')
  }
  return { valid: errors.length === 0, errors }
}

// ============================================================================
// BUSINESS RULES
// ============================================================================

/**
 * Compute the rebate a refuel should earn at a given station rate.
 * Pure calculation — no side effects.
 */
export function calculateRebate(kg: number, rebatePerKg: number): number {
  if (kg <= 0 || rebatePerKg <= 0) return 0
  return Math.round(kg * rebatePerKg * 100) / 100
}

/**
 * Compute the expected rebate from an entry and compare to what was recorded.
 * Flags entries where the recorded rebate deviates by more than 1₦.
 */
export function reconcileRebate(
  entry: RefuelEntry,
  expectedRate: number,
): { expected: number; actual: number; delta: number; matches: boolean } {
  const expected = calculateRebate(entry.kg, expectedRate)
  const delta = Math.round((entry.rebateEarned - expected) * 100) / 100
  return {
    expected,
    actual: Math.round(entry.rebateEarned * 100) / 100,
    delta,
    matches: Math.abs(delta) < 1,
  }
}

/**
 * Compute efficiency: rebate per kg vs the station's advertised rate.
 * Returns 1.0 for perfect, lower means the driver earned less than expected.
 */
export function computeRebateEfficiency(
  entry: RefuelEntry,
  stationRate: number,
): number {
  if (entry.kg <= 0 || stationRate <= 0) return 0
  const expected = entry.kg * stationRate
  if (expected === 0) return 0
  return entry.rebateEarned / expected
}

export function isHighVolume(entry: RefuelEntry): boolean {
  return entry.kg >= HIGH_VOLUME_KG
}

export function isHighRebate(entry: RefuelEntry): boolean {
  return entry.rebateEarned >= HIGH_REBATE_NAIRA
}

export function isLowEfficiency(
  entry: RefuelEntry,
  stationRate: number,
): boolean {
  return computeRebateEfficiency(entry, stationRate) < LOW_EFFICIENCY_RATIO
}

export function isStationInactive(
  station: CngStation,
  refuels: RefuelEntry[],
  thresholdDays: number = INACTIVE_DAYS,
): boolean {
  if (station.status !== 'active') return true
  const cutoff = Date.now() - thresholdDays * 24 * 60 * 60 * 1000
  const hasRecent = refuels.some(
    (r) => r.stationId === station.id && Date.parse(r.refueledAt) >= cutoff,
  )
  return !hasRecent
}

// ============================================================================
// FORMATTERS
// ============================================================================

export function formatNaira(amount: number, currency = '₦'): string {
  return `${currency}${amount.toLocaleString()}`
}

export function formatKg(kg: number): string {
  return `${kg.toFixed(1)} kg`
}

export function formatPricePerKg(price: number, currency = '₦'): string {
  return `${currency}${price.toFixed(2)}/kg`
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

export function formatStatus(status: CngStationStatus): string {
  return STATION_STATUS_META[status]?.label ?? status
}

export function shortReference(reference: string): string {
  const parts = reference.split('-')
  return parts[parts.length - 1] ?? reference
}

export function describeRefuel(entry: RefuelEntry): string {
  return `${entry.driverName} refueled ${formatKg(entry.kg)} at ${entry.stationName}`
}

export function describeStation(station: CngStation): string {
  return `${station.name} — ${formatStatus(station.status)} · ${formatNaira(
    station.rebatePerKg,
  )}/kg`
}

// ============================================================================
// FILTERING
// ============================================================================

export type RefuelFilters = {
  from?: string | null
  to?: string | null
  stationIds?: string[]
  stationNames?: string[]
  driverIds?: string[]
  driverNames?: string[]
  minKg?: number
  maxKg?: number
  minRebate?: number
  maxRebate?: number
  onlyHighVolume?: boolean
  onlyHighRebate?: boolean
  search?: string
}

export function filterRefuels(
  entries: RefuelEntry[],
  filters: RefuelFilters,
): RefuelEntry[] {
  const stationSet = filters.stationNames?.length ? new Set(filters.stationNames) : null
  const stationIdSet = filters.stationIds?.length ? new Set(filters.stationIds) : null
  const driverSet = filters.driverNames?.length ? new Set(filters.driverNames) : null
  const driverIdSet = filters.driverIds?.length ? new Set(filters.driverIds) : null
  const q = filters.search?.trim().toLowerCase() ?? ''

  return entries.filter((e) => {
    if (filters.from && e.refueledAt < filters.from) return false
    if (filters.to && e.refueledAt > filters.to) return false
    if (stationSet && !stationSet.has(e.stationName)) return false
    if (stationIdSet && !stationIdSet.has(e.stationId)) return false
    if (driverSet && !driverSet.has(e.driverName)) return false
    if (driverIdSet && !driverIdSet.has(e.driverId)) return false
    if (typeof filters.minKg === 'number' && e.kg < filters.minKg) return false
    if (typeof filters.maxKg === 'number' && e.kg > filters.maxKg) return false
    if (typeof filters.minRebate === 'number' && e.rebateEarned < filters.minRebate) return false
    if (typeof filters.maxRebate === 'number' && e.rebateEarned > filters.maxRebate) return false
    if (filters.onlyHighVolume && !isHighVolume(e)) return false
    if (filters.onlyHighRebate && !isHighRebate(e)) return false
    if (q) {
      const haystack = [
        e.driverName,
        e.stationName,
        e.reference,
        e.driverId,
        e.stationId,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

export function searchRefuels(entries: RefuelEntry[], query: string): RefuelEntry[] {
  return filterRefuels(entries, { search: query })
}

export type StationFilters = {
  statuses?: CngStationStatus[]
  minRebatePerKg?: number
  maxRebatePerKg?: number
  minVolume?: number
  minDrivers?: number
  search?: string
}

export function filterStations(
  stations: CngStation[],
  filters: StationFilters,
): CngStation[] {
  const statusSet = filters.statuses?.length ? new Set(filters.statuses) : null
  const q = filters.search?.trim().toLowerCase() ?? ''
  return stations.filter((s) => {
    if (statusSet && !statusSet.has(s.status)) return false
    if (
      typeof filters.minRebatePerKg === 'number' &&
      s.rebatePerKg < filters.minRebatePerKg
    ) {
      return false
    }
    if (
      typeof filters.maxRebatePerKg === 'number' &&
      s.rebatePerKg > filters.maxRebatePerKg
    ) {
      return false
    }
    if (typeof filters.minVolume === 'number' && s.volumeThisMonth < filters.minVolume) {
      return false
    }
    if (typeof filters.minDrivers === 'number' && s.driversServed < filters.minDrivers) {
      return false
    }
    if (q) {
      const haystack = [s.name, s.location, s.id].join(' ').toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

// ============================================================================
// SORTING
// ============================================================================

export type RefuelSortField =
  | 'refueledAt'
  | 'kg'
  | 'totalCost'
  | 'rebateEarned'
  | 'driverName'
  | 'stationName'

export type SortDir = 'asc' | 'desc'

export function sortRefuels(
  entries: RefuelEntry[],
  field: RefuelSortField = 'refueledAt',
  dir: SortDir = 'desc',
): RefuelEntry[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...entries].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
    return String(av).localeCompare(String(bv)) * mul
  })
}

export type StationSortField =
  | 'name'
  | 'volumeThisMonth'
  | 'rebateEarned'
  | 'driversServed'
  | 'rebatePerKg'

export function sortStations(
  stations: CngStation[],
  field: StationSortField = 'volumeThisMonth',
  dir: SortDir = 'desc',
): CngStation[] {
  const mul = dir === 'asc' ? 1 : -1
  return [...stations].sort((a, b) => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * mul
    return String(av).localeCompare(String(bv)) * mul
  })
}

// ============================================================================
// GROUPING
// ============================================================================

export function groupByStation(
  entries: RefuelEntry[],
): Record<string, RefuelEntry[]> {
  const out: Record<string, RefuelEntry[]> = {}
  for (const e of entries) {
    if (!out[e.stationName]) out[e.stationName] = []
    out[e.stationName].push(e)
  }
  return out
}

export function groupByDriver(entries: RefuelEntry[]): Record<string, RefuelEntry[]> {
  const out: Record<string, RefuelEntry[]> = {}
  for (const e of entries) {
    if (!out[e.driverName]) out[e.driverName] = []
    out[e.driverName].push(e)
  }
  return out
}

export function groupByDay(entries: RefuelEntry[]): Record<string, RefuelEntry[]> {
  const out: Record<string, RefuelEntry[]> = {}
  for (const e of entries) {
    const day = e.refueledAt.slice(0, 10)
    if (!out[day]) out[day] = []
    out[day].push(e)
  }
  return out
}

export function groupByStatus(
  stations: CngStation[],
): Record<CngStationStatus, CngStation[]> {
  const out = ALL_STATION_STATUSES.reduce<Record<CngStationStatus, CngStation[]>>(
    (acc, s) => {
      acc[s] = []
      return acc
    },
    {} as Record<CngStationStatus, CngStation[]>,
  )
  for (const s of stations) out[s.status].push(s)
  return out
}

// ============================================================================
// STATISTICS
// ============================================================================

export type RefuelStats = {
  total: number
  totalKg: number
  totalCost: number
  totalRebate: number
  avgKg: number
  avgRebate: number
  uniqueDrivers: number
  uniqueStations: number
  highVolumeCount: number
  highRebateCount: number
  firstAt: string | null
  lastAt: string | null
}

export function computeRefuelStats(entries: RefuelEntry[]): RefuelStats {
  const drivers = new Set<string>()
  const stations = new Set<string>()
  let totalKg = 0
  let totalCost = 0
  let totalRebate = 0
  let highVolumeCount = 0
  let highRebateCount = 0
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const e of entries) {
    totalKg += e.kg
    totalCost += e.totalCost
    totalRebate += e.rebateEarned
    drivers.add(e.driverId || e.driverName)
    stations.add(e.stationId || e.stationName)
    if (isHighVolume(e)) highVolumeCount += 1
    if (isHighRebate(e)) highRebateCount += 1
    if (!firstAt || e.refueledAt < firstAt) firstAt = e.refueledAt
    if (!lastAt || e.refueledAt > lastAt) lastAt = e.refueledAt
  }

  const total = entries.length
  return {
    total,
    totalKg: Math.round(totalKg * 100) / 100,
    totalCost,
    totalRebate: Math.round(totalRebate * 100) / 100,
    avgKg: total > 0 ? Math.round((totalKg / total) * 100) / 100 : 0,
    avgRebate: total > 0 ? Math.round((totalRebate / total) * 100) / 100 : 0,
    uniqueDrivers: drivers.size,
    uniqueStations: stations.size,
    highVolumeCount,
    highRebateCount,
    firstAt,
    lastAt,
  }
}

export type StationStats = {
  total: number
  active: number
  paused: number
  pending: number
  totalVolume: number
  totalRebate: number
  totalDrivers: number
  avgRebatePerKg: number
}

export function computeStationStats(stations: CngStation[]): StationStats {
  let active = 0
  let paused = 0
  let pending = 0
  let totalVolume = 0
  let totalRebate = 0
  let totalDrivers = 0
  let weightedRate = 0

  for (const s of stations) {
    if (s.status === 'active') active += 1
    else if (s.status === 'paused') paused += 1
    else pending += 1
    totalVolume += s.volumeThisMonth
    totalRebate += s.rebateEarned
    totalDrivers += s.driversServed
    weightedRate += s.rebatePerKg * s.volumeThisMonth
  }

  return {
    total: stations.length,
    active,
    paused,
    pending,
    totalVolume,
    totalRebate,
    totalDrivers,
    avgRebatePerKg:
      totalVolume > 0 ? Math.round((weightedRate / totalVolume) * 100) / 100 : 0,
  }
}

export type LeaderRow = {
  key: string
  label: string
  totalKg: number
  totalRebate: number
  count: number
  share: number
}

export function computeStationLeaderboard(entries: RefuelEntry[]): LeaderRow[] {
  const map = new Map<string, LeaderRow>()
  for (const e of entries) {
    let row = map.get(e.stationName)
    if (!row) {
      row = {
        key: e.stationId || e.stationName,
        label: e.stationName,
        totalKg: 0,
        totalRebate: 0,
        count: 0,
        share: 0,
      }
      map.set(e.stationName, row)
    }
    row.totalKg += e.kg
    row.totalRebate += e.rebateEarned
    row.count += 1
  }
  const rows = [...map.values()].sort((a, b) => b.totalKg - a.totalKg)
  const max = rows.length > 0 ? rows[0].totalKg : 1
  return rows.map((r) => ({
    ...r,
    totalKg: Math.round(r.totalKg * 100) / 100,
    totalRebate: Math.round(r.totalRebate * 100) / 100,
    share: max > 0 ? r.totalKg / max : 0,
  }))
}

export function computeDriverLeaderboard(entries: RefuelEntry[]): LeaderRow[] {
  const map = new Map<string, LeaderRow>()
  for (const e of entries) {
    let row = map.get(e.driverName)
    if (!row) {
      row = {
        key: e.driverId || e.driverName,
        label: e.driverName,
        totalKg: 0,
        totalRebate: 0,
        count: 0,
        share: 0,
      }
      map.set(e.driverName, row)
    }
    row.totalKg += e.kg
    row.totalRebate += e.rebateEarned
    row.count += 1
  }
  const rows = [...map.values()].sort((a, b) => b.totalKg - a.totalKg)
  const max = rows.length > 0 ? rows[0].totalKg : 1
  return rows.map((r) => ({
    ...r,
    totalKg: Math.round(r.totalKg * 100) / 100,
    totalRebate: Math.round(r.totalRebate * 100) / 100,
    share: max > 0 ? r.totalKg / max : 0,
  }))
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

export type DailyBucket = {
  date: string
  label: string
  kg: number
  rebate: number
  count: number
}

export function computeDailyTrend(
  entries: RefuelEntry[],
  days: number = 7,
): DailyBucket[] {
  const out: DailyBucket[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    d.setHours(0, 0, 0, 0)
    const start = d.getTime()
    const end = start + 24 * 60 * 60 * 1000
    const rows = entries.filter((e) => {
      const t = Date.parse(e.refueledAt)
      return t >= start && t < end
    })
    out.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(undefined, { weekday: 'short' }),
      kg: Math.round(rows.reduce((s, r) => s + r.kg, 0) * 100) / 100,
      rebate:
        Math.round(rows.reduce((s, r) => s + r.rebateEarned, 0) * 100) / 100,
      count: rows.length,
    })
  }
  return out
}

export type HourBucket = {
  hour: number
  label: string
  kg: number
  count: number
  intensity: number
}

export function computeHourlyHeatmap(entries: RefuelEntry[]): HourBucket[] {
  const buckets = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: `${String(h).padStart(2, '0')}:00`,
    kg: 0,
    count: 0,
    intensity: 0,
  }))
  for (const e of entries) {
    const h = new Date(e.refueledAt).getHours()
    buckets[h].kg += e.kg
    buckets[h].count += 1
  }
  const max = Math.max(1, ...buckets.map((b) => b.kg))
  return buckets.map((b) => ({
    ...b,
    kg: Math.round(b.kg * 100) / 100,
    intensity: b.kg / max,
  }))
}

export type TimelineBucket = {
  bucket: string
  label: string
  total: number
  kg: number
  rebate: number
}

export function computeTimeline(
  entries: RefuelEntry[],
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
    const { key, label } = keyFor(e.refueledAt)
    let b = map.get(key)
    if (!b) {
      b = { bucket: key, label, total: 0, kg: 0, rebate: 0 }
      map.set(key, b)
    }
    b.total += 1
    b.kg += e.kg
    b.rebate += e.rebateEarned
  }
  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export type AnomalyType =
  | 'high-volume'
  | 'low-efficiency'
  | 'duplicate-reference'
  | 'inactive-station'
  | 'off-hours'
  | 'rate-mismatch'

export type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

export const ANOMALY_ORDER: Record<AnomalySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

export type CngAnomaly = {
  id: string
  type: AnomalyType
  severity: AnomalySeverity
  message: string
  entryIds: string[]
}

export function detectCngAnomalies(
  entries: RefuelEntry[],
  stations: CngStation[],
): CngAnomaly[] {
  const anomalies: CngAnomaly[] = []
  const stationRate = new Map(stations.map((s) => [s.id, s.rebatePerKg]))

  // High-volume refuels
  for (const e of entries) {
    if (isHighVolume(e)) {
      anomalies.push({
        id: `hv-${e.id}`,
        type: 'high-volume',
        severity: 'low',
        message: `${e.driverName} refueled ${formatKg(e.kg)} at ${e.stationName}`,
        entryIds: [e.id],
      })
    }
  }

  // Low efficiency vs station rate
  for (const e of entries) {
    const rate = stationRate.get(e.stationId)
    if (rate == null) continue
    const eff = computeRebateEfficiency(e, rate)
    if (eff > 0 && eff < LOW_EFFICIENCY_RATIO) {
      anomalies.push({
        id: `le-${e.id}`,
        type: 'low-efficiency',
        severity: 'medium',
        message: `Rebate efficiency ${Math.round(eff * 100)}% for ${e.driverName} at ${
          e.stationName
        }`,
        entryIds: [e.id],
      })
    }
  }

  // Duplicate references
  const refMap = new Map<string, RefuelEntry[]>()
  for (const e of entries) {
    if (!refMap.has(e.reference)) refMap.set(e.reference, [])
    refMap.get(e.reference)!.push(e)
  }
  for (const [ref, list] of refMap.entries()) {
    if (list.length > 1) {
      anomalies.push({
        id: `dup-${ref}`,
        type: 'duplicate-reference',
        severity: 'critical',
        message: `Duplicate reference ${ref} appears ${list.length} times`,
        entryIds: list.map((e) => e.id),
      })
    }
  }

  // Inactive stations
  for (const s of stations) {
    if (s.status !== 'active') continue
    if (isStationInactive(s, entries)) {
      anomalies.push({
        id: `ia-${s.id}`,
        type: 'inactive-station',
        severity: 'medium',
        message: `${s.name} has had no refuels in ${INACTIVE_DAYS} days`,
        entryIds: [],
      })
    }
  }

  // Off-hours refuels (before 06:00 or after 23:00)
  for (const e of entries) {
    const h = new Date(e.refueledAt).getHours()
    if (h < 6 || h >= 23) {
      anomalies.push({
        id: `oh-${e.id}`,
        type: 'off-hours',
        severity: 'low',
        message: `Refuel at ${formatDateTime(e.refueledAt)} (off-hours)`,
        entryIds: [e.id],
      })
    }
  }

  // Rate mismatch against station's current rebatePerKg
  for (const e of entries) {
    const rate = stationRate.get(e.stationId)
    if (rate == null) continue
    const { matches, expected, actual } = reconcileRebate(e, rate)
    if (!matches && Math.abs(expected - actual) > 5) {
      anomalies.push({
        id: `rm-${e.id}`,
        type: 'rate-mismatch',
        severity: 'high',
        message: `Expected ${formatNaira(expected)} rebate, recorded ${formatNaira(
          actual,
        )} for ${e.driverName}`,
        entryIds: [e.id],
      })
    }
  }

  return anomalies.sort(
    (a, b) => ANOMALY_ORDER[b.severity] - ANOMALY_ORDER[a.severity],
  )
}

// ============================================================================
// DIFF
// ============================================================================

export type RefuelDiff = {
  field: keyof RefuelEntry
  before: string
  after: string
}

export function diffRefuels(a: RefuelEntry, b: RefuelEntry): RefuelDiff[] {
  const fields: (keyof RefuelEntry)[] = [
    'driverName', 'stationName', 'kg', 'pricePerKg',
    'totalCost', 'rebateEarned', 'reference', 'refueledAt',
  ]
  const out: RefuelDiff[] = []
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

const REFUEL_CSV_HEADERS = [
  'id', 'reference', 'driverId', 'driverName', 'stationId', 'stationName',
  'kg', 'pricePerKg', 'totalCost', 'rebateEarned', 'refueledAt',
] as const

const STATION_CSV_HEADERS = [
  'id', 'name', 'location', 'status', 'rebatePerKg',
  'volumeThisMonth', 'rebateEarned', 'driversServed',
] as const

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

export function toCSV(
  entries: RefuelEntry[],
  options: { redact?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const lines: string[] = [REFUEL_CSV_HEADERS.join(',')]
  for (const e of entries) {
    const row = REFUEL_CSV_HEADERS.map((h) => {
      const raw = String(e[h] ?? '')
      return escapeCSV(redact ? redactPII(raw) : raw)
    })
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function stationsToCSV(stations: CngStation[]): string {
  const lines: string[] = [STATION_CSV_HEADERS.join(',')]
  for (const s of stations) {
    const row = STATION_CSV_HEADERS.map((h) => escapeCSV(String(s[h] ?? '')))
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function toJSON(
  entries: RefuelEntry[],
  options: { redact?: boolean; pretty?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const payload = entries.map((e) => ({
    ...e,
    driverName: redact ? redactPII(e.driverName) : e.driverName,
  }))
  const wrapper = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    totals: computeRefuelStats(entries),
    entries: payload,
  }
  return options.pretty === false
    ? JSON.stringify(wrapper)
    : JSON.stringify(wrapper, null, 2)
}

export function estimateExportSize(
  entries: RefuelEntry[],
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
// MUTABLE STORE + MUTATIONS
// ============================================================================

let stationStore: CngStation[] = MOCK_STATIONS.map((s) => ({ ...s }))
let refuelStore: RefuelEntry[] = MOCK_REFUELS.map((r) => ({ ...r }))

export function getStationSnapshot(): CngStation[] {
  return stationStore.map((s) => ({ ...s }))
}

export function getRefuelSnapshot(): RefuelEntry[] {
  return refuelStore.map((r) => ({ ...r }))
}

export function resetCngStore(): void {
  stationStore = MOCK_STATIONS.map((s) => ({ ...s }))
  refuelStore = MOCK_REFUELS.map((r) => ({ ...r }))
  _cache.clear()
}

export async function pauseStation(id: string, reason: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 400))
  stationStore = stationStore.map((s) =>
    s.id === id ? { ...s, status: 'paused' } : s,
  )
  _cache.delete('cng:stations')
  if (!reason.trim()) throw new Error('A pause reason is required')
}

export async function resumeStation(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 400))
  stationStore = stationStore.map((s) =>
    s.id === id ? { ...s, status: 'active' } : s,
  )
  _cache.delete('cng:stations')
}

export async function adjustRebateRate(
  id: string,
  newRate: number,
): Promise<void> {
  if (newRate < 0) throw new Error('Rebate rate cannot be negative')
  await new Promise((r) => setTimeout(r, 400))
  stationStore = stationStore.map((s) =>
    s.id === id ? { ...s, rebatePerKg: newRate } : s,
  )
  _cache.delete('cng:stations')
}

export async function addStation(input: {
  name: string
  location: string
  rebatePerKg: number
}): Promise<CngStation> {
  const station: CngStation = {
    id: `s${stationStore.length + 1}_${Date.now().toString(36)}`,
    name: input.name,
    location: input.location,
    status: 'pending',
    rebatePerKg: input.rebatePerKg,
    volumeThisMonth: 0,
    rebateEarned: 0,
    driversServed: 0,
  }
  await new Promise((r) => setTimeout(r, 400))
  stationStore = [...stationStore, station]
  _cache.delete('cng:stations')
  return station
}

// ============================================================================
// ASYNC FETCHERS (with optional cache)
// ============================================================================

type CacheSlot<T> = { at: number; data: T }
const _cache = new Map<string, CacheSlot<unknown>>()

export async function fetchCngSnapshot(
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<CngSnapshot> {
  const { force = true, ttlMs = 0 } = options
  const key = 'cng:snapshot'
  const hit = _cache.get(key) as CacheSlot<CngSnapshot> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) return hit.data

  await new Promise((r) => setTimeout(r, 400))
  const stats = computeRefuelStats(refuelStore)
  const stationStats = computeStationStats(stationStore)
  const snapshot: CngSnapshot = {
    ...MOCK_SNAPSHOT,
    volumeToday: Math.round(stats.totalKg),
    volumeThisMonth: Math.round(stationStats.totalVolume || stats.totalKg),
    rebateThisMonth: Math.round(stationStats.totalRebate || stats.totalRebate),
    activeStations: stationStats.active,
  }
  _cache.set(key, { at: Date.now(), data: snapshot })
  return snapshot
}

export async function fetchCngStations(
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<CngStation[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'cng:stations'
  const hit = _cache.get(key) as CacheSlot<CngStation[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) {
    return hit.data.map((s) => ({ ...s }))
  }
  await new Promise((r) => setTimeout(r, 450))
  const data = stationStore.map((s) => ({ ...s }))
  _cache.set(key, { at: Date.now(), data })
  return data
}

export async function fetchRefuels(
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<RefuelEntry[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'cng:refuels'
  const hit = _cache.get(key) as CacheSlot<RefuelEntry[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) {
    return hit.data.map((r) => ({ ...r }))
  }
  await new Promise((r) => setTimeout(r, 500))
  const data = refuelStore.map((r) => ({ ...r }))
  _cache.set(key, { at: Date.now(), data })
  return data
}

// ---------- Real API ----------

export async function fetchCngSnapshotReal(): Promise<CngSnapshot> {
  try {
    const res = await api.get<{
      totalRefuels?: number
      totalQuantity?: number
      totalAmount?: number
    }>('/admin/cng/summary')
    return {
      volumeToday: 0,
      volumeThisMonth: Math.round(res.totalQuantity ?? 0),
      rebateThisMonth: Math.round(res.totalAmount ?? 0),
      activeStations: 0,
      currency: '₦',
    }
  } catch {
    return {
      volumeToday: 0,
      volumeThisMonth: 0,
      rebateThisMonth: 0,
      activeStations: 0,
      currency: '₦',
    }
  }
}

export async function fetchCngStationsReal(): Promise<CngStation[]> {
  try {
    const res = await api.get<unknown>('/admin/cng/summary')
    const obj = res as { byStation?: BackendCngStation[] }
    const stations = obj.byStation ?? []
    return stations.map((s, i) => ({
      id: `stn_${i}`,
      name: s.station ?? 'Unknown',
      location: '—',
      status: 'active' as const,
      rebatePerKg: s.quantity > 0 ? s.amount / s.quantity : 0,
      volumeThisMonth: Math.round(s.quantity ?? 0),
      rebateEarned: Math.round(s.amount ?? 0),
      driversServed: s.refuels ?? 0,
    }))
  } catch {
    return []
  }
}

export async function fetchRefuelsReal(): Promise<RefuelEntry[]> {
  const res = await api.get<unknown>('/admin/cng-transactions')
  const rows = unwrapList<BackendCngTransaction>(res, 'transactions')

  return rows.map((t) => ({
    id: t.id,
    driverId: t.driverId ?? '',
    driverName: t.driverName ?? '—',
    stationId: '—',
    stationName: t.station ?? '—',
    kg: Number(t.quantity ?? 0),
    pricePerKg: 0,
    totalCost: Number(t.amount ?? t.cost ?? 0),
    rebateEarned: 0,
    reference: t.reference ?? `CNG-${t.id.slice(0, 8).toUpperCase()}`,
    refueledAt: t.createdAt ?? t.recordedAt ?? new Date().toISOString(),
  }))
}

export function clearCngCache(): void {
  _cache.clear()
}