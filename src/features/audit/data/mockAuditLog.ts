export type AuditModule =
  | 'drivers'
  | 'riders'
  | 'rides'
  | 'financials'
  | 'subscriptions'
  | 'cancellations'
  | 'cng'
  | 'sos'
  | 'chat'
  | 'settings'
  | 'auth'

export type AuditAction =
  | 'approve'
  | 'reject'
  | 'suspend'
  | 'reinstate'
  | 'waive'
  | 'resolve'
  | 'export'
  | 'login'
  | 'logout'
  | 'update'
  | 'delete'

export type AuditEntry = {
  id: string
  module: AuditModule
  action: AuditAction
  targetType: string
  targetId: string
  targetName: string
  adminId: string
  adminName: string
  notes: string | null
  ip: string
  createdAt: string
}
import { api } from '../../../lib/apiClient'
import {
  unwrapList,
  type BackendAuditLog,
} from '../../../services/adapters'
const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

// ============================================================================
// METADATA — canonical lists, labels, severities, palettes
// ============================================================================

export const ALL_MODULES: AuditModule[] = [
  'drivers',
  'riders',
  'rides',
  'financials',
  'subscriptions',
  'cancellations',
  'cng',
  'sos',
  'chat',
  'settings',
  'auth',
]

export const ALL_ACTIONS: AuditAction[] = [
  'approve',
  'reject',
  'suspend',
  'reinstate',
  'waive',
  'resolve',
  'export',
  'login',
  'logout',
  'update',
  'delete',
]

export type AuditSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export const SEVERITY_ORDER: Record<AuditSeverity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
}

export const MODULE_META: Record<
  AuditModule,
  { label: string; icon: string; color: string; tone: string }
> = {
  drivers:       { label: 'Drivers',       icon: 'users',         color: '#10b981', tone: 'emerald' },
  riders:        { label: 'Riders',        icon: 'user-round',    color: '#0ea5e9', tone: 'sky' },
  rides:         { label: 'Rides',         icon: 'route',         color: '#8b5cf6', tone: 'violet' },
  financials:    { label: 'Financials',    icon: 'wallet',        color: '#f59e0b', tone: 'amber' },
  subscriptions: { label: 'Subscriptions', icon: 'repeat',        color: '#6366f1', tone: 'indigo' },
  cancellations: { label: 'Cancellations', icon: 'x-circle',      color: '#ef4444', tone: 'red' },
  cng:           { label: 'CNG',           icon: 'flame',         color: '#f97316', tone: 'orange' },
  sos:           { label: 'SOS',           icon: 'siren',         color: '#dc2626', tone: 'red' },
  chat:          { label: 'Chat',          icon: 'message-circle',color: '#14b8a6', tone: 'teal' },
  settings:      { label: 'Settings',      icon: 'settings',      color: '#64748b', tone: 'slate' },
  auth:          { label: 'Auth',          icon: 'shield',        color: '#334155', tone: 'slate' },
}

export const ACTION_META: Record<
  AuditAction,
  { label: string; severity: AuditSeverity; icon: string; color: string }
> = {
  approve:   { label: 'Approved',   severity: 'info',     icon: 'check',      color: '#10b981' },
  reject:    { label: 'Rejected',   severity: 'medium',   icon: 'x',          color: '#ef4444' },
  suspend:   { label: 'Suspended',  severity: 'high',     icon: 'ban',        color: '#dc2626' },
  reinstate: { label: 'Reinstated', severity: 'low',      icon: 'undo',       color: '#0ea5e9' },
  waive:     { label: 'Waived',     severity: 'high',     icon: 'badge-check',color: '#f59e0b' },
  resolve:   { label: 'Resolved',   severity: 'low',      icon: 'check-check',color: '#22c55e' },
  export:    { label: 'Exported',   severity: 'info',     icon: 'download',   color: '#64748b' },
  login:     { label: 'Signed in',  severity: 'info',     icon: 'log-in',     color: '#0ea5e9' },
  logout:    { label: 'Signed out', severity: 'info',     icon: 'log-out',    color: '#94a3b8' },
  update:    { label: 'Updated',    severity: 'medium',   icon: 'pencil',     color: '#6366f1' },
  delete:    { label: 'Deleted',    severity: 'critical', icon: 'trash',      color: '#b91c1c' },
}

export const ACTION_GROUPS: { label: string; actions: AuditAction[] }[] = [
  { label: 'Approvals',  actions: ['approve', 'reject'] },
  { label: 'Moderation', actions: ['suspend', 'reinstate', 'waive'] },
  { label: 'Resolution', actions: ['resolve'] },
  { label: 'Data',       actions: ['update', 'delete', 'export'] },
  { label: 'Security',   actions: ['login', 'logout'] },
]

export type DatePresetKey =
  | 'last1h'
  | 'last24h'
  | 'last7d'
  | 'last30d'
  | 'last90d'
  | 'ytd'
  | 'all'

export const DATE_PRESETS: { key: DatePresetKey; label: string; ms: number | null }[] = [
  { key: 'last1h',  label: 'Last 1 hour',   ms: 60 * 60 * 1000 },
  { key: 'last24h', label: 'Last 24 hours', ms: 24 * 60 * 60 * 1000 },
  { key: 'last7d',  label: 'Last 7 days',   ms: 7 * 24 * 60 * 60 * 1000 },
  { key: 'last30d', label: 'Last 30 days',  ms: 30 * 24 * 60 * 60 * 1000 },
  { key: 'last90d', label: 'Last 90 days',  ms: 90 * 24 * 60 * 60 * 1000 },
  { key: 'ytd',     label: 'Year to date',  ms: null },
  { key: 'all',     label: 'All time',      ms: null },
]

// ============================================================================
// GUARDS
// ============================================================================

export function isAuditModule(value: unknown): value is AuditModule {
  return typeof value === 'string' && ALL_MODULES.includes(value as AuditModule)
}

export function isAuditAction(value: unknown): value is AuditAction {
  return typeof value === 'string' && ALL_ACTIONS.includes(value as AuditAction)
}

export function validateAuditEntry(entry: Partial<AuditEntry>): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  if (!entry.id) errors.push('id is required')
  if (!isAuditModule(entry.module)) errors.push('module is invalid')
  if (!isAuditAction(entry.action)) errors.push('action is invalid')
  if (!entry.targetType) errors.push('targetType is required')
  if (!entry.targetId) errors.push('targetId is required')
  if (!entry.targetName) errors.push('targetName is required')
  if (!entry.adminId) errors.push('adminId is required')
  if (!entry.adminName) errors.push('adminName is required')
  if (!entry.createdAt) errors.push('createdAt is required')
  else if (Number.isNaN(Date.parse(entry.createdAt))) errors.push('createdAt must be a valid ISO date')
  if (!entry.ip) errors.push('ip is required')
  return { valid: errors.length === 0, errors }
}

// ============================================================================
// MOCK DATA
// ============================================================================

// 🟡 BACKEND REQUIRED — GET /admin/audit/log
export const MOCK_AUDIT_LOG: AuditEntry[] = [
  { id: 'a1', module: 'drivers', action: 'approve', targetType: 'driver', targetId: 'd2', targetName: 'Musa Ibrahim', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'NIN verified, vehicle docs valid', ip: '102.89.34.12', createdAt: minutesAgo(12) },
  { id: 'a2', module: 'cancellations', action: 'waive', targetType: 'cancellation', targetId: 'c4', targetName: 'Tunde Bakare', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'Verified safety concern — penalty waived', ip: '102.89.34.12', createdAt: minutesAgo(45) },
  { id: 'a3', module: 'sos', action: 'resolve', targetType: 'sos_alert', targetId: 'sos_003', targetName: 'Yusuf Adeleke', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'False alarm — bag triggered sensor', ip: '102.89.34.12', createdAt: minutesAgo(65) },
  { id: 'a4', module: 'riders', action: 'suspend', targetType: 'rider', targetId: 'r5', targetName: 'Yusuf Adeleke', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'Repeated no-shows, 3 in 7 days', ip: '102.89.34.12', createdAt: minutesAgo(90) },
  { id: 'a5', module: 'settings', action: 'update', targetType: 'fare_policy', targetId: 'fare_v3', targetName: 'Fare parameters', adminId: 'admin_002', adminName: 'Oladayo Ayomide', notes: 'Increased per-km rate from ₦175 to ₦187', ip: '102.89.34.44', createdAt: minutesAgo(180) },
  { id: 'a6', module: 'drivers', action: 'reject', targetType: 'driver', targetId: 'd5', targetName: 'Segun Oladipo', adminId: 'admin_002', adminName: 'Oladayo Ayomide', notes: 'Expired vehicle registration', ip: '102.89.34.44', createdAt: minutesAgo(240) },
  { id: 'a7', module: 'financials', action: 'export', targetType: 'ledger', targetId: 'export_0918', targetName: 'Transaction ledger', adminId: 'admin_003', adminName: 'Eguine Ejike', notes: 'Weekly compliance export', ip: '102.89.34.98', createdAt: minutesAgo(1440) },
  { id: 'a8', module: 'auth', action: 'login', targetType: 'session', targetId: 'sess_001', targetName: 'Admin login', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: null, ip: '102.89.34.12', createdAt: minutesAgo(1500) },
  { id: 'a9', module: 'riders', action: 'reinstate', targetType: 'rider', targetId: 'r2', targetName: 'Tunde Bakare', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'Appeal accepted', ip: '102.89.34.12', createdAt: minutesAgo(2880) },
  { id: 'a10', module: 'subscriptions', action: 'export', targetType: 'ledger', targetId: 'export_0917', targetName: 'Subscription ledger', adminId: 'admin_003', adminName: 'Eguine Ejike', notes: 'Daily reconciliation', ip: '102.89.34.98', createdAt: minutesAgo(3000) },
  { id: 'a11', module: 'cng', action: 'update', targetType: 'rebate_rate', targetId: 'rate_s1', targetName: 'NIPCO Bodija rebate', adminId: 'admin_002', adminName: 'Oladayo Ayomide', notes: 'Negotiated rate ₦3.50 → ₦4.00 per kg', ip: '102.89.34.44', createdAt: minutesAgo(3200) },
  { id: 'a12', module: 'drivers', action: 'approve', targetType: 'driver', targetId: 'd6', targetName: 'Emeka Okafor', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'All documents verified', ip: '102.89.34.12', createdAt: minutesAgo(4320) },
  { id: 'a13', module: 'sos', action: 'resolve', targetType: 'sos_alert', targetId: 'sos_001', targetName: 'Bola Ariyo', adminId: 'admin_001', adminName: 'Damilare Opeyemi', notes: 'Rider safe — false trigger', ip: '102.89.34.12', createdAt: minutesAgo(4800) },
  { id: 'a14', module: 'financials', action: 'update', targetType: 'commission_rate', targetId: 'rate_2026', targetName: 'Platform commission', adminId: 'admin_002', adminName: 'Oladayo Ayomide', notes: 'Commission 22% → 20%', ip: '102.89.34.44', createdAt: minutesAgo(5760) },
  { id: 'a15', module: 'auth', action: 'logout', targetType: 'session', targetId: 'sess_000', targetName: 'Admin logout', adminId: 'admin_003', adminName: 'Eguine Ejike', notes: null, ip: '102.89.34.98', createdAt: minutesAgo(6000) },
]

export type AuditExport = {
  id: string
  format: 'csv' | 'pdf'
  filterSummary: string
  recordCount: number
  sizeBytes: number
  createdBy: string
  createdAt: string
}

// 🟡 BACKEND REQUIRED — GET /admin/audit/exports
export const MOCK_EXPORTS: AuditExport[] = [
  { id: 'exp_0919_01', format: 'csv', filterSummary: 'Drivers · Approvals · Sept 15–19', recordCount: 42, sizeBytes: 12840, createdBy: 'Damilare Opeyemi', createdAt: minutesAgo(180) },
  { id: 'exp_0918_01', format: 'csv', filterSummary: 'Financials · Full ledger · Sept 11–17', recordCount: 138, sizeBytes: 41220, createdBy: 'Eguine Ejike', createdAt: minutesAgo(1440) },
  { id: 'exp_0917_01', format: 'pdf', filterSummary: 'Weekly compliance report', recordCount: 210, sizeBytes: 98400, createdBy: 'Oladayo Ayomide', createdAt: minutesAgo(2880) },
]

// ============================================================================
// FORMATTERS — human-readable output
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
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
  const w = Math.floor(d / 7)
  if (w < 5) return `${w}w ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
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

export function formatAction(action: AuditAction): string {
  return ACTION_META[action]?.label ?? action
}

export function formatModule(mod: AuditModule): string {
  return MODULE_META[mod]?.label ?? mod
}

export function severityOf(action: AuditAction): AuditSeverity {
  return ACTION_META[action]?.severity ?? 'info'
}

export function describeEntry(entry: AuditEntry): string {
  const mod = formatModule(entry.module)
  const act = formatAction(entry.action).toLowerCase()
  return `${entry.adminName} ${act} ${entry.targetName || entry.targetId} · ${mod}`
}

export function dateRangeFromPreset(preset: DatePresetKey): {
  from: string | null
  to: string | null
} {
  if (preset === 'all') return { from: null, to: null }
  const now = new Date()
  if (preset === 'ytd') {
    return { from: new Date(now.getFullYear(), 0, 1).toISOString(), to: null }
  }
  const ms = DATE_PRESETS.find((p) => p.key === preset)?.ms ?? null
  if (!ms) return { from: null, to: null }
  return { from: new Date(now.getTime() - ms).toISOString(), to: null }
}

// ============================================================================
// FILTERING
// ============================================================================

export function filterAuditLog(
  log: AuditEntry[],
  filters: {
    from: string | null
    to: string | null
    module: AuditModule | 'all'
    action: AuditAction | 'all'
    adminId: string | 'all'
  },
): AuditEntry[] {
  return log.filter((entry) => {
    if (filters.from && entry.createdAt < filters.from) return false
    if (filters.to && entry.createdAt > filters.to) return false
    if (filters.module !== 'all' && entry.module !== filters.module) return false
    if (filters.action !== 'all' && entry.action !== filters.action) return false
    if (filters.adminId !== 'all' && entry.adminId !== filters.adminId) return false
    return true
  })
}

export type AdvancedFilters = {
  from?: string | null
  to?: string | null
  modules?: AuditModule[]
  actions?: AuditAction[]
  adminIds?: string[]
  severities?: AuditSeverity[]
  search?: string
  ips?: string[]
  targetTypes?: string[]
}

export function filterAuditLogAdvanced(
  log: AuditEntry[],
  filters: AdvancedFilters,
): AuditEntry[] {
  const modSet = filters.modules?.length ? new Set(filters.modules) : null
  const actSet = filters.actions?.length ? new Set(filters.actions) : null
  const admSet = filters.adminIds?.length ? new Set(filters.adminIds) : null
  const sevSet = filters.severities?.length ? new Set(filters.severities) : null
  const ipSet = filters.ips?.length ? new Set(filters.ips) : null
  const tgtSet = filters.targetTypes?.length ? new Set(filters.targetTypes) : null
  const q = filters.search?.trim().toLowerCase() ?? ''

  return log.filter((entry) => {
    if (filters.from && entry.createdAt < filters.from) return false
    if (filters.to && entry.createdAt > filters.to) return false
    if (modSet && !modSet.has(entry.module)) return false
    if (actSet && !actSet.has(entry.action)) return false
    if (admSet && !admSet.has(entry.adminId)) return false
    if (sevSet && !sevSet.has(severityOf(entry.action))) return false
    if (ipSet && !ipSet.has(entry.ip)) return false
    if (tgtSet && !tgtSet.has(entry.targetType)) return false
    if (q) {
      const haystack = [
        entry.targetName,
        entry.targetId,
        entry.targetType,
        entry.adminName,
        entry.notes ?? '',
        entry.ip,
        entry.module,
        entry.action,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(q)) return false
    }
    return true
  })
}

// ============================================================================
// SORTING
// ============================================================================

export type SortField = 'createdAt' | 'adminName' | 'module' | 'action' | 'targetName'
export type SortDir = 'asc' | 'desc'

export function makeComparator(field: SortField, dir: SortDir = 'desc') {
  const mul = dir === 'asc' ? 1 : -1
  return (a: AuditEntry, b: AuditEntry): number => {
    const av = a[field]
    const bv = b[field]
    if (typeof av === 'string' && typeof bv === 'string') {
      return av.localeCompare(bv) * mul
    }
    return 0
  }
}

export function sortAuditLog(
  entries: AuditEntry[],
  field: SortField = 'createdAt',
  dir: SortDir = 'desc',
): AuditEntry[] {
  return [...entries].sort(makeComparator(field, dir))
}

// ============================================================================
// GROUPING
// ============================================================================

export function groupByModule(entries: AuditEntry[]): Record<AuditModule, AuditEntry[]> {
  const out = ALL_MODULES.reduce<Record<AuditModule, AuditEntry[]>>((acc, m) => {
    acc[m] = []
    return acc
  }, {} as Record<AuditModule, AuditEntry[]>)
  for (const e of entries) out[e.module].push(e)
  return out
}

export function groupByAction(entries: AuditEntry[]): Record<AuditAction, AuditEntry[]> {
  const out = ALL_ACTIONS.reduce<Record<AuditAction, AuditEntry[]>>((acc, a) => {
    acc[a] = []
    return acc
  }, {} as Record<AuditAction, AuditEntry[]>)
  for (const e of entries) out[e.action].push(e)
  return out
}

export function groupByAdmin(entries: AuditEntry[]): Record<string, AuditEntry[]> {
  const out: Record<string, AuditEntry[]> = {}
  for (const e of entries) {
    if (!out[e.adminId]) out[e.adminId] = []
    out[e.adminId].push(e)
  }
  return out
}

export function groupByDay(entries: AuditEntry[]): Record<string, AuditEntry[]> {
  const out: Record<string, AuditEntry[]> = {}
  for (const e of entries) {
    const day = e.createdAt.slice(0, 10)
    if (!out[day]) out[day] = []
    out[day].push(e)
  }
  return out
}

export function groupByIp(entries: AuditEntry[]): Record<string, AuditEntry[]> {
  const out: Record<string, AuditEntry[]> = {}
  for (const e of entries) {
    if (!out[e.ip]) out[e.ip] = []
    out[e.ip].push(e)
  }
  return out
}

export function groupByTarget(entries: AuditEntry[]): Record<string, AuditEntry[]> {
  const out: Record<string, AuditEntry[]> = {}
  for (const e of entries) {
    const key = `${e.targetType}:${e.targetId}`
    if (!out[key]) out[key] = []
    out[key].push(e)
  }
  return out
}

// ============================================================================
// SEARCH
// ============================================================================

export function searchAuditLog(entries: AuditEntry[], query: string): AuditEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  return entries.filter((e) =>
    [e.targetName, e.targetId, e.adminName, e.notes ?? '', e.ip, e.module, e.action]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

// ============================================================================
// STATISTICS
// ============================================================================

export type AuditStats = {
  total: number
  byModule: Record<AuditModule, number>
  byAction: Record<AuditAction, number>
  byAdmin: Record<string, { adminName: string; count: number }>
  bySeverity: Record<AuditSeverity, number>
  uniqueAdmins: number
  uniqueTargets: number
  uniqueIps: number
  firstAt: string | null
  lastAt: string | null
  highRisk: number
}

export function computeAuditStats(entries: AuditEntry[]): AuditStats {
  const byModule = ALL_MODULES.reduce<Record<AuditModule, number>>((a, m) => {
    a[m] = 0
    return a
  }, {} as Record<AuditModule, number>)
  const byAction = ALL_ACTIONS.reduce<Record<AuditAction, number>>((a, k) => {
    a[k] = 0
    return a
  }, {} as Record<AuditAction, number>)
  const bySeverity: Record<AuditSeverity, number> = {
    critical: 0, high: 0, medium: 0, low: 0, info: 0,
  }
  const byAdmin: Record<string, { adminName: string; count: number }> = {}
  const targets = new Set<string>()
  const ips = new Set<string>()
  let firstAt: string | null = null
  let lastAt: string | null = null

  for (const e of entries) {
    byModule[e.module] = (byModule[e.module] ?? 0) + 1
    byAction[e.action] = (byAction[e.action] ?? 0) + 1
    const sev = severityOf(e.action)
    bySeverity[sev] = (bySeverity[sev] ?? 0) + 1
    if (!byAdmin[e.adminId]) byAdmin[e.adminId] = { adminName: e.adminName, count: 0 }
    byAdmin[e.adminId].count += 1
    targets.add(`${e.targetType}:${e.targetId}`)
    ips.add(e.ip)
    if (!firstAt || e.createdAt < firstAt) firstAt = e.createdAt
    if (!lastAt || e.createdAt > lastAt) lastAt = e.createdAt
  }

  return {
    total: entries.length,
    byModule,
    byAction,
    byAdmin,
    bySeverity,
    uniqueAdmins: Object.keys(byAdmin).length,
    uniqueTargets: targets.size,
    uniqueIps: ips.size,
    firstAt,
    lastAt,
    highRisk: bySeverity.critical + bySeverity.high,
  }
}

export type TimelineBucket = {
  bucket: string
  label: string
  total: number
  byAction: Partial<Record<AuditAction, number>>
}

export function computeTimeline(
  entries: AuditEntry[],
  granularity: 'hour' | 'day' | 'week' = 'day',
): TimelineBucket[] {
  if (entries.length === 0) return []

  const bucketKey = (iso: string): { key: string; label: string } => {
    const d = new Date(iso)
    if (granularity === 'hour') {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}`
      return { key, label: `${String(d.getHours()).padStart(2, '0')}:00` }
    }
    if (granularity === 'week') {
      const tmp = new Date(d)
      tmp.setDate(tmp.getDate() - tmp.getDay())
      const key = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`
      return { key, label: `Week of ${tmp.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` }
    }
    const key = iso.slice(0, 10)
    return { key, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
  }

  const map = new Map<string, TimelineBucket>()
  for (const e of entries) {
    const { key, label } = bucketKey(e.createdAt)
    let b = map.get(key)
    if (!b) {
      b = { bucket: key, label, total: 0, byAction: {} }
      map.set(key, b)
    }
    b.total += 1
    b.byAction[e.action] = (b.byAction[e.action] ?? 0) + 1
  }

  return [...map.values()].sort((a, b) => a.bucket.localeCompare(b.bucket))
}

export type AdminActivity = {
  adminId: string
  adminName: string
  total: number
  byAction: Partial<Record<AuditAction, number>>
  lastSeen: string
  ips: string[]
}

export function computeAdminActivity(entries: AuditEntry[]): AdminActivity[] {
  const map = new Map<string, AdminActivity>()
  for (const e of entries) {
    let row = map.get(e.adminId)
    if (!row) {
      row = { adminId: e.adminId, adminName: e.adminName, total: 0, byAction: {}, lastSeen: e.createdAt, ips: [] }
      map.set(e.adminId, row)
    }
    row.total += 1
    row.byAction[e.action] = (row.byAction[e.action] ?? 0) + 1
    if (e.createdAt > row.lastSeen) row.lastSeen = e.createdAt
    if (!row.ips.includes(e.ip)) row.ips.push(e.ip)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

export type AnomalyType =
  | 'failed-login-burst'
  | 'mass-update'
  | 'off-hours'
  | 'duplicate'
  | 'unfamiliar-ip'
  | 'high-risk-cluster'

export type Anomaly = {
  id: string
  type: AnomalyType
  severity: AuditSeverity
  message: string
  entryIds: string[]
}

export function detectAnomalies(entries: AuditEntry[]): Anomaly[] {
  const anomalies: Anomaly[] = []
  const byAdmin = groupByAdmin(entries)
  const byIp = groupByIp(entries)

  // Repeated identical actions by same admin on same target within 5 min
  for (const list of Object.values(byAdmin)) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]
      const cur = sorted[i]
      const sameTarget = prev.targetId === cur.targetId
      const sameAction = prev.action === cur.action
      const within5 = Math.abs(Date.parse(cur.createdAt) - Date.parse(prev.createdAt)) <= 5 * 60 * 1000
      if (sameTarget && sameAction && within5) {
        anomalies.push({
          id: `dup-${cur.id}`,
          type: 'duplicate',
          severity: 'medium',
          message: `${cur.adminName} repeated "${formatAction(cur.action)}" on ${cur.targetName} within 5 minutes`,
          entryIds: [prev.id, cur.id],
        })
      }
    }
  }

  // Mass updates by a single admin within 1 hour
  for (const list of Object.values(byAdmin)) {
    const sorted = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    let windowStart = 0
    for (let i = 0; i < sorted.length; i++) {
      while (Date.parse(sorted[i].createdAt) - Date.parse(sorted[windowStart].createdAt) > 60 * 60 * 1000) {
        windowStart++
      }
      if (i - windowStart + 1 >= 5) {
        const ids = sorted.slice(windowStart, i + 1).map((e) => e.id)
        anomalies.push({
          id: `mass-${sorted[i].id}`,
          type: 'mass-update',
          severity: 'high',
          message: `${sorted[i].adminName} performed ${ids.length} actions within 1 hour`,
          entryIds: ids,
        })
        break
      }
    }
  }

  // Off-hours activity (before 06:00 or after 23:00 local)
  for (const e of entries) {
    const h = new Date(e.createdAt).getHours()
    if (h < 6 || h >= 23) {
      anomalies.push({
        id: `off-${e.id}`,
        type: 'off-hours',
        severity: 'low',
        message: `${e.adminName} was active outside business hours (${formatDateTime(e.createdAt)})`,
        entryIds: [e.id],
      })
    }
  }

  // Unfamiliar IPs — those used by only one admin and fewer than 2 entries
  for (const [ip, list] of Object.entries(byIp)) {
    if (list.length === 1 && ip !== '—') {
      const admins = new Set(list.map((e) => e.adminId))
      if (admins.size === 1) {
        anomalies.push({
          id: `ip-${ip}`,
          type: 'unfamiliar-ip',
          severity: 'medium',
          message: `One-off IP ${ip} used by ${list[0].adminName}`,
          entryIds: list.map((e) => e.id),
        })
      }
    }
  }

  // High-risk cluster: >= 3 high/critical actions in same hour
  const highRisk = entries.filter((e) => ['high', 'critical'].includes(severityOf(e.action)))
  const byHour: Record<string, AuditEntry[]> = {}
  for (const e of highRisk) {
    const key = e.createdAt.slice(0, 13)
    if (!byHour[key]) byHour[key] = []
    byHour[key].push(e)
  }
  for (const [key, list] of Object.entries(byHour)) {
    if (list.length >= 3) {
      anomalies.push({
        id: `hrc-${key}`,
        type: 'high-risk-cluster',
        severity: 'critical',
        message: `${list.length} high-risk actions clustered around ${formatDateTime(list[0].createdAt)}`,
        entryIds: list.map((e) => e.id),
      })
    }
  }

  return anomalies.sort((a, b) => SEVERITY_ORDER[b.severity] - SEVERITY_ORDER[a.severity])
}

// ============================================================================
// INTEGRITY / FINGERPRINT
// ============================================================================

export function djb2(str: string): string {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0')
}

export function fingerprint(entry: AuditEntry): string {
  return djb2(`${entry.id}|${entry.module}|${entry.action}|${entry.adminId}|${entry.createdAt}`)
}

export function fingerprintChain(entries: AuditEntry[]): string {
  return djb2(entries.map(fingerprint).join(':'))
}

// ============================================================================
// DIFF
// ============================================================================

export type FieldDiff = {
  field: keyof AuditEntry
  before: string
  after: string
}

export function diffEntries(a: AuditEntry, b: AuditEntry): FieldDiff[] {
  const fields: (keyof AuditEntry)[] = [
    'module', 'action', 'targetType', 'targetId', 'targetName',
    'adminId', 'adminName', 'notes', 'ip', 'createdAt',
  ]
  const out: FieldDiff[] = []
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

const PII_PATTERNS: { name: string; regex: RegExp; replacement: string }[] = [
  { name: 'email', regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: '[email]' },
  { name: 'ipv4', regex: /\b\d{1,3}(?:\.\d{1,3}){3}\b/g, replacement: '[ip]' },
  { name: 'phone', regex: /\b(?:\+?234|0)[789]\d{9}\b/g, replacement: '[phone]' },
  { name: 'nin', regex: /\b\d{11}\b/g, replacement: '[id]' },
]

export function redactPII(value: string): string {
  let out = value
  for (const p of PII_PATTERNS) out = out.replace(p.regex, p.replacement)
  return out
}

// ============================================================================
// EXPORT — CSV / JSON
// ============================================================================

const CSV_HEADERS = [
  'id', 'module', 'action', 'severity', 'targetType', 'targetId',
  'targetName', 'adminId', 'adminName', 'notes', 'ip', 'createdAt',
] as const

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

export function toCSV(
  entries: AuditEntry[],
  options: { redact?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const lines: string[] = [CSV_HEADERS.join(',')]
  for (const e of entries) {
    const row = CSV_HEADERS.map((h) => {
      let raw: string
      if (h === 'severity') raw = severityOf(e.action)
      else raw = String(e[h] ?? '')
      return escapeCSV(redact ? redactPII(raw) : raw)
    })
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function toJSON(
  entries: AuditEntry[],
  options: { redact?: boolean; pretty?: boolean } = {},
): string {
  const redact = options.redact ?? false
  const payload = entries.map((e) => ({
    ...e,
    severity: severityOf(e.action),
    notes: redact && e.notes ? redactPII(e.notes) : e.notes,
    ip: redact ? '[ip]' : e.ip,
    fingerprint: fingerprint(e),
  }))
  const wrapper = {
    generatedAt: new Date().toISOString(),
    count: entries.length,
    chain: fingerprintChain(entries),
    entries: payload,
  }
  return options.pretty === false ? JSON.stringify(wrapper) : JSON.stringify(wrapper, null, 2)
}

export function estimateExportSize(
  entries: AuditEntry[],
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
// COMPLIANCE
// ============================================================================

export type ComplianceReport = {
  retentionDays: number
  oldestEntry: string | null
  newestEntry: string | null
  entriesMissingNotes: number
  entriesMissingIp: number
  criticalEvents: number
  compliant: boolean
  notes: string[]
}

export function computeCompliance(
  entries: AuditEntry[],
  retentionDays = 365,
): ComplianceReport {
  const stats = computeAuditStats(entries)
  const now = Date.now()
  const oldest = stats.firstAt
  const ageDays = oldest ? Math.floor((now - Date.parse(oldest)) / 86400000) : 0
  const missingNotes = entries.filter((e) => !e.notes || e.notes.trim() === '').length
  const missingIp = entries.filter((e) => !e.ip || e.ip === '—').length
  const critical = stats.bySeverity.critical

  const notes: string[] = []
  if (ageDays > retentionDays) notes.push(`Oldest entry is ${ageDays} days old (policy: ${retentionDays} days)`)
  if (missingIp > 0) notes.push(`${missingIp} entries missing source IP`)
  if (missingNotes > 0) notes.push(`${missingNotes} entries missing notes`)
  if (critical > 0) notes.push(`${critical} critical-severity events recorded`)

  return {
    retentionDays,
    oldestEntry: stats.firstAt,
    newestEntry: stats.lastAt,
    entriesMissingNotes: missingNotes,
    entriesMissingIp: missingIp,
    criticalEvents: critical,
    compliant: ageDays <= retentionDays && missingIp === 0,
    notes,
  }
}

// ============================================================================
// BACKEND MAPPING
// ============================================================================

export function mapBackendAuditLog(r: BackendAuditLog): AuditEntry {
  return {
    id: r.id,
    module: isAuditModule(r.resource) ? r.resource : 'auth',
    action: isAuditAction(r.action) ? r.action : 'update',
    targetType: r.resource ?? '—',
    targetId: r.resourceId ?? '—',
    targetName: r.resourceId ?? '—',
    adminId: r.actorId,
    adminName: r.actorName ?? r.actorId.slice(0, 8),
    notes: r.metadata ? JSON.stringify(r.metadata).slice(0, 120) : null,
    ip: '—',
    createdAt: r.createdAt,
  }
}

export function mergeAuditSources(...sources: AuditEntry[][]): AuditEntry[] {
  const seen = new Map<string, AuditEntry>()
  for (const src of sources) {
    for (const e of src) if (!seen.has(e.id)) seen.set(e.id, e)
  }
  return sortAuditLog([...seen.values()], 'createdAt', 'desc')
}

// ============================================================================
// ASYNC FETCHERS (with optional cache)
// ============================================================================

type CacheSlot<T> = { at: number; data: T }
const _cache = new Map<string, CacheSlot<unknown>>()

export async function fetchAuditLog(
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<AuditEntry[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'audit:log'
  const hit = _cache.get(key) as CacheSlot<AuditEntry[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) return hit.data

  await new Promise((r) => setTimeout(r, 500))
  _cache.set(key, { at: Date.now(), data: MOCK_AUDIT_LOG })
  return MOCK_AUDIT_LOG
}

export async function fetchAuditExports(
  options: { force?: boolean; ttlMs?: number } = {},
): Promise<AuditExport[]> {
  const { force = true, ttlMs = 0 } = options
  const key = 'audit:exports'
  const hit = _cache.get(key) as CacheSlot<AuditExport[]> | undefined
  if (!force && ttlMs > 0 && hit && Date.now() - hit.at < ttlMs) return hit.data

  await new Promise((r) => setTimeout(r, 300))
  _cache.set(key, { at: Date.now(), data: MOCK_EXPORTS })
  return MOCK_EXPORTS
}

export async function fetchAuditLogReal(): Promise<AuditEntry[]> {
  const res = await api.get<unknown>('/admin/audit-logs', {
    query: { limit: 200 },
  })
  const rows = unwrapList<BackendAuditLog>(res, 'logs')
  return rows.map(mapBackendAuditLog)
}

export function clearAuditCache(): void {
  _cache.clear()
}