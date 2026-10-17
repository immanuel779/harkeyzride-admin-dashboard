import { BRAND } from '../../../config/brand'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Check,
  Clock,
  Copy,
  Download,
  Eye,
  Fingerprint,
  History,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { EmptyState } from '../../../components/shared/EmptyState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  DataTable,
  type DataTableColumn,
} from '../../../components/shared/DataTable'
import { toast } from '../../../lib/toast'
import { downloadCsv, toCsv } from '../../../lib/csv'
import { useAuditLog } from '../../../hooks/queries/useAudit'
import {
  filterAuditLog,
  formatBytes,
  detectAnomalies,
  computeAuditStats,
  fingerprint,
  type AuditAction,
  type AuditEntry,
  type AuditModule,
} from '../data/mockAuditLog'
import { FilterPanel } from '../components/FilterPanel'
import { ExportActions } from '../components/ExportActions'

/* ==========================================================================
   CONFIG
   ========================================================================== */

const MODULE_TONE: Record<
  AuditModule,
  'success' | 'warning' | 'danger' | 'info' | 'neutral'
> = {
  drivers: 'info',
  riders: 'info',
  rides: 'info',
  financials: 'success',
  subscriptions: 'success',
  cancellations: 'warning',
  cng: 'success',
  sos: 'danger',
  chat: 'neutral',
  settings: 'warning',
  auth: 'neutral',
}

const ACTION_LABEL: Record<AuditAction, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  suspend: 'Suspended',
  reinstate: 'Reinstated',
  waive: 'Waived',
  resolve: 'Resolved',
  export: 'Exported',
  login: 'Logged in',
  logout: 'Logged out',
  update: 'Updated',
  delete: 'Deleted',
}

const ANOMALY_STYLES: Record<
  string,
  { bg: string; text: string; icon: typeof AlertTriangle }
> = {
  critical: { bg: 'bg-red-50 border-red-200', text: 'text-danger', icon: AlertTriangle },
  high: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  medium: { bg: 'bg-sky-50 border-sky-200', text: 'text-sky-700', icon: AlertCircle },
  low: { bg: 'bg-slate-100 border-slate-200', text: 'text-slate-700', icon: Activity },
}

type TabKey = 'all' | 'critical' | 'security' | 'flagged'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Shield }> = [
  { key: 'all', label: 'All Events', icon: History },
  { key: 'critical', label: 'Critical Actions', icon: ShieldAlert },
  { key: 'security', label: 'Security & Auth', icon: ShieldCheck },
  { key: 'flagged', label: 'Anomalies', icon: AlertTriangle },
]

/* ==========================================================================
   HELPERS
   ========================================================================== */

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatRelative(ms: number) {
  const diff = Math.max(0, Date.now() - ms)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function AuditPage() {
  const { data: log = [], isLoading, isError, error, refetch } = useAuditLog()

  const [tab, setTab] = useState<TabKey>('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [module, setModule] = useState<AuditModule | 'all'>('all')
  const [action, setAction] = useState<AuditAction | 'all'>('all')
  const [adminId, setAdminId] = useState<string>('all')
  const [search, setSearch] = useState('')

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(Date.now())

  const searchRef = useRef<HTMLInputElement>(null)

  /* ---------------------------- derived ---------------------------- */

  const admins = useMemo(() => {
    const map = new Map<string, string>()
    log.forEach((entry) => map.set(entry.adminId, entry.adminName))
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }))
  }, [log])

  const anomalies = useMemo(() => detectAnomalies(log), [log])

  const flaggedIds = useMemo(
    () => new Set(anomalies.flatMap((a) => a.entryIds)),
    [anomalies],
  )

  const stats = useMemo(() => {
    const base = computeAuditStats(log)
    return {
      total: base.total,
      critical:
        base.byAction.delete +
        base.byAction.suspend +
        base.byAction.waive +
        base.byAction.reject,
      security: base.byAction.login + base.byAction.logout,
      flagged: flaggedIds.size,
    }
  }, [log, flaggedIds])

  const baseFiltered = useMemo(
    () =>
      filterAuditLog(log, {
        from: from ? new Date(from).toISOString() : null,
        to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
        module,
        action,
        adminId,
      }),
    [log, from, to, module, action, adminId],
  )

  const filtered = useMemo(() => {
    let result = baseFiltered

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter(
        (r) =>
          r.adminName.toLowerCase().includes(q) ||
          r.targetName.toLowerCase().includes(q) ||
          (r.notes && r.notes.toLowerCase().includes(q)) ||
          r.ip.includes(q),
      )
    }

    if (tab === 'critical') {
      result = result.filter((r) =>
        ['delete', 'suspend', 'waive', 'reject'].includes(r.action),
      )
    } else if (tab === 'security') {
      result = result.filter(
        (r) => ['login', 'logout'].includes(r.action) || r.module === 'auth',
      )
    } else if (tab === 'flagged') {
      result = result.filter((r) => flaggedIds.has(r.id))
    }

    return result
  }, [baseFiltered, search, tab, flaggedIds])

  const selectedEntry = useMemo(
    () => (selectedId ? log.find((r) => r.id === selectedId) ?? null : null),
    [log, selectedId],
  )

  const selectedAnomalies = useMemo(
    () =>
      selectedEntry
        ? anomalies.filter((a) => a.entryIds.includes(selectedEntry.id))
        : [],
    [anomalies, selectedEntry],
  )

  /* ---------------------------- effects ---------------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (selectedId) {
          setSelectedId(null)
          return
        }
        return
      }

      if (inField) return
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        void handleExportCsv()
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault()
        void handleExportJson()
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, filtered])

  /* ---------------------------- handlers --------------------------- */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setLastUpdated(Date.now())
      toast.success('Audit log refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleClear = () => {
    setFrom('')
    setTo('')
    setModule('all')
    setAction('all')
    setAdminId('all')
    setSearch('')
    setTab('all')
  }

  const buildFilterSummary = () => {
    const parts: string[] = []
    if (tab !== 'all') parts.push(TABS.find((t) => t.key === tab)?.label ?? '')
    if (search) parts.push(`"${search}"`)
    if (module !== 'all') parts.push(module)
    if (action !== 'all') parts.push(ACTION_LABEL[action])
    if (adminId !== 'all') {
      const admin = admins.find((a) => a.id === adminId)
      if (admin) parts.push(admin.name)
    }
    if (from || to) parts.push(`${from || '—'} to ${to || '—'}`)
    return parts.filter(Boolean).join(' · ') || 'All records'
  }

  const handleExportCsv = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 600))

    const enhancedRows = filtered.map((r) => ({
      ...r,
      fingerprint: fingerprint(r),
    }))

    const enhancedCsv = toCsv(enhancedRows, [
      { key: 'id', header: 'ID' },
      { key: 'createdAt', header: 'Timestamp' },
      { key: 'adminName', header: 'Admin' },
      { key: 'module', header: 'Module' },
      { key: 'action', header: 'Action' },
      { key: 'targetType', header: 'Target Type' },
      { key: 'targetId', header: 'Target ID' },
      { key: 'targetName', header: 'Target' },
      { key: 'notes', header: 'Notes' },
      { key: 'ip', header: 'IP' },
      { key: 'fingerprint', header: 'Fingerprint' },
    ])

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)

    downloadCsv(`${BRAND.name.toLowerCase()}-audit-${timestamp}.csv`, enhancedCsv)
    toast.success(
      'Export downloaded',
      `${filtered.length} records · ${buildFilterSummary()}`,
    )
  }

  const handleExportPdf = async (): Promise<void> => {
    await new Promise((r) => setTimeout(r, 900))
    toast.info(
      'PDF export queued',
      'Server-side PDF generation will deliver to your email — wire in Phase 8.',
    )
  }

  const handleExportJson = async (): Promise<void> => {
    if (filtered.length === 0) {
      toast.error('Nothing to export', 'No records match the current view.')
      return
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      count: filtered.length,
      filterSummary: buildFilterSummary(),
      stats,
      entries: filtered.map((r) => ({ ...r, fingerprint: fingerprint(r) })),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${BRAND.name.toLowerCase()}-audit-${new Date()
      .toISOString()
      .slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success(
      'JSON exported',
      `${filtered.length} records · ${buildFilterSummary()}`,
    )
  }

  /* ---------------------------- columns ---------------------------- */

  const columns: DataTableColumn<AuditEntry>[] = [
    {
      key: 'createdAt',
      header: 'When',
      accessor: (r) => r.createdAt,
      sortable: true,
      render: (r) => (
        <div className="whitespace-nowrap">
          <div className="text-ink text-xs font-medium">{timeAgo(r.createdAt)}</div>
          <div className="text-[10px] text-ink-muted">
            {new Date(r.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </div>
        </div>
      ),
    },
    {
      key: 'admin',
      header: 'Admin',
      accessor: (r) => r.adminName,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-navy text-white flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
            {r.adminName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ink text-xs truncate flex items-center gap-1.5">
              {r.adminName}
              {flaggedIds.has(r.id) ? (
                <span
                  title="Flagged as anomaly"
                  className="inline-flex items-center rounded-full bg-red-100 px-1 py-0.5 text-[8px] font-bold uppercase text-danger"
                >
                  Flag
                </span>
              ) : null}
            </div>
            <div className="text-[10px] text-ink-muted font-mono">{r.ip}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'module',
      header: 'Module',
      accessor: (r) => r.module,
      sortable: true,
      render: (r) => (
        <StatusBadge status={MODULE_TONE[r.module]}>
          {r.module.charAt(0).toUpperCase() + r.module.slice(1)}
        </StatusBadge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      accessor: (r) => r.action,
      sortable: true,
      render: (r) => (
        <span className="text-ink font-medium text-xs">{ACTION_LABEL[r.action]}</span>
      ),
    },
    {
      key: 'target',
      header: 'Target',
      accessor: (r) => r.targetName,
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="text-ink text-xs font-medium truncate">{r.targetName}</div>
          <div className="text-[10px] text-ink-muted font-mono truncate">
            {r.targetType}:{r.targetId}
          </div>
        </div>
      ),
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (r) =>
        r.notes ? (
          <span
            className="text-ink-secondary text-xs line-clamp-2 max-w-[220px] block"
            title={r.notes}
          >
            {r.notes}
          </span>
        ) : (
          <span className="text-ink-muted text-xs">—</span>
        ),
    },
  ]

  /* ---------------------------- render ---------------------------- */

  if (isError) {
    return (
      <AppShell title="Audit Export Tool">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load audit log"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Audit Export Tool">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-ink">
            Operations & Audit Reporting
          </h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Fleet compliance exports and audit trail records
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-muted sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald animate-pulse" />
            Live · {formatRelative(lastUpdated)}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={refreshing ? 'animate-spin' : undefined}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <ExportActions
            recordCount={filtered.length}
            onExportCsv={handleExportCsv}
            onExportPdf={handleExportPdf}
            onExportJson={handleExportJson}
            filterSummary={buildFilterSummary()}
          />
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={<Activity size={14} aria-hidden="true" />}
          tone="slate"
          label="Total events"
          value={stats.total.toLocaleString()}
          hint="Audit records on file"
        />
        <KpiCard
          icon={<ShieldAlert size={14} aria-hidden="true" />}
          tone="red"
          label="Critical actions"
          value={stats.critical.toLocaleString()}
          hint="Deletes · suspends · waives"
        />
        <KpiCard
          icon={<ShieldCheck size={14} aria-hidden="true" />}
          tone="sky"
          label="Security events"
          value={stats.security.toLocaleString()}
          hint="Logins · logouts"
        />
        <KpiCard
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone={stats.flagged > 0 ? 'amber' : 'slate'}
          label="Flagged"
          value={stats.flagged.toLocaleString()}
          hint={stats.flagged > 0 ? 'Anomalies detected' : 'No anomalies'}
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key
          const count =
            key === 'all'
              ? stats.total
              : key === 'critical'
                ? stats.critical
                : key === 'security'
                  ? stats.security
                  : stats.flagged
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              aria-pressed={active}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                active
                  ? key === 'flagged'
                    ? 'border-danger bg-danger text-white shadow-sm shadow-danger/20'
                    : 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
              ].join(' ')}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
              {count > 0 ? (
                <span
                  className={[
                    'inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                    active
                      ? 'bg-white/25 text-white'
                      : key === 'flagged'
                        ? 'bg-red-100 text-danger'
                        : 'bg-surface-alt text-ink-muted',
                  ].join(' ')}
                >
                  {count}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="mb-4">
        <FilterPanel
          from={from}
          to={to}
          module={module}
          action={action}
          adminId={adminId}
          admins={admins}
          onFromChange={setFrom}
          onToChange={setTo}
          onModuleChange={setModule}
          onActionChange={setAction}
          onAdminChange={setAdminId}
          onClear={handleClear}
          matchingCount={filtered.length}
          search={search}
          onSearchChange={setSearch}
          showDatePresets
          totalCount={log.length}
        />
      </div>

      {isLoading ? (
        <div className="rounded-xl bg-surface border border-border p-6 space-y-3">
          <Skeleton className="h-4 w-40 mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-surface border border-border">
          <EmptyState
            icon={Shield}
            title="No records match these filters"
            description="Adjust the date range or select a different module to see results."
          />
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          searchable={false}
          pageSize={10}
          title="Matching Records (Preview)"
          actions={(r) => (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View details"
              title="View details"
            >
              <Eye size={15} aria-hidden="true" />
            </button>
          )}
        />
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-ink-muted" />
            <h3 className="text-sm font-semibold text-ink">Recent Exports</h3>
          </div>
          <span className="text-xs text-ink-muted">Last 30 days</span>
        </div>

        <div className="rounded-xl bg-surface border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {[
              { id: '1', format: 'csv' as const, filterSummary: 'Drivers · Approvals · Sept 15–19', recordCount: 42, sizeBytes: 12840, createdBy: 'Damilare Opeyemi', createdAt: new Date(Date.now() - 180 * 60 * 1000).toISOString() },
              { id: '2', format: 'csv' as const, filterSummary: 'Financials · Full ledger · Sept 11–17', recordCount: 138, sizeBytes: 41220, createdBy: 'Eguine Ejike', createdAt: new Date(Date.now() - 1440 * 60 * 1000).toISOString() },
              { id: '3', format: 'pdf' as const, filterSummary: 'Weekly compliance report', recordCount: 210, sizeBytes: 98400, createdBy: 'Oladayo Ayomide', createdAt: new Date(Date.now() - 2880 * 60 * 1000).toISOString() },
            ].map((exp) => (
              <div key={exp.id} className="flex items-center gap-4 px-4 py-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-light text-emerald flex items-center justify-center flex-shrink-0">
                  <Download size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink truncate">
                    {exp.filterSummary}
                  </div>
                  <div className="text-[11px] text-ink-secondary mt-0.5">
                    {exp.recordCount} records · {formatBytes(exp.sizeBytes)} ·{' '}
                    {timeAgo(exp.createdAt)}
                  </div>
                </div>
                <span className="text-[11px] font-mono text-ink-muted uppercase">
                  {exp.format}
                </span>
                <span className="text-[11px] text-ink-secondary truncate max-w-[120px] hidden md:block">
                  {exp.createdBy}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedEntry ? (
        <AuditDetailDrawer
          entry={selectedEntry}
          anomalies={selectedAnomalies}
          onClose={() => setSelectedId(null)}
        />
      ) : null}
    </AppShell>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  tone: 'emerald' | 'red' | 'amber' | 'sky' | 'slate'
  label: string
  value: string
  hint: string
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-emerald-light text-emerald-dark',
    red: 'bg-red-50 text-danger',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    slate: 'bg-surface-alt text-ink-secondary',
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </div>
          <div className="text-base font-bold text-ink tabular-nums truncate">
            {value}
          </div>
        </div>
      </div>
      <div className="mt-1.5 truncate text-[10px] text-ink-muted">{hint}</div>
    </div>
  )
}

function AuditDetailDrawer({
  entry,
  anomalies,
  onClose,
}: {
  entry: AuditEntry
  anomalies: Array<{ type: string; severity: string; message: string }>
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const fp = fingerprint(entry)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify({ ...entry, fingerprint: fp }, null, 2),
      )
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Audit entry details"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink truncate">
                {entry.id}
              </span>
              <StatusBadge status={MODULE_TONE[entry.module]}>
                {entry.module}
              </StatusBadge>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {timeAgo(entry.createdAt)} ·{' '}
              {new Date(entry.createdAt).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
            aria-label="Close details"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              {ACTION_LABEL[entry.action]}
            </div>
            <div className="text-sm font-semibold text-ink">{entry.targetName}</div>
            <div className="text-[11px] text-ink-secondary font-mono mt-0.5">
              {entry.targetType}:{entry.targetId}
            </div>
            {entry.notes ? (
              <div className="mt-2 rounded-md bg-surface p-2 text-xs text-ink-secondary border border-border">
                {entry.notes}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DetailField label="Admin" value={entry.adminName} />
            <DetailField label="Admin ID" value={entry.adminId} mono />
            <DetailField label="IP Address" value={entry.ip} mono />
            <DetailField
              label="Timestamp"
              value={new Date(entry.createdAt).toLocaleString()}
            />
          </div>

          <div className="rounded-lg border border-border bg-surface p-3">
            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <Fingerprint size={11} aria-hidden="true" />
              Integrity Fingerprint
            </div>
            <div className="font-mono text-xs text-ink break-all bg-surface-alt rounded p-2">
              {fp}
            </div>
            <p className="mt-1 text-[10px] text-ink-muted">
              Tamper-evident hash derived from the entry contents.
            </p>
          </div>

          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <AlertTriangle size={11} aria-hidden="true" />
              Anomalies
              {anomalies.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                  {anomalies.length}
                </span>
              ) : null}
            </div>
            {anomalies.length === 0 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                No anomalies detected for this event.
              </div>
            ) : (
              <div className="space-y-1">
                {anomalies.map((a) => {
                  const style = ANOMALY_STYLES[a.severity] ?? ANOMALY_STYLES.medium
                  const Icon = style.icon
                  return (
                    <div
                      key={`${a.type}-${a.severity}`}
                      className={`flex items-start gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] ${style.bg} ${style.text}`}
                    >
                      <Icon size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{a.message}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-border bg-surface-alt/50 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Raw payload
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {JSON.stringify(entry, null, 2)}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            {copied ? (
              <>
                <Check size={12} className="text-emerald" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy size={12} aria-hidden="true" />
                Copy JSON
              </>
            )}
          </button>
          <span className="font-mono text-[10px] text-ink-muted">v1</span>
        </div>
      </div>
    </div>
  )
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div
        className={`mt-0.5 text-xs font-medium text-ink break-words ${mono ? 'font-mono' : ''}`}
      >
        {value}
      </div>
    </div>
  )
}