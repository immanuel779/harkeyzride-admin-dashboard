import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  Eye,
  FileJson,
  Flag,
  Gauge,
  Keyboard,
  MapPin,
  Navigation,
  Pause,
  Play,
  RefreshCw,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  DataTable,
  type BulkAction,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { toast } from '../../../lib/toast'
import { useRides } from '../../../hooks/queries/useRides'
import type { Ride, RideStatus } from '../data/mockRides'

/* ==========================================================================
   CONFIG (original STATUS_MAP preserved)
   ========================================================================== */

const STATUS_MAP: Record<
  RideStatus,
  {
    label: string
    tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  }
> = {
  in_progress: { label: 'In Progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  sos: { label: 'SOS', tone: 'danger' },
}

const HIGH_FARE_THRESHOLD = 5000
const AUTO_REFRESH_MS = 30_000

type TabKey =
  | 'all'
  | 'live'
  | 'sos'
  | 'completed'
  | 'cancelled'
  | 'high_value'
  | 'flagged'

type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

type Anomaly = {
  type: string
  label: string
  severity: AnomalySeverity
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Navigation }> = [
  { key: 'all', label: 'All rides', icon: Navigation },
  { key: 'live', label: 'Live', icon: Play },
  { key: 'sos', label: 'SOS', icon: AlertTriangle },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', icon: Ban },
  { key: 'high_value', label: 'High value', icon: TrendingUp },
  { key: 'flagged', label: 'Flagged', icon: Flag },
]

const ANOMALY_STYLES: Record<AnomalySeverity, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-danger' },
  high: { bg: 'bg-amber-50', text: 'text-amber-700' },
  medium: { bg: 'bg-sky-50', text: 'text-sky-700' },
  low: { bg: 'bg-slate-100', text: 'text-slate-700' },
}

const ANOMALY_ORDER: Record<AnomalySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const ANIMATIONS = `
  @keyframes rp-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rp-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes rp-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes rp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes rp-sos-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,.45); } 70% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }
  @keyframes rp-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .rp-fade-up { animation: rp-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .rp-fade-in { animation: rp-fade-in .2s ease both; }
  .rp-slide-in { animation: rp-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .rp-pop { animation: rp-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .rp-pulse { animation: rp-pulse 1.5s ease-in-out infinite; }
  .rp-sos-pulse { animation: rp-sos-pulse 1.8s ease-out infinite; }
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
    .rp-sos-pulse, .rp-stagger > *, .rp-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

// Backend returns UUIDs; show a short readable form
function shortId(id: string) {
  if (id.startsWith('rd_')) return id.replace('rd_', '')
  return id.slice(0, 8).toUpperCase()
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function formatRelativeTime(iso: string | number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
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
  return `rides-${stamp}.${ext}`
}

function isHighValue(ride: Ride): boolean {
  return ride.fare >= HIGH_FARE_THRESHOLD
}

function computeAnomalies(
  ride: Ride,
  allRides: Ride[],
): Anomaly[] {
  const out: Anomaly[] = []

  if (ride.status === 'sos') {
    out.push({
      type: 'sos',
      label: 'Live SOS — emergency in progress',
      severity: 'critical',
    })
  }

  if (ride.status === 'in_progress' && ride.fare >= HIGH_FARE_THRESHOLD) {
    out.push({
      type: 'high_fare_live',
      label: `High-fare live trip (${formatNaira(ride.fare)})`,
      severity: 'high',
    })
  }

  if (ride.status === 'cancelled' && ride.fare > 0) {
    out.push({
      type: 'cancelled_with_fare',
      label: `Cancelled but fare charged (${formatNaira(ride.fare)})`,
      severity: 'medium',
    })
  }

  // Driver appears in more than one live ride (system issue)
  if (ride.status === 'in_progress' && ride.driver && ride.driver !== '—') {
    const liveWithDriver = allRides.filter(
      (r) => r.status === 'in_progress' && r.driver === ride.driver,
    )
    if (liveWithDriver.length > 1) {
      out.push({
        type: 'driver_duplicate_live',
        label: `${ride.driver} has ${liveWithDriver.length} live trips`,
        severity: 'high',
      })
    }
  }

  return out
}

function buildRideSummary(ride: Ride): string {
  return [
    `Ride #${shortId(ride.id)}`,
    `Status: ${STATUS_MAP[ride.status].label}`,
    `Rider: ${ride.rider}`,
    `Driver: ${ride.driver || '—'}`,
    `Route: ${ride.pickup} → ${ride.destination}`,
    `Fare: ${formatNaira(ride.fare)} (${ride.paymentMethod})`,
  ].join('\n')
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function RidesPage() {
  const navigate = useNavigate()
  const { data: rides = [], isLoading, isError, error, refetch } = useRides()

  const [tab, setTab] = useState<TabKey>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [searchQuery, setSearchQuery] = useState('')

  const copiedTimerRef = useRef<number | null>(null)

  /* ---------------------------- derived -------------------------- */

  // Anomalies per ride
  const anomaliesByRide = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const r of rides) map.set(r.id, computeAnomalies(r, rides))
    return map
  }, [rides])

  const flaggedIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, list] of anomaliesByRide) if (list.length > 0) s.add(id)
    return s
  }, [anomaliesByRide])

  // Tab-based filtering before DataTable filters apply
  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'live':
        return rides.filter((r) => r.status === 'in_progress')
      case 'sos':
        return rides.filter((r) => r.status === 'sos')
      case 'completed':
        return rides.filter((r) => r.status === 'completed')
      case 'cancelled':
        return rides.filter((r) => r.status === 'cancelled')
      case 'high_value':
        return rides.filter((r) => isHighValue(r))
      case 'flagged':
        return rides.filter((r) => flaggedIds.has(r.id))
      default:
        return rides
    }
  }, [rides, tab, flaggedIds])

  const counts = useMemo(() => {
    const inProgress = rides.filter((r) => r.status === 'in_progress').length
    const sos = rides.filter((r) => r.status === 'sos').length
    const completed = rides.filter((r) => r.status === 'completed').length
    const cancelled = rides.filter((r) => r.status === 'cancelled').length
    const highValue = rides.filter((r) => isHighValue(r)).length
    return {
      all: rides.length,
      live: inProgress,
      sos,
      completed,
      cancelled,
      high_value: highValue,
      flagged: flaggedIds.size,
    } as Record<TabKey, number>
  }, [rides, flaggedIds])

  const stats = useMemo(() => {
    const completed = rides.filter((r) => r.status === 'completed')
    const totalRevenue = completed.reduce((s, r) => s + r.fare, 0)
    const totalFareAll = rides.reduce((s, r) => s + r.fare, 0)
    const avgFare =
      completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0
    const walletCount = rides.filter((r) => r.paymentMethod === 'wallet').length
    const cashCount = rides.filter((r) => r.paymentMethod === 'cash').length

    return {
      total: rides.length,
      live: counts.live,
      sos: counts.sos,
      completed: counts.completed,
      cancelled: counts.cancelled,
      totalRevenue,
      totalFareAll,
      avgFare,
      walletCount,
      cashCount,
      walletShare:
        rides.length > 0 ? Math.round((walletCount / rides.length) * 100) : 0,
      flagged: counts.flagged,
      highValue: counts.high_value,
    }
  }, [rides, counts])

  const detail = useMemo(
    () => (detailId ? rides.find((r) => r.id === detailId) ?? null : null),
    [rides, detailId],
  )

  const detailAnomalies = useMemo(
    () => (detail ? anomaliesByRide.get(detail.id) ?? [] : []),
    [detail, anomaliesByRide],
  )

  /* --------------------------- effects --------------------------- */

  // Auto-refresh every N seconds when enabled
  useEffect(() => {
    if (!autoRefresh) return
    const id = window.setInterval(async () => {
      try {
        await refetch()
        setLastUpdated(Date.now())
      } catch {
        /* silent */
      }
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefresh, refetch])

  // Cleanup copy timer
  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (detailId) {
          setDetailId(null)
          return
        }
        return
      }
      if (inField) return
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
  }, [detailId, tabFiltered, tab])

  /* --------------------------- handlers -------------------------- */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setLastUpdated(Date.now())
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleExportCSV = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No rides match the current view.')
      return
    }
    const headers = [
      'id', 'status', 'rider', 'driver',
      'pickup', 'destination', 'fare', 'paymentMethod',
    ]
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push(
        [
          shortId(r.id), r.status, r.rider, r.driver,
          r.pickup, r.destination, String(r.fare), r.paymentMethod,
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success(
      'CSV exported',
      `${rows.length} ${rows.length === 1 ? 'ride' : 'rides'} downloaded.`,
    )
  }, [tabFiltered])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No rides match the current view.')
      return
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      stats,
      rides: rows.map((r) => ({
        ...r,
        anomalies: anomaliesByRide.get(r.id) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success(
      'JSON exported',
      `${rows.length} ${rows.length === 1 ? 'ride' : 'rides'} downloaded.`,
    )
  }, [tabFiltered, tab, stats, anomaliesByRide])

  const handleCopy = useCallback(async (r: Ride) => {
    try {
      await navigator.clipboard.writeText(buildRideSummary(r))
      setCopied(r.id)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [])

  /* --------------------------- columns --------------------------- */

  const columns: DataTableColumn<Ride>[] = [
    {
      key: 'id',
      header: 'Ride',
      accessor: (r) => r.id,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-ink font-medium">
            #{shortId(r.id)}
          </span>
          {r.status === 'sos' ? (
            <span
              className="rp-sos-pulse inline-block h-1.5 w-1.5 rounded-full bg-red-500"
              aria-label="SOS"
            />
          ) : null}
        </div>
      ),
    },
    {
      key: 'rider',
      header: 'Rider',
      accessor: (r) => r.rider,
      sortable: true,
      render: (r) => (
        <span className="text-ink font-medium truncate">{r.rider}</span>
      ),
    },
    {
      key: 'driver',
      header: 'Driver',
      accessor: (r) => r.driver,
      sortable: true,
      render: (r) => (
        <span className="text-ink-secondary truncate">{r.driver || '—'}</span>
      ),
    },
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <div className="text-xs">
          <div className="text-ink truncate max-w-[220px]">{r.pickup}</div>
          <div className="text-ink-secondary truncate max-w-[220px]">
            → {r.destination}
          </div>
        </div>
      ),
    },
    {
      key: 'fare',
      header: 'Fare',
      accessor: (r) => r.fare,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{formatNaira(r.fare)}</span>
          {isHighValue(r) ? (
            <span
              title="High-value ride"
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
      key: 'paymentMethod',
      header: 'Payment',
      accessor: (r) => r.paymentMethod,
      render: (r) => (
        <span className="text-xs text-ink-secondary capitalize">
          {r.paymentMethod}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      sortable: true,
      render: (r) => {
        const cfg = STATUS_MAP[r.status] ?? STATUS_MAP.in_progress
        return <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (r) => {
        const list = anomaliesByRide.get(r.id) ?? []
        if (list.length === 0) {
          return <span className="text-[10px] text-ink-muted/60">—</span>
        }
        const top = list.reduce((a, b) =>
          ANOMALY_ORDER[a.severity] >= ANOMALY_ORDER[b.severity] ? a : b,
        )
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

  const filters: DataTableFilter<Ride>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'sos', label: 'SOS' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      options: [
        { value: 'wallet', label: 'Wallet' },
        { value: 'cash', label: 'Cash' },
      ],
      apply: (row, value) => row.paymentMethod === value,
    },
    {
      key: 'fare',
      label: 'Fare',
      options: [
        { value: 'high', label: 'High (≥ ₦5k)' },
        { value: 'low', label: 'Regular (< ₦5k)' },
      ],
      apply: (row, value) => {
        if (value === 'high') return row.fare >= HIGH_FARE_THRESHOLD
        if (value === 'low') return row.fare < HIGH_FARE_THRESHOLD
        return true
      },
    },
    {
      key: 'flagged',
      label: 'Flags',
      options: [{ value: 'only', label: 'Flagged only' }],
      apply: (row, value) => {
        if (value === 'only') return flaggedIds.has(row.id)
        return true
      },
    },
  ]

  /* ----------------------- bulk actions -------------------------- */

  const bulkActions: BulkAction<Ride>[] = [
    {
      key: 'export',
      label: 'Export selected',
      onRun: (rows) => {
        if (rows.length === 0) return
        const headers = [
          'id', 'status', 'rider', 'driver',
          'pickup', 'destination', 'fare', 'paymentMethod',
        ]
        const lines = [headers.join(',')]
        for (const r of rows) {
          lines.push(
            [
              shortId(r.id), r.status, r.rider, r.driver,
              r.pickup, r.destination, String(r.fare), r.paymentMethod,
            ]
              .map((v) => escapeCSV(String(v ?? '')))
              .join(','),
          )
        }
        downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
        toast.success(
          `${rows.length} ${rows.length === 1 ? 'ride' : 'rides'} exported`,
          'CSV downloaded.',
        )
      },
    },
    {
      key: 'copy',
      label: 'Copy summaries',
      onRun: async (rows) => {
        if (rows.length === 0) return
        const text = rows.map(buildRideSummary).join('\n\n---\n\n')
        try {
          await navigator.clipboard.writeText(text)
          toast.success(
            `${rows.length} summaries copied`,
            'Paste anywhere — Slack, email, notes.',
          )
        } catch {
          toast.error('Copy failed', 'Clipboard unavailable.')
        }
      },
    },
  ]

  /* --------------------------- error state ------------------------ */

  if (isError) {
    return (
      <AppShell title="Rides">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load rides"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render --------------------------- */

  return (
    <AppShell title="Rides">
      <style>{ANIMATIONS}</style>

      {/* SOS banner — the most urgent operational alert */}
      {stats.sos > 0 ? (
        <div className="rp-fade-up mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-danger">
            <AlertTriangle size={16} className="rp-pulse" aria-hidden="true" />
            <span className="font-semibold">
              {stats.sos} active SOS {stats.sos === 1 ? 'emergency' : 'emergencies'}
            </span>
            <span className="text-xs text-danger/70">
              — immediate response required
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTab('sos')}
            className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600 transition-colors"
          >
            View SOS
            <ArrowRight size={11} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 rp-stagger">
        <KpiCard
          icon={<Navigation size={14} aria-hidden="true" />}
          tone="slate"
          label="Total rides"
          value={stats.total.toLocaleString()}
          hint={`${formatNaira(stats.totalFareAll)} gross`}
        />
        <KpiCard
          icon={<Play size={14} aria-hidden="true" />}
          tone="sky"
          label="Live now"
          value={stats.live.toLocaleString()}
          hint={stats.live > 0 ? 'Auto-refreshing' : 'No active trips'}
        />
        <KpiCard
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone={stats.sos > 0 ? 'red' : 'slate'}
          label="SOS"
          value={stats.sos.toLocaleString()}
          hint={stats.sos > 0 ? 'Respond immediately' : 'No emergencies'}
        />
        <KpiCard
          icon={<CheckCircle2 size={14} aria-hidden="true" />}
          tone="emerald"
          label="Completed"
          value={stats.completed.toLocaleString()}
          hint={`Avg ${formatNaira(stats.avgFare)}`}
        />
        <KpiCard
          icon={<TrendingUp size={14} aria-hidden="true" />}
          tone="amber"
          label="Revenue"
          value={formatNaira(stats.totalRevenue)}
          hint={`${stats.walletShare}% wallet`}
        />
      </div>

      {/* Secondary stats strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 rp-fade-up">
        <QuickStat
          icon={<Wallet size={13} className="text-emerald" aria-hidden="true" />}
          label="Wallet"
          value={String(stats.walletCount)}
        />
        <QuickStat
          icon={<Gauge size={13} className="text-sky-500" aria-hidden="true" />}
          label="Cash"
          value={String(stats.cashCount)}
        />
        <QuickStat
          icon={<Zap size={13} className="text-amber-500" aria-hidden="true" />}
          label="High value"
          value={String(stats.highValue)}
        />
        <QuickStat
          icon={<Flag size={13} className="text-danger" aria-hidden="true" />}
          label="Flagged"
          value={String(stats.flagged)}
        />
      </div>

      {/* Tabs + actions */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 rp-fade-up">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            const count = counts[key]
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
                        : key === 'sos'
                          ? 'bg-red-100 text-danger'
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
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                autoRefresh ? 'bg-emerald rp-pulse' : 'bg-ink-muted/40'
              }`}
              aria-hidden="true"
            />
            {autoRefresh ? 'Auto-refresh' : 'Manual'} · {formatRelativeTime(lastUpdated)}
          </span>
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            title={autoRefresh ? 'Pause auto-refresh' : 'Enable auto-refresh'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            {autoRefresh ? (
              <Pause size={12} aria-hidden="true" />
            ) : (
              <Play size={12} aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{autoRefresh ? 'Pause' : 'Live'}</span>
          </button>
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

      {/* Table */}
      <DataTable
        data={tabFiltered}
        columns={columns}
        rowKey={(r) => r.id}
        filters={filters}
        searchable
        searchPlaceholder="Search by ride ID, rider, driver…"
        searchFn={(r, q) =>
          r.id.toLowerCase().includes(q) ||
          r.rider.toLowerCase().includes(q) ||
          r.driver.toLowerCase().includes(q) ||
          r.pickup.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q)
        }
        pageSize={8}
        loading={isLoading}
        title="Live & Recent Rides"
        selectable
        bulkActions={bulkActions}
        viewKey="rides"
        exportFileName="rides"
        emptyMessage="No rides yet — rides will appear here as riders book trips"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === 'sos' ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-danger text-[10px] font-bold uppercase animate-pulse">
                <AlertTriangle size={12} aria-hidden="true" /> SOS
              </span>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="Open ride details"
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
              aria-label="Copy ride summary"
              title={copied === r.id ? 'Copied' : 'Copy summary'}
            >
              {copied === r.id ? (
                <CheckCircle2 size={15} className="text-emerald" aria-hidden="true" />
              ) : (
                <ClipboardCopy size={15} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/rides/${r.id}`)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View ride"
              title="View ride"
            >
              <Eye size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      />

      {/* Detail drawer */}
      {detail ? (
        <div
          className="rp-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Ride details"
          onClick={() => setDetailId(null)}
        >
          <div
            className="rp-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">
                    #{shortId(detail.id)}
                  </span>
                  <StatusBadge status={STATUS_MAP[detail.status].tone}>
                    {STATUS_MAP[detail.status].label}
                  </StatusBadge>
                  {isHighValue(detail) ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                      <Zap size={8} aria-hidden="true" />
                      High value
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {detail.paymentMethod === 'wallet' ? 'Wallet' : 'Cash'} ·{' '}
                  {formatNaira(detail.fare)}
                </p>
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
              {/* People */}
              <div className="grid grid-cols-2 gap-3">
                <PersonCard
                  role="Rider"
                  name={detail.rider}
                  tone="emerald"
                  icon={<User size={12} />}
                />
                <PersonCard
                  role="Driver"
                  name={detail.driver || '—'}
                  tone="navy"
                  icon={<User size={12} />}
                />
              </div>

              {/* Route */}
              <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  <MapPin size={11} aria-hidden="true" />
                  Route
                </div>
                <div className="flex items-start gap-2">
                  <div className="mt-1 flex flex-col items-center">
                    <span className="h-2 w-2 rounded-full bg-emerald" />
                    <span className="my-0.5 h-6 w-px bg-border" />
                    <span className="h-2 w-2 rounded-full bg-navy" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-muted">
                        Pickup
                      </div>
                      <div className="text-xs text-ink truncate">
                        {detail.pickup}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-ink-muted">
                        Destination
                      </div>
                      <div className="text-xs text-ink truncate">
                        {detail.destination}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment */}
              <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  <Wallet size={11} aria-hidden="true" />
                  Payment
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-ink-secondary capitalize">
                    {detail.paymentMethod}
                  </span>
                  <span className="text-lg font-bold text-ink tabular-nums">
                    {formatNaira(detail.fare)}
                  </span>
                </div>
              </div>

              {/* Anomalies */}
              {detailAnomalies.length > 0 ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <ShieldAlert size={11} aria-hidden="true" />
                    Flags
                    <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                      {detailAnomalies.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {detailAnomalies.map((a) => {
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
                </div>
              ) : (
                <div className="rounded-md border border-emerald/20 bg-emerald-light/40 px-2.5 py-1.5 text-[11px] text-emerald-dark">
                  No anomalies detected.
                </div>
              )}

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

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
              <button
                type="button"
                onClick={() => handleCopy(detail)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                {copied === detail.id ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={12} aria-hidden="true" />
                    Copy summary
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => navigate(`/rides/${detail.id}`)}
                className="inline-flex items-center gap-1 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
              >
                <Eye size={12} aria-hidden="true" />
                Full ride
              </button>
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
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass[tone]}`}>
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

function QuickStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      {icon}
      <div className="min-w-0">
        <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
          {label}
        </div>
        <div className="text-sm font-bold text-ink tabular-nums">{value}</div>
      </div>
    </div>
  )
}

function PersonCard({
  role,
  name,
  tone,
  icon,
}: {
  role: string
  name: string
  tone: 'emerald' | 'navy'
  icon: React.ReactNode
}) {
  const bg = tone === 'emerald' ? 'bg-emerald' : 'bg-navy'
  return (
    <div className="rounded-lg border border-border bg-surface p-2.5">
      <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {icon}
        {role}
      </div>
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${bg}`}>
          {name.split(' ').map((n) => n[0]).slice(0, 2).join('')}
        </div>
        <div className="truncate text-xs font-medium text-ink">{name}</div>
      </div>
    </div>
  )
}