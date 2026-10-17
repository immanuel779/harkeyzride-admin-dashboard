import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  Banknote,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock,
  CreditCard,
  Download,
  Eye,
  FileJson,
  Flag,
  Gauge,
  RefreshCw,
  Search,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  DataTable,
  type BulkAction,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { toast } from '../../../lib/toast'
import { useTransactions } from '../../../hooks/queries/useTransactions'
import type {
  Transaction,
  TxnStatus,
  TxnType,
} from '../data/mockTransactions'

/* ==========================================================================
   CONFIG (original TYPE_LABEL / STATUS_MAP preserved)
   ========================================================================== */

const TYPE_LABEL: Record<TxnType, string> = {
  ride_payment: 'Ride Payment',
  wallet_funding: 'Wallet Funding',
  driver_payout: 'Driver Payout',
  commission: 'Commission',
  refund: 'Refund',
  cancellation_fee: 'Cancellation Fee',
}

const STATUS_MAP: Record<
  TxnStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  successful: { label: 'Successful', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
}

const TYPE_META: Record<
  TxnType,
  {
    label: string
    direction: 'in' | 'out'
    color: string
    hint: string
  }
> = {
  ride_payment: {
    label: 'Ride Payment',
    direction: 'in',
    color: '#10b981',
    hint: 'Money paid for rides',
  },
  wallet_funding: {
    label: 'Wallet Funding',
    direction: 'in',
    color: '#0ea5e9',
    hint: 'Rider wallet top-ups',
  },
  driver_payout: {
    label: 'Driver Payout',
    direction: 'out',
    color: '#f59e0b',
    hint: 'Money paid to drivers',
  },
  commission: {
    label: 'Commission',
    direction: 'in',
    color: '#8b5cf6',
    hint: 'Platform commission',
  },
  refund: {
    label: 'Refund',
    direction: 'out',
    color: '#ef4444',
    hint: 'Money refunded to riders',
  },
  cancellation_fee: {
    label: 'Cancellation Fee',
    direction: 'in',
    color: '#f97316',
    hint: 'Penalties collected',
  },
}

const HIGH_VALUE_THRESHOLD = 50_000
const PENDING_STALE_HOURS = 24

type TabKey =
  | 'all'
  | 'inflow'
  | 'outflow'
  | 'pending'
  | 'failed'
  | 'high_value'
  | 'flagged'

type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

type Anomaly = {
  type: string
  label: string
  severity: AnomalySeverity
}

const TABS: Array<{
  key: TabKey
  label: string
  icon: typeof Banknote
}> = [
  { key: 'all', label: 'All transactions', icon: Banknote },
  { key: 'inflow', label: 'Inflow', icon: ArrowDownRight },
  { key: 'outflow', label: 'Outflow', icon: ArrowUpRight },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'failed', label: 'Failed', icon: Ban },
  { key: 'high_value', label: 'High value', icon: Zap },
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
  @keyframes fp-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fp-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes fp-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes fp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes fp-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  @keyframes fp-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .fp-fade-up { animation: fp-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .fp-fade-in { animation: fp-fade-in .2s ease both; }
  .fp-slide-in { animation: fp-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .fp-pop { animation: fp-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .fp-pulse { animation: fp-pulse 1.5s ease-in-out infinite; }
  .fp-bar { transform-origin: left center; animation: fp-bar-grow .6s cubic-bezier(.22,1,.36,1) both; }
  .fp-shimmer { position: relative; overflow: hidden; }
  .fp-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .fp-shimmer:hover::after { animation: fp-shimmer 1s ease; }
  .fp-stagger > * { animation: fp-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .fp-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .fp-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .fp-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .fp-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .fp-stagger > *:nth-child(5) { animation-delay: 240ms; }
  .fp-stagger > *:nth-child(6) { animation-delay: 300ms; }
  @media (prefers-reduced-motion: reduce) {
    .fp-fade-up, .fp-fade-in, .fp-slide-in, .fp-pop, .fp-pulse, .fp-bar,
    .fp-stagger > *, .fp-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function formatCompactNaira(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(1)}K`
  return `₦${n}`
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return '—'
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return `${Math.floor(d / 30)}mo ago`
}

function daysBetween(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
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
  return `transactions-${stamp}.${ext}`
}

function isInflow(t: Transaction): boolean {
  return TYPE_META[t.type]?.direction === 'in'
}

function isOutflow(t: Transaction): boolean {
  return TYPE_META[t.type]?.direction === 'out'
}

function isHighValue(t: Transaction): boolean {
  return t.amount >= HIGH_VALUE_THRESHOLD
}

function computeAnomalies(
  t: Transaction,
  allTxns: Transaction[],
): Anomaly[] {
  const out: Anomaly[] = []

  if (isHighValue(t) && t.status !== 'successful') {
    out.push({
      type: 'high_value_stuck',
      label: `High value stuck in ${t.status} (${formatNaira(t.amount)})`,
      severity: 'critical',
    })
  } else if (isHighValue(t)) {
    out.push({
      type: 'high_value',
      label: `High value transaction (${formatNaira(t.amount)})`,
      severity: 'medium',
    })
  }

  if (t.status === 'failed' && isOutflow(t)) {
    out.push({
      type: 'failed_outflow',
      label: 'Failed outflow — possible stuck payment',
      severity: 'high',
    })
  }

  if (t.status === 'pending') {
    const hours = t.createdAt
      ? (Date.now() - Date.parse(t.createdAt)) / (60 * 60 * 1000)
      : 0
    if (hours > PENDING_STALE_HOURS) {
      out.push({
        type: 'stale_pending',
        label: `Pending for ${Math.floor(hours)}h`,
        severity: 'high',
      })
    }
  }

  if (t.type === 'refund' && t.status === 'successful') {
    out.push({
      type: 'refund',
      label: 'Refund processed',
      severity: 'low',
    })
  }

  // Same user with more than one transaction in a short window
  if (t.createdAt) {
    const recent = allTxns.filter(
      (other) =>
        other.id !== t.id &&
        other.user === t.user &&
        other.createdAt &&
        Math.abs(
          Date.parse(other.createdAt) - Date.parse(t.createdAt),
        ) <
          5 * 60 * 1000,
    )
    if (recent.length > 0) {
      out.push({
        type: 'duplicate_user',
        label: `${recent.length + 1} txns for ${t.user} within 5 min`,
        severity: 'medium',
      })
    }
  }

  return out
}

function buildTxnSummary(t: Transaction): string {
  const meta = TYPE_META[t.type]
  const sign = meta?.direction === 'out' ? '-' : '+'
  return [
    `Ref: ${t.reference}`,
    `Type: ${TYPE_LABEL[t.type] ?? t.type}`,
    `User: ${t.user}`,
    `Amount: ${sign}${formatNaira(t.amount)}`,
    `Status: ${STATUS_MAP[t.status].label}`,
    `Date: ${t.createdAt ? new Date(t.createdAt).toLocaleString() : '—'}`,
  ].join('\n')
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function FinancialsPage() {
  const {
    data: transactions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useTransactions()

  const [tab, setTab] = useState<TabKey>('all')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())

  const copiedTimerRef = useRef<number | null>(null)

  /* ---------------------------- derived ---------------------------- */

  const anomaliesByTxn = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const t of transactions) map.set(t.id, computeAnomalies(t, transactions))
    return map
  }, [transactions])

  const flaggedIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, list] of anomaliesByTxn) if (list.length > 0) s.add(id)
    return s
  }, [anomaliesByTxn])

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'inflow':
        return transactions.filter((t) => isInflow(t))
      case 'outflow':
        return transactions.filter((t) => isOutflow(t))
      case 'pending':
        return transactions.filter((t) => t.status === 'pending')
      case 'failed':
        return transactions.filter((t) => t.status === 'failed')
      case 'high_value':
        return transactions.filter((t) => isHighValue(t))
      case 'flagged':
        return transactions.filter((t) => flaggedIds.has(t.id))
      default:
        return transactions
    }
  }, [transactions, tab, flaggedIds])

  const counts = useMemo<Record<TabKey, number>>(() => {
    return {
      all: transactions.length,
      inflow: transactions.filter((t) => isInflow(t)).length,
      outflow: transactions.filter((t) => isOutflow(t)).length,
      pending: transactions.filter((t) => t.status === 'pending').length,
      failed: transactions.filter((t) => t.status === 'failed').length,
      high_value: transactions.filter((t) => isHighValue(t)).length,
      flagged: flaggedIds.size,
    }
  }, [transactions, flaggedIds])

  const stats = useMemo(() => {
    let inflow = 0
    let outflow = 0
    let pending = 0
    let failed = 0
    let pendingAmount = 0
    let failedAmount = 0

    for (const t of transactions) {
      const isSuccess = t.status === 'successful'
      if (t.status === 'pending') {
        pending += 1
        pendingAmount += t.amount
      } else if (t.status === 'failed') {
        failed += 1
        failedAmount += t.amount
      }
      if (isSuccess) {
        if (isInflow(t)) inflow += t.amount
        else if (isOutflow(t)) outflow += t.amount
      }
    }

    const netFlow = inflow - outflow
    const successRate =
      transactions.length > 0
        ? Math.round(
            ((transactions.length - pending - failed) / transactions.length) * 100,
          )
        : 0

    return {
      total: transactions.length,
      inflow,
      outflow,
      netFlow,
      pending,
      pendingAmount,
      failed,
      failedAmount,
      successRate,
      flagged: flaggedIds.size,
    }
  }, [transactions, flaggedIds])

  // Per-type totals for the breakdown card
  const byType = useMemo(() => {
    const totals = new Map<TxnType, { count: number; amount: number }>()
    for (const t of transactions) {
      let row = totals.get(t.type)
      if (!row) {
        row = { count: 0, amount: 0 }
        totals.set(t.type, row)
      }
      row.count += 1
      row.amount += t.amount
    }
    const maxAmount = Math.max(
      1,
      ...[...totals.values()].map((v) => v.amount),
    )
    return Object.entries(TYPE_META)
      .map(([type, meta]) => {
        const totalsRow = totals.get(type as TxnType) ?? { count: 0, amount: 0 }
        return {
          type: type as TxnType,
          meta,
          count: totalsRow.count,
          amount: totalsRow.amount,
          share: totalsRow.amount / maxAmount,
        }
      })
      .filter((r) => r.count > 0)
      .sort((a, b) => b.amount - a.amount)
  }, [transactions])

  // 7-day inflow vs outflow sparkline
  const trend = useMemo(() => {
    const days = 7
    const buckets: Array<{ label: string; date: string; inflow: number; outflow: number }> = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const start = d.getTime()
      const end = start + 24 * 60 * 60 * 1000
      let inAmt = 0
      let outAmt = 0
      for (const t of transactions) {
        if (t.status !== 'successful' || !t.createdAt) continue
        const ts = Date.parse(t.createdAt)
        if (ts < start || ts >= end) continue
        if (isInflow(t)) inAmt += t.amount
        else outAmt += t.amount
      }
      buckets.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        date: d.toISOString().slice(0, 10),
        inflow: inAmt,
        outflow: outAmt,
      })
    }
    return buckets
  }, [transactions])

  const maxTrend = Math.max(
    1,
    ...trend.map((d) => Math.max(d.inflow, d.outflow)),
  )

  const detail = useMemo(
    () => (detailId ? transactions.find((t) => t.id === detailId) ?? null : null),
    [transactions, detailId],
  )

  const detailAnomalies = useMemo(
    () => (detail ? anomaliesByTxn.get(detail.id) ?? [] : []),
    [detail, anomaliesByTxn],
  )

  /* --------------------------- effects --------------------------- */

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Esc closes drawer
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
      toast.error('Nothing to export', 'No transactions match the current view.')
      return
    }
    const headers = [
      'id', 'reference', 'type', 'direction', 'user', 'amount', 'status', 'createdAt',
    ]
    const lines = [headers.join(',')]
    for (const t of rows) {
      lines.push(
        [
          t.id, t.reference, TYPE_LABEL[t.type] ?? t.type,
          TYPE_META[t.type]?.direction ?? '—',
          t.user, String(t.amount), t.status,
          t.createdAt ?? '',
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success(
      'CSV exported',
      `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'} downloaded.`,
    )
  }, [tabFiltered])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No transactions match the current view.')
      return
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      stats,
      transactions: rows.map((t) => ({
        ...t,
        anomalies: anomaliesByTxn.get(t.id) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success(
      'JSON exported',
      `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'} downloaded.`,
    )
  }, [tabFiltered, tab, stats, anomaliesByTxn])

  const handleCopy = useCallback(async (t: Transaction) => {
    try {
      await navigator.clipboard.writeText(buildTxnSummary(t))
      setCopied(t.id)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [])

  /* --------------------------- columns --------------------------- */

  const columns: DataTableColumn<Transaction>[] = [
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
              className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
              aria-label="Flagged"
            />
          ) : null}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      accessor: (r) => r.type,
      sortable: true,
      render: (r) => {
        const meta = TYPE_META[r.type]
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                meta?.direction === 'in' ? 'bg-emerald' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            <span className="text-ink text-xs">
              {TYPE_LABEL[r.type] ?? r.type}
            </span>
          </div>
        )
      },
    },
    {
      key: 'user',
      header: 'User',
      accessor: (r) => r.user,
      sortable: true,
      render: (r) => <span className="text-ink-secondary">{r.user}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (r) => r.amount,
      sortable: true,
      render: (r) => {
        const meta = TYPE_META[r.type]
        const sign = meta?.direction === 'out' ? '-' : '+'
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`font-medium ${
                meta?.direction === 'out' ? 'text-amber-700' : 'text-ink'
              }`}
            >
              {sign}
              {formatNaira(r.amount)}
            </span>
            {isHighValue(r) ? (
              <span
                title="High value"
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
              >
                <Zap size={8} aria-hidden="true" />
                High
              </span>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      sortable: true,
      render: (r) => {
        const cfg = STATUS_MAP[r.status] ?? STATUS_MAP.pending
        return <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
      },
    },
    {
      key: 'createdAt',
      header: 'Date',
      accessor: (r) => r.createdAt,
      sortable: true,
      render: (r) => {
        const days = daysBetween(r.createdAt)
        return (
          <div className="text-xs">
            <div className="text-ink-secondary">
              {r.createdAt
                ? new Date(r.createdAt).toLocaleDateString()
                : '—'}
            </div>
            {days !== null && days < 7 ? (
              <div className="text-[10px] text-ink-muted">
                {formatRelativeTime(r.createdAt)}
              </div>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'flags',
      header: 'Flags',
      render: (r) => {
        const list = anomaliesByTxn.get(r.id) ?? []
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

  const filters: DataTableFilter<Transaction>[] = [
    {
      key: 'type',
      label: 'Type',
      options: Object.entries(TYPE_LABEL).map(([value, label]) => ({
        value,
        label,
      })),
      apply: (row, value) => row.type === value,
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'successful', label: 'Successful' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'direction',
      label: 'Direction',
      options: [
        { value: 'in', label: 'Inflow' },
        { value: 'out', label: 'Outflow' },
      ],
      apply: (row, value) => {
        if (value === 'in') return isInflow(row)
        if (value === 'out') return isOutflow(row)
        return true
      },
    },
    {
      key: 'amount',
      label: 'Amount',
      options: [
        { value: 'high', label: 'High (≥ ₦50k)' },
        { value: 'regular', label: 'Regular (< ₦50k)' },
      ],
      apply: (row, value) => {
        if (value === 'high') return isHighValue(row)
        if (value === 'regular') return !isHighValue(row)
        return true
      },
    },
  ]

  /* ----------------------- bulk actions -------------------------- */

  const bulkActions: BulkAction<Transaction>[] = [
    {
      key: 'export',
      label: 'Export selected',
      onRun: (rows) => {
        if (rows.length === 0) return
        const headers = [
          'reference', 'type', 'direction', 'user', 'amount', 'status', 'createdAt',
        ]
        const lines = [headers.join(',')]
        for (const t of rows) {
          lines.push(
            [
              t.reference, TYPE_LABEL[t.type] ?? t.type,
              TYPE_META[t.type]?.direction ?? '—',
              t.user, String(t.amount), t.status, t.createdAt ?? '',
            ]
              .map((v) => escapeCSV(String(v ?? '')))
              .join(','),
          )
        }
        downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
        toast.success(
          `${rows.length} ${rows.length === 1 ? 'transaction' : 'transactions'} exported`,
        )
      },
    },
    {
      key: 'copy',
      label: 'Copy summaries',
      onRun: async (rows) => {
        if (rows.length === 0) return
        const text = rows.map(buildTxnSummary).join('\n\n---\n\n')
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

  /* ---------------------------- error state ------------------------ */

  if (isError) {
    return (
      <AppShell title="Financials">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load transactions"
            description={
              error instanceof Error ? error.message : 'Please try again.'
            }
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render --------------------------- */

  return (
    <AppShell title="Financials">
      <style>{ANIMATIONS}</style>

      {/* Top banner if any critical or high-severity anomalies */}
      {(stats.failed > 0 || stats.pending > 0) ? (
        <div className="fp-fade-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-amber-800">
            <AlertCircle size={15} aria-hidden="true" />
            <span className="font-semibold">
              {stats.pending} pending · {stats.failed} failed
            </span>
            <span className="text-xs text-amber-700/80">
              {formatNaira(stats.pendingAmount)} pending ·{' '}
              {formatNaira(stats.failedAmount)} failed
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {stats.pending > 0 ? (
              <button
                type="button"
                onClick={() => setTab('pending')}
                className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-700 transition-colors"
              >
                View pending
                <ChevronRight size={11} aria-hidden="true" />
              </button>
            ) : null}
            {stats.failed > 0 ? (
              <button
                type="button"
                onClick={() => setTab('failed')}
                className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600 transition-colors"
              >
                View failed
                <ChevronRight size={11} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 fp-stagger">
        <KpiCard
          icon={<Gauge size={14} aria-hidden="true" />}
          tone="slate"
          label="Transactions"
          value={stats.total.toLocaleString()}
          hint={`${stats.successRate}% success rate`}
        />
        <KpiCard
          icon={<ArrowDownRight size={14} aria-hidden="true" />}
          tone="emerald"
          label="Inflow"
          value={formatCompactNaira(stats.inflow)}
          hint="Successful credits"
        />
        <KpiCard
          icon={<ArrowUpRight size={14} aria-hidden="true" />}
          tone="amber"
          label="Outflow"
          value={formatCompactNaira(stats.outflow)}
          hint="Successful debits"
        />
        <KpiCard
          icon={<TrendingUp size={14} aria-hidden="true" />}
          tone={stats.netFlow >= 0 ? 'emerald' : 'red'}
          label="Net flow"
          value={formatCompactNaira(stats.netFlow)}
          hint={stats.netFlow >= 0 ? 'Positive' : 'Negative'}
        />
        <KpiCard
          icon={<Clock size={14} aria-hidden="true" />}
          tone={stats.pending > 0 ? 'amber' : 'slate'}
          label="Pending"
          value={String(stats.pending)}
          hint={formatCompactNaira(stats.pendingAmount)}
        />
        <KpiCard
          icon={<Ban size={14} aria-hidden="true" />}
          tone={stats.failed > 0 ? 'red' : 'slate'}
          label="Failed"
          value={String(stats.failed)}
          hint={formatCompactNaira(stats.failedAmount)}
        />
      </div>

      {/* Charts row */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Inflow vs Outflow trend */}
        <div className="rounded-xl border border-border bg-surface p-5 fp-fade-up">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-ink">Cash flow</h3>
            </div>
            <span className="text-[11px] text-ink-muted">last 7 days</span>
          </div>

          <div className="mb-2 flex items-center gap-3 text-[10px] text-ink-muted">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-emerald" /> In
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-sm bg-amber-500" /> Out
            </span>
          </div>

          <div className="flex items-end gap-2 h-32">
            {trend.map((d) => {
              const inH = (d.inflow / maxTrend) * 100
              const outH = (d.outflow / maxTrend) * 100
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${d.label} · in ₦${d.inflow.toLocaleString()} · out ₦${d.outflow.toLocaleString()}`}
                >
                  <div className="flex h-full w-full items-end gap-0.5">
                    <div
                      className="fp-bar flex-1 rounded-t-sm bg-emerald/80"
                      style={{ height: `${Math.max(4, inH)}%` }}
                    />
                    <div
                      className="fp-bar flex-1 rounded-t-sm bg-amber-500/80"
                      style={{ height: `${Math.max(4, outH)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-ink-muted">{d.label}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Type breakdown */}
        <div className="rounded-xl border border-border bg-surface p-5 fp-fade-up">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-emerald" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-ink">By type</h3>
            </div>
            <span className="text-[11px] text-ink-muted">
              {byType.length} active
            </span>
          </div>

          {byType.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">
              No transactions yet.
            </p>
          ) : (
            <div className="space-y-2">
              {byType.map((row) => (
                <div key={row.type}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-ink">
                      <span
                        className="inline-block h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: row.meta.color }}
                      />
                      {row.meta.label}
                    </span>
                    <span className="flex items-center gap-2 text-ink-secondary">
                      <span className="text-[10px] text-ink-muted">
                        {row.count}
                      </span>
                      <span className="tabular-nums font-medium text-ink">
                        {formatCompactNaira(row.amount)}
                      </span>
                    </span>
                  </div>
                  <div className="relative h-1 overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className="fp-bar absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${Math.max(2, row.share * 100)}%`,
                        backgroundColor: row.meta.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs + actions */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 fp-fade-up">
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
                      'fp-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'failed'
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
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald fp-pulse"
              aria-hidden="true"
            />
            Live · {formatRelativeTime(new Date(lastUpdated).toISOString())}
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
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export CSV (Ctrl/Cmd + E)"
            className="fp-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
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
        searchPlaceholder="Search by reference, user…"
        searchFn={(r, q) =>
          r.reference.toLowerCase().includes(q) ||
          r.user.toLowerCase().includes(q)
        }
        pageSize={10}
        loading={isLoading}
        title="Transaction Ledger"
        selectable
        bulkActions={bulkActions}
        viewKey="financials"
        exportFileName="transactions"
        emptyMessage="No payments yet — transactions will appear here"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="Open transaction details"
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
              aria-label="Copy transaction summary"
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
                setDetailId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View transaction"
              title="View transaction"
            >
              <Eye size={15} aria-hidden="true" />
            </button>
          </div>
        )}
      />

      {/* Detail drawer */}
      {detail ? (
        <div
          className="fp-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Transaction details"
          onClick={() => setDetailId(null)}
        >
          <div
            className="fp-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink truncate">
                    {detail.reference}
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
                  {TYPE_LABEL[detail.type] ?? detail.type} ·{' '}
                  {formatRelativeTime(detail.createdAt)}
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
              {/* Big amount */}
              <div className="rounded-xl border border-border bg-surface-alt/40 p-4 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
                  {TYPE_META[detail.type]?.direction === 'out'
                    ? 'Outflow'
                    : 'Inflow'}
                </div>
                <div className="text-3xl font-bold text-ink tabular-nums">
                  {TYPE_META[detail.type]?.direction === 'out' ? '-' : '+'}
                  {formatNaira(detail.amount)}
                </div>
                <div className="mt-1 text-[11px] text-ink-muted">
                  {detail.status === 'successful'
                    ? 'Successfully processed'
                    : detail.status === 'pending'
                      ? 'Awaiting settlement'
                      : 'Transaction failed'}
                </div>
              </div>

              {/* Details grid */}
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="User" value={detail.user} />
                <DetailField
                  label="Type"
                  value={TYPE_LABEL[detail.type] ?? detail.type}
                />
                <DetailField
                  label="Direction"
                  value={
                    TYPE_META[detail.type]?.direction === 'out'
                      ? 'Outflow'
                      : 'Inflow'
                  }
                />
                <DetailField
                  label="Date"
                  value={
                    detail.createdAt
                      ? new Date(detail.createdAt).toLocaleString()
                      : '—'
                  }
                />
              </div>

              {/* Anomalies */}
              {detailAnomalies.length > 0 ? (
                <div>
                  <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    <Flag size={11} aria-hidden="true" />
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
              <span className="font-mono text-[10px] text-ink-muted">
                {detail.id}
              </span>
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