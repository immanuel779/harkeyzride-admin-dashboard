import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Banknote,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ClipboardCopy,
  Copy,
  CreditCard,
  Download,
  Eye,
  FileJson,
  Flag,
  Hash,
  History,
  Keyboard,
  Loader2,
  Phone,
  RefreshCw,
  Search,
  Send,
  Timer,
  TrendingUp,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { EmptyState } from '../../../components/shared/EmptyState'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import {
  DataTable,
  type BulkAction,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { toast } from '../../../lib/toast'
import {
  useProcessWithdrawal,
  useUpdateWithdrawal,
  useWithdrawals,
} from '../../../hooks/queries/useWithdrawals'
import type {
  Withdrawal,
  WithdrawalStatus,
} from '../data/mockWithdrawals'

/* ==========================================================================
   CONFIG (original STATUS_MAP preserved)
   ========================================================================== */

const STATUS_MAP: Record<
  WithdrawalStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  pending: { label: 'Pending', tone: 'warning' },
  approved: { label: 'Approved', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

const HIGH_AMOUNT_THRESHOLD = 100_000
const STALE_PENDING_HOURS = 24
const AUTO_REFRESH_MS = 30_000
const DUPLICATE_WINDOW_HOURS = 24

type PendingAction =
  | { type: 'approve' | 'reject'; withdrawal: Withdrawal }
  | { type: 'process'; withdrawal: Withdrawal }
  | null

type TabKey = 'all' | 'pending' | 'approved' | 'paid' | 'rejected' | 'flagged'

type SortKey = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc' | 'priority'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Wallet }> = [
  { key: 'all', label: 'All requests', icon: Wallet },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'paid', label: 'Paid', icon: Banknote },
  { key: 'rejected', label: 'Rejected', icon: Ban },
  { key: 'flagged', label: 'Flagged', icon: AlertTriangle },
]

type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

type Anomaly = {
  type: string
  label: string
  severity: AnomalySeverity
}

const ANOMALY_STYLES: Record<AnomalySeverity, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-danger' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700' },
  medium: { bg: 'bg-sky-100', text: 'text-sky-700' },
  low: { bg: 'bg-slate-100', text: 'text-slate-700' },
}

const ANOMALY_ORDER: Record<AnomalySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const ANIMATIONS = `
  @keyframes wd-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wd-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes wd-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes wd-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes wd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes wd-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .wd-fade-up { animation: wd-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .wd-fade-in { animation: wd-fade-in .2s ease both; }
  .wd-slide-in { animation: wd-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .wd-pop { animation: wd-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .wd-pulse { animation: wd-pulse 1.5s ease-in-out infinite; }
  .wd-shimmer { position: relative; overflow: hidden; }
  .wd-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .wd-shimmer:hover::after { animation: wd-shimmer 1s ease; }
  .wd-stagger > * { animation: wd-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .wd-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .wd-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .wd-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .wd-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .wd-stagger > *:nth-child(5) { animation-delay: 240ms; }
  .wd-stagger > *:nth-child(6) { animation-delay: 300ms; }
  @media (prefers-reduced-motion: reduce) {
    .wd-fade-up, .wd-fade-in, .wd-slide-in, .wd-pop, .wd-pulse,
    .wd-stagger > *, .wd-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function formatNaira(n: number): string {
  return `₦${n.toLocaleString()}`
}

function formatCompactNaira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`
  return `₦${n}`
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function hoursSince(iso: string): number {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, (Date.now() - t) / (60 * 60 * 1000))
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
  return `withdrawals-${stamp}.${ext}`
}

function computeAnomalies(
  w: Withdrawal,
  all: Withdrawal[],
): Anomaly[] {
  const out: Anomaly[] = []

  if (w.status !== 'pending' && w.status !== 'approved') return out

  if (w.amount >= HIGH_AMOUNT_THRESHOLD) {
    out.push({
      type: 'high_amount',
      label: `High amount (${formatNaira(w.amount)})`,
      severity: 'high',
    })
  }

  if (w.status === 'pending') {
    const hrs = hoursSince(w.requestedAt)
    if (hrs >= STALE_PENDING_HOURS) {
      out.push({
        type: 'stale_pending',
        label: `Pending ${Math.floor(hrs)}h — SLA breached`,
        severity: hrs >= 48 ? 'critical' : 'high',
      })
    }
  }

  // Same driver requesting multiple payouts within DUPLICATE_WINDOW_HOURS
  const related = all.filter(
    (other) =>
      other.id !== w.id &&
      other.driverName === w.driverName &&
      (other.status === 'pending' || other.status === 'approved') &&
      Math.abs(
        Date.parse(other.requestedAt) - Date.parse(w.requestedAt),
      ) <
        DUPLICATE_WINDOW_HOURS * 60 * 60 * 1000,
  )
  if (related.length > 0) {
    out.push({
      type: 'duplicate_request',
      label: `${related.length} other open request${related.length === 1 ? '' : 's'} from same driver`,
      severity: 'medium',
    })
  }

  return out
}

function priorityScore(w: Withdrawal, anomalies: Anomaly[]): number {
  let score = 0
  if (w.status === 'pending') score += 100
  if (w.status === 'approved') score += 50
  anomalies.forEach((a) => {
    if (a.severity === 'critical') score += 40
    else if (a.severity === 'high') score += 20
    else if (a.severity === 'medium') score += 10
  })
  return score
}

function sortWithdrawals(
  list: Withdrawal[],
  key: SortKey,
  anomaliesBy: Map<string, Anomaly[]>,
): Withdrawal[] {
  const sorted = [...list]
  switch (key) {
    case 'oldest':
      return sorted.sort(
        (a, b) =>
          Date.parse(a.requestedAt) - Date.parse(b.requestedAt),
      )
    case 'amount_desc':
      return sorted.sort((a, b) => b.amount - a.amount)
    case 'amount_asc':
      return sorted.sort((a, b) => a.amount - b.amount)
    case 'priority':
      return sorted.sort((a, b) => {
        const sa = priorityScore(a, anomaliesBy.get(a.id) ?? [])
        const sb = priorityScore(b, anomaliesBy.get(b.id) ?? [])
        if (sa !== sb) return sb - sa
        return Date.parse(a.requestedAt) - Date.parse(b.requestedAt)
      })
    case 'newest':
    default:
      return sorted.sort(
        (a, b) =>
          Date.parse(b.requestedAt) - Date.parse(a.requestedAt),
      )
  }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function WithdrawalsPage() {
  const { data: withdrawals = [], isLoading, isError, error, refetch } =
    useWithdrawals()
  const update = useUpdateWithdrawal()
  const process = useProcessWithdrawal()

  const [pending, setPending] = useState<PendingAction>(null)
  const [tab, setTab] = useState<TabKey>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(Date.now())
  const [copied, setCopied] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const copiedTimerRef = useRef<number | null>(null)

  const isWorking = update.isPending || process.isPending

  /* ---------------------------- derived ---------------------------- */

  const anomaliesByWithdrawal = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const w of withdrawals) map.set(w.id, computeAnomalies(w, withdrawals))
    return map
  }, [withdrawals])

  const flaggedIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, list] of anomaliesByWithdrawal) if (list.length > 0) s.add(id)
    return s
  }, [anomaliesByWithdrawal])

  const sorted = useMemo(
    () => sortWithdrawals(withdrawals, sortKey, anomaliesByWithdrawal),
    [withdrawals, sortKey, anomaliesByWithdrawal],
  )

  const tabFiltered = useMemo(() => {
    let list = sorted
    switch (tab) {
      case 'pending':
        list = list.filter((w) => w.status === 'pending')
        break
      case 'approved':
        list = list.filter((w) => w.status === 'approved')
        break
      case 'paid':
        list = list.filter((w) => w.status === 'paid')
        break
      case 'rejected':
        list = list.filter((w) => w.status === 'rejected')
        break
      case 'flagged':
        list = list.filter((w) => flaggedIds.has(w.id))
        break
      default:
        break
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        (w) =>
          w.driverName.toLowerCase().includes(q) ||
          w.reference.toLowerCase().includes(q) ||
          w.bank.toLowerCase().includes(q),
      )
    }
    return list
  }, [sorted, tab, flaggedIds, search])

  const counts = useMemo<Record<TabKey, number>>(() => {
    const pendingList = withdrawals.filter((w) => w.status === 'pending')
    const approvedList = withdrawals.filter((w) => w.status === 'approved')
    return {
      all: withdrawals.length,
      pending: pendingList.length,
      approved: approvedList.length,
      paid: withdrawals.filter((w) => w.status === 'paid').length,
      rejected: withdrawals.filter((w) => w.status === 'rejected').length,
      flagged: flaggedIds.size,
    }
  }, [withdrawals, flaggedIds])

  const stats = useMemo(() => {
    const pendingList = withdrawals.filter((w) => w.status === 'pending')
    const approvedList = withdrawals.filter((w) => w.status === 'approved')
    const paidList = withdrawals.filter((w) => w.status === 'paid')
    const pendingAmount = pendingList.reduce((s, w) => s + w.amount, 0)
    const approvedAmount = approvedList.reduce((s, w) => s + w.amount, 0)
    const paidAmount = paidList.reduce((s, w) => s + w.amount, 0)

    const staleCount = pendingList.filter(
      (w) => hoursSince(w.requestedAt) >= STALE_PENDING_HOURS,
    ).length

    return {
      total: withdrawals.length,
      pending: pendingList.length,
      approved: approvedList.length,
      paid: paidList.length,
      rejected: counts.rejected,
      pendingAmount,
      approvedAmount,
      paidAmount,
      staleCount,
      flagged: flaggedIds.size,
    }
  }, [withdrawals, flaggedIds, counts.rejected])

  const detail = useMemo(
    () => (detailId ? withdrawals.find((w) => w.id === detailId) ?? null : null),
    [withdrawals, detailId],
  )

  const detailAnomalies = useMemo(
    () => (detail ? anomaliesByWithdrawal.get(detail.id) ?? [] : []),
    [detail, anomaliesByWithdrawal],
  )

  /* ---------------------------- effects ---------------------------- */

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Auto refresh
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        await refetch()
        setLastUpdated(Date.now())
      } catch {
        /* silent */
      }
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [refetch])

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
        if (pending && !isWorking) {
          setPending(null)
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
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, pending, isWorking, tabFiltered, tab])

  /* ---------------------------- handlers --------------------------- */

  const handleConfirm = async () => {
    if (!pending) return
    try {
      if (pending.type === 'approve') {
        await update.mutateAsync({
          id: pending.withdrawal.id,
          status: 'approved',
        })
        toast.success('Withdrawal approved', 'Ready to process payout.')
      } else if (pending.type === 'reject') {
        await update.mutateAsync({
          id: pending.withdrawal.id,
          status: 'rejected',
          note: 'Rejected by admin',
        })
        toast.warning('Withdrawal rejected', 'Driver has been notified.')
      } else {
        await process.mutateAsync(pending.withdrawal.id)
        toast.success('Payout queued', 'Provider will process shortly.')
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
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleCopy = useCallback(
    async (value: string, key: string) => {
      try {
        await navigator.clipboard.writeText(value)
        setCopied(key)
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
      } catch {
        toast.error('Copy failed', 'Clipboard unavailable.')
      }
    },
    [],
  )

  const handleExportCSV = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No withdrawals match the current view.')
      return
    }
    const headers = [
      'reference', 'driver', 'phone', 'bank', 'accountNumber',
      'amount', 'status', 'requestedAt', 'processedAt',
    ]
    const lines = [headers.join(',')]
    for (const w of rows) {
      const record = w as Withdrawal & {
        accountNumber?: string
        processedAt?: string | null
      }
      lines.push(
        [
          w.reference,
          w.driverName,
          w.driverPhone,
          w.bank,
          record.accountNumber ?? '',
          String(w.amount),
          w.status,
          w.requestedAt,
          record.processedAt ?? '',
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success('CSV exported', `${rows.length} requests downloaded.`)
  }, [tabFiltered])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No withdrawals match the current view.')
      return
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      stats,
      withdrawals: rows.map((w) => ({
        ...w,
        anomalies: anomaliesByWithdrawal.get(w.id) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success('JSON exported', `${rows.length} requests downloaded.`)
  }, [tabFiltered, tab, stats, anomaliesByWithdrawal])

  /* ---------------------------- columns ---------------------------- */

  const columns: DataTableColumn<Withdrawal>[] = [
    {
      key: 'reference',
      header: 'Reference',
      accessor: (r) => r.reference,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-ink font-medium">
            {r.reference}
          </span>
          {flaggedIds.has(r.id) ? (
            <span
              title="Flagged"
              className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
            />
          ) : null}
        </div>
      ),
    },
    {
      key: 'driverName',
      header: 'Driver',
      accessor: (r) => r.driverName,
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="text-ink font-medium truncate">{r.driverName}</div>
          <div className="text-[11px] text-ink-secondary">{r.driverPhone}</div>
        </div>
      ),
    },
    {
      key: 'bank',
      header: 'Bank',
      accessor: (r) => r.bank,
      render: (r) => (
        <span className="text-xs text-ink-secondary">{r.bank}</span>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (r) => r.amount,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{formatNaira(r.amount)}</span>
          {r.amount >= HIGH_AMOUNT_THRESHOLD ? (
            <span
              title="High amount"
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
      key: 'requestedAt',
      header: 'Requested',
      accessor: (r) => r.requestedAt,
      sortable: true,
      render: (r) => {
        const hrs = hoursSince(r.requestedAt)
        const stale =
          (r.status === 'pending' || r.status === 'approved') &&
          hrs >= STALE_PENDING_HOURS
        return (
          <div className="text-xs">
            <div className="text-ink-secondary">
              {new Date(r.requestedAt).toLocaleDateString()}
            </div>
            {stale ? (
              <div className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
                <AlertTriangle size={9} aria-hidden="true" />
                {Math.floor(hrs)}h waiting
              </div>
            ) : (
              <div className="text-[10px] text-ink-muted">
                {formatRelativeTime(r.requestedAt)}
              </div>
            )}
          </div>
        )
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (r) => {
        const list = anomaliesByWithdrawal.get(r.id) ?? []
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

  /* ---------------------------- filters ---------------------------- */

  const filters: DataTableFilter<Withdrawal>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'paid', label: 'Paid' },
        { value: 'rejected', label: 'Rejected' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'amount',
      label: 'Amount',
      options: [
        { value: 'high', label: `High (≥ ${formatCompactNaira(HIGH_AMOUNT_THRESHOLD)})` },
        { value: 'regular', label: 'Regular' },
      ],
      apply: (row, value) => {
        if (value === 'high') return row.amount >= HIGH_AMOUNT_THRESHOLD
        if (value === 'regular') return row.amount < HIGH_AMOUNT_THRESHOLD
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

  const bulkActions: BulkAction<Withdrawal>[] = [
    {
      key: 'export',
      label: 'Export selected',
      onRun: (rows) => {
        if (rows.length === 0) return
        const headers = ['reference', 'driver', 'bank', 'amount', 'status', 'requestedAt']
        const lines = [headers.join(',')]
        for (const w of rows) {
          lines.push(
            [w.reference, w.driverName, w.bank, String(w.amount), w.status, w.requestedAt]
              .map((v) => escapeCSV(String(v ?? '')))
              .join(','),
          )
        }
        downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
        toast.success(`${rows.length} requests exported`)
      },
    },
    {
      key: 'approve',
      label: 'Approve selected',
      tone: 'primary',
      onRun: async (rows) => {
        const eligible = rows.filter((w) => w.status === 'pending')
        if (eligible.length === 0) {
          toast.error('Nothing to approve', 'No pending requests in selection.')
          return
        }
        let ok = 0
        let failed = 0
        for (const w of eligible) {
          try {
            await update.mutateAsync({ id: w.id, status: 'approved' })
            ok++
          } catch {
            failed++
          }
        }
        if (failed === 0) {
          toast.success(`${ok} approved`, 'Ready to process.')
        } else {
          toast.warning(`${ok} approved · ${failed} failed`, 'Retry failures.')
        }
      },
    },
    {
      key: 'reject',
      label: 'Reject selected',
      tone: 'danger',
      onRun: async (rows) => {
        const eligible = rows.filter((w) => w.status === 'pending')
        if (eligible.length === 0) {
          toast.error('Nothing to reject', 'No pending requests in selection.')
          return
        }
        let ok = 0
        let failed = 0
        for (const w of eligible) {
          try {
            await update.mutateAsync({
              id: w.id,
              status: 'rejected',
              note: 'Bulk rejected by admin',
            })
            ok++
          } catch {
            failed++
          }
        }
        if (failed === 0) {
          toast.warning(`${ok} rejected`, 'Drivers notified.')
        } else {
          toast.warning(`${ok} rejected · ${failed} failed`, 'Retry failures.')
        }
      },
    },
  ]

  /* ---------------------------- error state ------------------------ */

  if (isError) {
    return (
      <AppShell title="Withdrawals">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load withdrawals"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Driver Withdrawals">
      <style>{ANIMATIONS}</style>

      {/* Stale pending banner */}
      {stats.staleCount > 0 ? (
        <div className="wd-fade-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertTriangle size={15} aria-hidden="true" />
            <span className="font-semibold">
              {stats.staleCount} request{stats.staleCount === 1 ? '' : 's'} pending for {STALE_PENDING_HOURS}h+
            </span>
            <span className="text-xs text-amber-700/80">
              — driver payout SLA breached
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTab('pending')}
            className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors"
          >
            Review now
            <ArrowRight size={11} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 wd-stagger">
        <KpiCard
          icon={<Wallet size={14} aria-hidden="true" />}
          tone="slate"
          label="Total"
          value={String(stats.total)}
          hint="All requests"
        />
        <KpiCard
          icon={<Clock size={14} aria-hidden="true" />}
          tone={stats.pending > 0 ? 'amber' : 'slate'}
          label="Pending"
          value={String(stats.pending)}
          hint={formatCompactNaira(stats.pendingAmount)}
        />
        <KpiCard
          icon={<CheckCircle2 size={14} aria-hidden="true" />}
          tone="sky"
          label="Approved"
          value={String(stats.approved)}
          hint={formatCompactNaira(stats.approvedAmount)}
        />
        <KpiCard
          icon={<Banknote size={14} aria-hidden="true" />}
          tone="emerald"
          label="Paid"
          value={String(stats.paid)}
          hint={formatCompactNaira(stats.paidAmount)}
        />
        <KpiCard
          icon={<Ban size={14} aria-hidden="true" />}
          tone="red"
          label="Rejected"
          value={String(stats.rejected)}
          hint="Declined"
        />
        <KpiCard
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone={stats.flagged > 0 ? 'amber' : 'slate'}
          label="Flagged"
          value={String(stats.flagged)}
          hint={stats.staleCount > 0 ? `${stats.staleCount} stale` : 'No issues'}
        />
      </div>

      {/* Tabs + search + actions */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 wd-fade-up">
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
                      'wd-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'flagged'
                          ? 'bg-amber-100 text-amber-700'
                          : key === 'pending'
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
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald wd-pulse" aria-hidden="true" />
            Live · {formatRelativeTime(new Date(lastUpdated).toISOString())}
          </span>

          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver, ref, bank…"
              className="w-44 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
            />
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort withdrawals"
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none"
          >
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="amount_desc">Highest amount</option>
            <option value="amount_asc">Lowest amount</option>
          </select>

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
            className="wd-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
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
        searchable={false}
        pageSize={10}
        loading={isLoading}
        title="Payout Queue"
        selectable
        bulkActions={bulkActions}
        isRowSelectable={(r) => r.status === 'pending'}
        viewKey="withdrawals"
        exportFileName="withdrawals"
        emptyMessage="No withdrawal requests yet"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View details"
              title="View details"
            >
              <Eye size={15} aria-hidden="true" />
            </button>

            {r.status === 'pending' ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPending({ type: 'approve', withdrawal: r })
                  }}
                  className="p-1.5 rounded-lg hover:bg-emerald-light text-emerald transition-colors"
                  aria-label="Approve"
                  title="Approve"
                >
                  <Check size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPending({ type: 'reject', withdrawal: r })
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-danger transition-colors"
                  aria-label="Reject"
                  title="Reject"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </>
            ) : r.status === 'approved' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPending({ type: 'process', withdrawal: r })
                }}
                className="inline-flex items-center gap-1 rounded-md border border-emerald bg-emerald-light px-2.5 py-1 text-[11px] font-semibold text-emerald hover:bg-emerald/20 transition-colors"
                title="Queue payout"
              >
                <Send size={11} aria-hidden="true" />
                Process
              </button>
            ) : (
              <Wallet size={14} className="text-ink-muted" aria-hidden="true" />
            )}
          </div>
        )}
      />

      {/* Original confirm modal (preserved) */}
      <ConfirmModal
        open={pending !== null}
        title={
          pending?.type === 'approve'
            ? `Approve ${formatNaira(pending.withdrawal.amount)}?`
            : pending?.type === 'reject'
              ? `Reject ${formatNaira(pending.withdrawal.amount)}?`
              : pending?.type === 'process'
                ? 'Queue payout to provider?'
                : ''
        }
        description={
          pending?.type === 'approve'
            ? 'Driver will be notified. You can queue the payout after approval.'
            : pending?.type === 'reject'
              ? 'Driver will be notified. This cannot be undone from the UI.'
              : 'Provider (Paystack) will process this payout to the driver bank account.'
        }
        confirmLabel={
          pending?.type === 'approve'
            ? 'Approve'
            : pending?.type === 'reject'
              ? 'Reject'
              : 'Queue payout'
        }
        variant={pending?.type === 'reject' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />

      {/* Detail drawer */}
      {detail ? (
        <WithdrawalDetailDrawer
          withdrawal={detail}
          anomalies={detailAnomalies}
          copied={copied}
          onCopy={handleCopy}
          onClose={() => setDetailId(null)}
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

function WithdrawalDetailDrawer({
  withdrawal,
  anomalies,
  copied,
  onCopy,
  onClose,
}: {
  withdrawal: Withdrawal
  anomalies: Anomaly[]
  copied: string | null
  onCopy: (value: string, key: string) => Promise<void>
  onClose: () => void
}) {
  const record = withdrawal as Withdrawal & {
    accountNumber?: string
    accountName?: string
    processedAt?: string | null
    note?: string | null
  }

  const statusCfg = STATUS_MAP[withdrawal.status]
  const hours = hoursSince(withdrawal.requestedAt)

  return (
    <div
      className="wd-fade-in fixed inset-0 z-[10000] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Withdrawal details"
      onClick={onClose}
    >
      <div
        className="wd-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink truncate">
                {withdrawal.reference}
              </span>
              <StatusBadge status={statusCfg.tone}>{statusCfg.label}</StatusBadge>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Requested {formatRelativeTime(withdrawal.requestedAt)}
              {hours >= STALE_PENDING_HOURS && withdrawal.status !== 'paid' && withdrawal.status !== 'rejected'
                ? ` · ${Math.floor(hours)}h open`
                : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Amount display */}
          <div className="rounded-xl border border-border bg-surface-alt/40 p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
              Payout Amount
            </div>
            <div className="text-3xl font-bold text-ink tabular-nums">
              {formatNaira(withdrawal.amount)}
            </div>
          </div>

          {/* Driver */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <User size={11} aria-hidden="true" />
              Driver
            </div>
            <div className="rounded-lg border border-border bg-surface p-3">
              <div className="text-sm font-semibold text-ink">
                {withdrawal.driverName}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-secondary">
                <Phone size={10} aria-hidden="true" />
                <span className="font-mono">{withdrawal.driverPhone}</span>
                <button
                  type="button"
                  onClick={() => onCopy(withdrawal.driverPhone, `phone-${withdrawal.id}`)}
                  className="ml-auto rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
                  aria-label="Copy phone"
                >
                  {copied === `phone-${withdrawal.id}` ? (
                    <Check size={11} className="text-emerald" aria-hidden="true" />
                  ) : (
                    <Copy size={11} aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bank */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <Building2 size={11} aria-hidden="true" />
              Destination Account
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <div>
                <div className="text-[10px] text-ink-muted">Bank</div>
                <div className="text-xs font-medium text-ink">{withdrawal.bank}</div>
              </div>
              {record.accountNumber ? (
                <div>
                  <div className="text-[10px] text-ink-muted">Account number</div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-mono text-ink">
                      {record.accountNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onCopy(record.accountNumber ?? '', `acct-${withdrawal.id}`)
                      }
                      className="rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
                      aria-label="Copy account number"
                    >
                      {copied === `acct-${withdrawal.id}` ? (
                        <Check size={11} className="text-emerald" aria-hidden="true" />
                      ) : (
                        <Copy size={11} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
              {record.accountName ? (
                <div>
                  <div className="text-[10px] text-ink-muted">Account name</div>
                  <div className="text-xs font-medium text-ink">
                    {record.accountName}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <History size={11} aria-hidden="true" />
              Timeline
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <TimelineRow
                label="Requested"
                at={withdrawal.requestedAt}
                tone="info"
              />
              {withdrawal.status === 'approved' || withdrawal.status === 'paid' ? (
                <TimelineRow
                  label="Approved"
                  at={new Date().toISOString()}
                  tone="success"
                />
              ) : null}
              {record.processedAt ? (
                <TimelineRow
                  label="Processed"
                  at={record.processedAt}
                  tone="success"
                />
              ) : null}
              {withdrawal.status === 'rejected' ? (
                <TimelineRow
                  label="Rejected"
                  at={new Date().toISOString()}
                  tone="danger"
                />
              ) : null}
            </div>
          </div>

          {/* Notes */}
          {record.note ? (
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Note
              </div>
              <div className="rounded-lg border border-border bg-surface p-3 text-xs text-ink-secondary">
                {record.note}
              </div>
            </div>
          ) : null}

          {/* Anomalies */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <AlertTriangle size={11} aria-hidden="true" />
              Flags
              {anomalies.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                  {anomalies.length}
                </span>
              ) : null}
            </div>
            {anomalies.length === 0 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                No anomalies detected for this request.
              </div>
            ) : (
              <div className="space-y-1">
                {anomalies.map((a) => {
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

          {/* Raw payload */}
          <div className="rounded-lg border border-border bg-surface-alt/50 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Raw payload
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {JSON.stringify(withdrawal, null, 2)}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <button
            type="button"
            onClick={() =>
              onCopy(JSON.stringify(withdrawal, null, 2), `full-${withdrawal.id}`)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            {copied === `full-${withdrawal.id}` ? (
              <>
                <Check size={12} className="text-emerald" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <ClipboardCopy size={12} aria-hidden="true" />
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

function TimelineRow({
  label,
  at,
  tone,
}: {
  label: string
  at: string
  tone: 'info' | 'success' | 'danger'
}) {
  const dot =
    tone === 'success'
      ? 'bg-emerald'
      : tone === 'danger'
        ? 'bg-red-500'
        : 'bg-sky-500'
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-ink font-medium">{label}</span>
      <span className="ml-auto text-ink-muted tabular-nums">
        {new Date(at).toLocaleString()}
      </span>
    </div>
  )
}