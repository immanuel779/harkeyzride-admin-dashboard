import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Eye,
  FileJson,
  Loader2,
  Mail,
  Phone,
  ShieldAlert,
  Star,
  TrendingUp,
  UserCheck,
  UserPlus,
  UserX,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { ErrorState } from '../../../components/shared/ErrorState'
import {
  DataTable,
  type BulkAction,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import {
  useReinstateRider,
  useRiders,
  useSuspendRider,
} from '../../../hooks/queries/useRiders'
import type { Rider, RiderStatus } from '../data/mockRiders'

/* ==========================================================================
   CONFIG (original STATUS_MAP preserved)
   ========================================================================== */

const STATUS_MAP: Record<
  RiderStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  nin_pending: { label: 'NIN Pending', tone: 'warning' },
}

const HIGH_WALLET_THRESHOLD = 20000
const LOW_RATING_THRESHOLD = 3.5
const NEW_RIDER_DAYS = 30
const DORMANT_DAYS = 90

const ANIMATIONS = `
  @keyframes rp-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rp-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes rp-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes rp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes rp-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .rp-fade-up { animation: rp-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .rp-fade-in { animation: rp-fade-in .2s ease both; }
  .rp-slide-in { animation: rp-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .rp-pop { animation: rp-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .rp-pulse { animation: rp-pulse 1.5s ease-in-out infinite; }
  .rp-shimmer { position: relative; overflow: hidden; }
  .rp-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .rp-shimmer:hover::after { animation: rp-shimmer 1s ease; }
  .rp-stagger > * { animation: rp-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .rp-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .rp-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .rp-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .rp-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .rp-stagger > *:nth-child(5) { animation-delay: 240ms; }
  @media (prefers-reduced-motion: reduce) {
    .rp-fade-up, .rp-fade-in, .rp-slide-in, .rp-pop, .rp-pulse,
    .rp-stagger > *, .rp-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   TYPES
   ========================================================================== */

type PendingAction =
  | { type: 'suspend'; rider: Rider }
  | { type: 'reinstate'; rider: Rider }
  | null

type RiderTab = 'all' | 'active' | 'suspended' | 'nin_pending' | 'flagged'

type RiderAnomalyType =
  | 'high_wallet'
  | 'low_rating'
  | 'nin_pending'
  | 'new_no_rides'
  | 'dormant'

type RiderAnomaly = {
  type: RiderAnomalyType
  label: string
  severity: 'critical' | 'high' | 'medium' | 'low'
}

const TABS: Array<{ key: RiderTab; label: string; icon: typeof UserCheck }> = [
  { key: 'all', label: 'All riders', icon: UserCheck },
  { key: 'active', label: 'Active', icon: UserCheck },
  { key: 'suspended', label: 'Suspended', icon: UserX },
  { key: 'nin_pending', label: 'NIN pending', icon: ShieldAlert },
  { key: 'flagged', label: 'Flagged', icon: AlertTriangle },
]

const ANOMALY_STYLES: Record<
  RiderAnomaly['severity'],
  { bg: string; text: string }
> = {
  critical: { bg: 'bg-red-50', text: 'text-danger' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700' },
  medium: { bg: 'bg-sky-50', text: 'text-sky-700' },
  low: { bg: 'bg-slate-100', text: 'text-slate-700' },
}

/* ==========================================================================
   HELPERS
   ========================================================================== */

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30)
  return `${mo}mo ago`
}

function daysSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function computeAnomalies(r: Rider): RiderAnomaly[] {
  const out: RiderAnomaly[] = []
  if (r.walletBalance >= HIGH_WALLET_THRESHOLD) {
    out.push({
      type: 'high_wallet',
      label: `High wallet: ${formatNaira(r.walletBalance)}`,
      severity: 'medium',
    })
  }
  if (r.rating < LOW_RATING_THRESHOLD && r.totalRides >= 3) {
    out.push({
      type: 'low_rating',
      label: `Low rating: ${r.rating.toFixed(1)} ★`,
      severity: 'high',
    })
  }
  if (r.status === 'nin_pending') {
    out.push({
      type: 'nin_pending',
      label: 'NIN verification pending',
      severity: 'high',
    })
  }
  const days = daysSince(r.joinedAt)
  if (r.totalRides === 0 && days != null && days <= NEW_RIDER_DAYS) {
    out.push({
      type: 'new_no_rides',
      label: `New rider, no rides yet (${days}d)`,
      severity: 'low',
    })
  }
  if (r.totalRides === 0 && days != null && days > DORMANT_DAYS) {
    out.push({
      type: 'dormant',
      label: `Dormant ${days}d, no rides`,
      severity: 'medium',
    })
  }
  return out
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function isoFilename(ext: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
  return `riders-${stamp}.${ext}`
}

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

function buildRidersCSV(riders: Rider[]): string {
  const headers = [
    'id', 'name', 'phone', 'email', 'city',
    'walletBalance', 'totalRides', 'rating', 'joinedAt', 'status',
  ]
  const lines = [headers.join(',')]
  for (const r of riders) {
    lines.push(
      [
        r.id,
        r.name,
        r.phone,
        r.email,
        r.city,
        String(r.walletBalance),
        String(r.totalRides),
        String(r.rating),
        r.joinedAt,
        r.status,
      ]
        .map(escapeCSV)
        .join(','),
    )
  }
  return lines.join('\n')
}

function riderSummary(r: Rider): string {
  return [
    `Rider: ${r.name}`,
    `Phone: ${r.phone}`,
    `Email: ${r.email}`,
    `City: ${r.city}`,
    `Wallet: ${formatNaira(r.walletBalance)}`,
    `Rides: ${r.totalRides}`,
    `Rating: ${r.rating.toFixed(1)} ★`,
    `Joined: ${r.joinedAt}`,
    `Status: ${STATUS_MAP[r.status].label}`,
  ].join('\n')
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function RidersPage() {
  const navigate = useNavigate()
  const { data: riders = [], isLoading, isError, error, refetch } = useRiders()
  const suspend = useSuspendRider()
  const reinstate = useReinstateRider()

  /* ---------------------------- state ---------------------------- */

  const [pending, setPending] = useState<PendingAction>(null)
  const [tab, setTab] = useState<RiderTab>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())

  const copiedTimerRef = useRef<number | null>(null)
  const isWorking = suspend.isPending || reinstate.isPending

  /* ---------------------------- derived -------------------------- */

  const anomaliesByRider = useMemo(() => {
    const map = new Map<string, RiderAnomaly[]>()
    for (const r of riders) map.set(r.id, computeAnomalies(r))
    return map
  }, [riders])

  const flaggedIds = useMemo(() => {
    const set = new Set<string>()
    for (const [id, list] of anomaliesByRider) if (list.length > 0) set.add(id)
    return set
  }, [anomaliesByRider])

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'active':
        return riders.filter((r) => r.status === 'active')
      case 'suspended':
        return riders.filter((r) => r.status === 'suspended')
      case 'nin_pending':
        return riders.filter((r) => r.status === 'nin_pending')
      case 'flagged':
        return riders.filter((r) => flaggedIds.has(r.id))
      default:
        return riders
    }
  }, [riders, tab, flaggedIds])

  const tabCounts = useMemo<Record<RiderTab, number>>(() => {
    return {
      all: riders.length,
      active: riders.filter((r) => r.status === 'active').length,
      suspended: riders.filter((r) => r.status === 'suspended').length,
      nin_pending: riders.filter((r) => r.status === 'nin_pending').length,
      flagged: flaggedIds.size,
    }
  }, [riders, flaggedIds])

  const stats = useMemo(() => {
    const total = riders.length
    const active = riders.filter((r) => r.status === 'active').length
    const suspended = riders.filter((r) => r.status === 'suspended').length
    const ninPending = riders.filter((r) => r.status === 'nin_pending').length
    const totalWallet = riders.reduce((s, r) => s + r.walletBalance, 0)
    const totalRides = riders.reduce((s, r) => s + r.totalRides, 0)
    const avgRating =
      total > 0 ? riders.reduce((s, r) => s + r.rating, 0) / total : 0
    return {
      total,
      active,
      suspended,
      ninPending,
      totalWallet,
      totalRides,
      avgRating,
      flagged: flaggedIds.size,
    }
  }, [riders, flaggedIds])

  const detail = useMemo(
    () => (detailId ? riders.find((r) => r.id === detailId) ?? null : null),
    [riders, detailId],
  )

  /* --------------------------- effects --------------------------- */

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailId) {
          setDetailId(null)
          return
        }
        if (pending) {
          if (!isWorking) setPending(null)
          return
        }
        return
      }

      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportCSV()
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleExportJSON()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, pending, isWorking, tabFiltered, tab])

  /* --------------------------- handlers -------------------------- */

  const handleConfirm = async () => {
    if (!pending) return
    try {
      if (pending.type === 'suspend') {
        await suspend.mutateAsync(pending.rider.id)
        toast.error(
          `${pending.rider.name} suspended`,
          'Rider cannot book rides until reinstated.',
        )
      } else {
        await reinstate.mutateAsync(pending.rider.id)
        toast.success(`${pending.rider.name} reinstated`, 'Full access restored.')
      }
      setPending(null)
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setLastUpdated(Date.now())
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleExportCSV = useCallback(() => {
    if (tabFiltered.length === 0) {
      toast.error('Nothing to export', 'No riders match the current view.')
      return
    }
    downloadFile(buildRidersCSV(tabFiltered), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success(
      'CSV exported',
      `${tabFiltered.length} ${tabFiltered.length === 1 ? 'rider' : 'riders'} downloaded.`,
    )
  }, [tabFiltered])

  const handleExportJSON = useCallback(() => {
    if (tabFiltered.length === 0) {
      toast.error('Nothing to export', 'No riders match the current view.')
      return
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      count: tabFiltered.length,
      tab,
      stats,
      riders: tabFiltered.map((r) => ({
        ...r,
        anomalies: anomaliesByRider.get(r.id) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success(
      'JSON exported',
      `${tabFiltered.length} ${tabFiltered.length === 1 ? 'rider' : 'riders'} downloaded.`,
    )
  }, [tabFiltered, tab, stats, anomaliesByRider])

  const handleCopy = useCallback(async (r: Rider) => {
    try {
      await navigator.clipboard.writeText(riderSummary(r))
      setCopied(r.id)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [])

  /* --------------------------- columns --------------------------- */

  const columns: DataTableColumn<Rider>[] = [
    {
      key: 'name',
      header: 'Rider',
      accessor: (r) => r.name,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald text-white flex items-center justify-center text-xs font-semibold">
            {r.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ink truncate">{r.name}</div>
            <div className="text-xs text-ink-secondary truncate">{r.phone}</div>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'City', accessor: (r) => r.city, sortable: true },
    {
      key: 'walletBalance',
      header: 'Wallet',
      accessor: (r) => r.walletBalance,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{formatNaira(r.walletBalance)}</span>
          {r.walletBalance >= HIGH_WALLET_THRESHOLD ? (
            <span
              title="High-value wallet"
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
            >
              <Zap size={8} aria-hidden="true" />
              High
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'totalRides',
      header: 'Rides',
      accessor: (r) => r.totalRides,
      sortable: true,
      render: (r) => <span className="text-ink-secondary">{r.totalRides}</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      accessor: (r) => r.rating,
      sortable: true,
      render: (r) => (
        <span
          className={`inline-flex items-center gap-1 ${
            r.rating < LOW_RATING_THRESHOLD && r.totalRides >= 3
              ? 'text-danger'
              : 'text-ink'
          }`}
        >
          <Star
            size={11}
            className={
              r.rating < LOW_RATING_THRESHOLD && r.totalRides >= 3
                ? 'fill-danger text-danger'
                : 'fill-amber-400 text-amber-400'
            }
            aria-hidden="true"
          />
          {r.rating.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      accessor: (r) => r.joinedAt,
      sortable: true,
      render: (r) => (
        <span
          title={r.joinedAt}
          className="text-ink-secondary text-xs"
        >
          {formatRelativeTime(r.joinedAt)}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      sortable: true,
      render: (r) => {
        const cfg = STATUS_MAP[r.status]
        return <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (r) => {
        const list = anomaliesByRider.get(r.id) ?? []
        if (list.length === 0) {
          return <span className="text-[10px] text-ink-muted/60">—</span>
        }
        const top = list[0]
        const style = ANOMALY_STYLES[top.severity]
        return (
          <span
            title={list.map((a) => a.label).join(' · ')}
            className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${style.bg} ${style.text}`}
          >
            <AlertTriangle size={9} aria-hidden="true" />
            {list.length === 1 ? '1 flag' : `${list.length} flags`}
          </span>
        )
      },
    },
  ]

  /* --------------------------- filters --------------------------- */

  const filters: DataTableFilter<Rider>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'nin_pending', label: 'NIN Pending' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'city',
      label: 'City',
      options: [
        { value: 'Ibadan', label: 'Ibadan' },
        { value: 'Lagos', label: 'Lagos' },
        { value: 'Abuja', label: 'Abuja' },
      ],
      apply: (row, value) => row.city === value,
    },
  ]

  /* ----------------------- bulk actions -------------------------- */

  const bulkActions: BulkAction<Rider>[] = [
    {
      key: 'export',
      label: 'Export selected',
      onRun: (rows) => {
        if (rows.length === 0) return
        downloadFile(buildRidersCSV(rows), isoFilename('csv'), 'text/csv;charset=utf-8')
        toast.success(
          `${rows.length} ${rows.length === 1 ? 'rider' : 'riders'} exported`,
          'CSV downloaded.',
        )
      },
    },
    {
      key: 'suspend',
      label: 'Suspend selected',
      tone: 'danger',
      onRun: async (rows) => {
        // 🟡 BACKEND REQUIRED — bulk endpoint once available
        // For now: sequential calls to /admin/riders/:id/suspend
        let ok = 0
        let failed = 0
        for (const r of rows) {
          try {
            await suspend.mutateAsync(r.id)
            ok++
          } catch {
            failed++
          }
        }
        if (failed === 0) {
          toast.error(`${ok} riders suspended`, 'Full access revoked.')
        } else {
          toast.warning(
            `${ok} suspended · ${failed} failed`,
            'Some riders could not be processed.',
          )
        }
      },
    },
    {
      key: 'reinstate',
      label: 'Reinstate selected',
      tone: 'primary',
      onRun: async (rows) => {
        let ok = 0
        let failed = 0
        for (const r of rows) {
          try {
            await reinstate.mutateAsync(r.id)
            ok++
          } catch {
            failed++
          }
        }
        if (failed === 0) {
          toast.success(`${ok} riders reinstated`, 'Full access restored.')
        } else {
          toast.warning(
            `${ok} reinstated · ${failed} failed`,
            'Some riders could not be processed.',
          )
        }
      },
    },
  ]

  /* ---------------------------- render --------------------------- */

  if (isError) {
    return (
      <AppShell title="Riders">
        <style>{ANIMATIONS}</style>
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load riders"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Riders">
      <style>{ANIMATIONS}</style>

      {/* -------------------- KPI cards -------------------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 rp-stagger">
        <KpiCard
          icon={<UserCheck size={14} aria-hidden="true" />}
          tone="slate"
          label="Total riders"
          value={stats.total.toLocaleString()}
          hint={`${stats.totalRides.toLocaleString()} rides`}
        />
        <KpiCard
          icon={<CheckCircle2 size={14} aria-hidden="true" />}
          tone="emerald"
          label="Active"
          value={stats.active.toLocaleString()}
          hint={`${stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0}% of roster`}
        />
        <KpiCard
          icon={<Ban size={14} aria-hidden="true" />}
          tone="red"
          label="Suspended"
          value={stats.suspended.toLocaleString()}
          hint="No booking access"
        />
        <KpiCard
          icon={<ShieldAlert size={14} aria-hidden="true" />}
          tone="amber"
          label="NIN pending"
          value={stats.ninPending.toLocaleString()}
          hint="Verification required"
        />
        <KpiCard
          icon={<Wallet size={14} aria-hidden="true" />}
          tone="sky"
          label="Total wallet"
          value={formatNaira(stats.totalWallet)}
          hint={`Avg ${stats.avgRating.toFixed(1)} ★`}
        />
      </div>

      {/* -------------------- Tabs + actions -------------------- */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rp-fade-up">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            const count = tabCounts[key]
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                  active
                    ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                    : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                ].join(' ')}
              >
                <Icon size={12} aria-hidden="true" />
                {label}
                {count > 0 ? (
                  <span
                    className={[
                      'rp-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'flagged'
                          ? 'bg-amber-100 text-amber-700'
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-muted sm:inline-flex">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald rp-pulse"
              aria-hidden="true"
            />
            Live · {formatRelativeTime(new Date(lastUpdated).toISOString())}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors disabled:opacity-50"
          >
            {refreshing ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <TrendingUp size={12} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export CSV (Ctrl/Cmd + E)"
            className="rp-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            title="Export JSON (Ctrl/Cmd + J)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>

      {/* -------------------- Table -------------------- */}
      <DataTable
        data={tabFiltered}
        columns={columns}
        rowKey={(r) => r.id}
        filters={filters}
        searchable
        searchPlaceholder="Search by name, phone, email…"
        searchFn={(r, q) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
        }
        pageSize={6}
        loading={isLoading}
        title="All Riders"
        selectable
        bulkActions={bulkActions}
        isRowSelectable={(r) =>
          r.status === 'active' || r.status === 'suspended'
        }
        viewKey="riders"
        exportFileName="riders"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="Open rider details"
              title="Quick view"
            >
              <AlertCircle size={15} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(r)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="Copy rider summary"
              title={copied === r.id ? 'Copied' : 'Copy summary'}
            >
              {copied === r.id ? (
                <Check size={15} className="text-emerald" aria-hidden="true" />
              ) : (
                <ClipboardCopy size={15} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/riders/${r.id}`)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View full rider profile"
              title="Open profile"
            >
              <Eye size={15} aria-hidden="true" />
            </button>
            {r.status === 'active' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPending({ type: 'suspend', rider: r })
                }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-danger transition-colors"
                aria-label="Suspend rider"
                title="Suspend"
              >
                <Ban size={15} aria-hidden="true" />
              </button>
            ) : r.status === 'suspended' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPending({ type: 'reinstate', rider: r })
                }}
                className="p-1.5 rounded-lg hover:bg-emerald-light text-emerald transition-colors"
                aria-label="Reinstate rider"
                title="Reinstate"
              >
                <CheckCircle2 size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        )}
      />

      {/* -------------------- Single-rider confirm modal (preserved) -------------------- */}
      <ConfirmModal
        open={pending !== null}
        title={
          pending?.type === 'suspend'
            ? `Suspend ${pending.rider.name}?`
            : pending?.type === 'reinstate'
              ? `Reinstate ${pending.rider.name}?`
              : ''
        }
        description={
          pending?.type === 'suspend'
            ? 'This rider will not be able to book rides until reinstated.'
            : 'This rider will regain full access to book rides.'
        }
        confirmLabel={pending?.type === 'suspend' ? 'Suspend' : 'Reinstate'}
        variant={pending?.type === 'suspend' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />

      {/* -------------------- Detail drawer -------------------- */}
      {detail ? (
        <div
          className="rp-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Rider details"
          onClick={() => setDetailId(null)}
        >
          <div
            className="rp-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald text-white text-sm font-semibold shrink-0">
                  {detail.name.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-ink truncate">
                      {detail.name}
                    </h2>
                    <StatusBadge status={STATUS_MAP[detail.status].tone}>
                      {STATUS_MAP[detail.status].label}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Joined {formatRelativeTime(detail.joinedAt)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetailId(null)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                aria-label="Close details"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Contact */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Contact
                </div>
                <div className="flex items-center gap-2">
                  <Phone size={12} className="text-ink-muted" aria-hidden="true" />
                  <span className="text-xs text-ink">{detail.phone}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(detail.phone)}
                    className="ml-auto rounded p-0.5 text-ink-muted hover:text-emerald"
                    aria-label="Copy phone"
                  >
                    <ClipboardCopy size={11} aria-hidden="true" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <Mail size={12} className="text-ink-muted" aria-hidden="true" />
                  <span className="truncate text-xs text-ink">{detail.email}</span>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(detail.email)}
                    className="ml-auto rounded p-0.5 text-ink-muted hover:text-emerald"
                    aria-label="Copy email"
                  >
                    <ClipboardCopy size={11} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="Wallet"
                  value={formatNaira(detail.walletBalance)}
                />
                <DetailField label="City" value={detail.city} />
                <DetailField label="Rides" value={String(detail.totalRides)} />
                <DetailField
                  label="Rating"
                  value={`${detail.rating.toFixed(1)} ★`}
                />
              </div>

              {/* Anomalies */}
              {(() => {
                const list = anomaliesByRider.get(detail.id) ?? []
                return (
                  <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      <ShieldAlert size={11} aria-hidden="true" />
                      Flags
                      {list.length > 0 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                          {list.length}
                        </span>
                      ) : null}
                    </div>
                    {list.length === 0 ? (
                      <div className="rounded-md border border-emerald/20 bg-emerald-light/40 px-2.5 py-1.5 text-[11px] text-emerald-dark">
                        No anomalies detected.
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {list.map((a) => {
                          const style = ANOMALY_STYLES[a.severity]
                          return (
                            <div
                              key={a.type}
                              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${style.bg} ${style.text}`}
                            >
                              <AlertTriangle size={11} aria-hidden="true" />
                              {a.label}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Raw payload */}
              <div className="rounded-lg border border-border bg-surface-alt/50 p-3">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Raw payload
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
              <button
                type="button"
                onClick={() => handleCopy(detail)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                {copied === detail.id ? (
                  <>
                    <Check size={12} className="text-emerald" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={12} aria-hidden="true" />
                    Copy summary
                  </>
                )}
              </button>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate(`/riders/${detail.id}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
                >
                  <Eye size={12} aria-hidden="true" />
                  Profile
                </button>
                {detail.status === 'active' ? (
                  <button
                    type="button"
                    onClick={() => setPending({ type: 'suspend', rider: detail })}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                  >
                    <Ban size={12} aria-hidden="true" />
                    Suspend
                  </button>
                ) : detail.status === 'suspended' ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPending({ type: 'reinstate', rider: detail })
                    }
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
                  >
                    <CheckCircle2 size={12} aria-hidden="true" />
                    Reinstate
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
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
      <div className="mt-1.5 text-[10px] text-ink-muted truncate">{hint}</div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-medium text-ink break-words">
        {value}
      </div>
    </div>
  )
}