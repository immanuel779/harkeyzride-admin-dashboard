import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Ban,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Copy,
  Download,
  Eye,
  FileJson,
  Flag,
  History,
  Keyboard,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Timer,
  TrendingUp,
  User,
  X,
  XCircle,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import {
  useComplaints,
  useUpdateComplaint,
} from '../../../hooks/queries/useComplaints'
import type {
  ComplaintPriority,
  ComplaintStatus,
} from '../data/mockComplaints'

/* ==========================================================================
   CONFIG (original STATUS_MAP / PRIORITY_MAP preserved)
   ========================================================================== */

const STATUS_MAP: Record<
  ComplaintStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  open: { label: 'Open', tone: 'danger' },
  in_review: { label: 'In Review', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
  dismissed: { label: 'Dismissed', tone: 'neutral' },
}

const PRIORITY_MAP: Record<
  ComplaintPriority,
  { label: string; tone: 'danger' | 'warning' | 'info' | 'neutral' }
> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  normal: { label: 'Normal', tone: 'info' },
  low: { label: 'Low', tone: 'neutral' },
}

const SLA_URGENT_HOURS = 2
const SLA_HIGH_HOURS = 8
const SLA_NORMAL_HOURS = 24
const SLA_LOW_HOURS = 72
const STALE_OPEN_HOURS = 24

const AUTO_REFRESH_MS = 45_000
const NOTES_KEY_PREFIX = 'hr.complaint.notes.'

type TabKey = 'all' | 'open' | 'in_review' | 'resolved' | 'urgent' | 'flagged'

type SortKey = 'priority' | 'newest' | 'oldest' | 'sla'

const TABS: Array<{ key: TabKey; label: string; icon: typeof MessageSquare }> = [
  { key: 'all', label: 'All', icon: MessageSquare },
  { key: 'open', label: 'Open', icon: AlertCircle },
  { key: 'in_review', label: 'In review', icon: Clock },
  { key: 'resolved', label: 'Resolved', icon: CheckCircle2 },
  { key: 'urgent', label: 'Urgent', icon: ShieldAlert },
  { key: 'flagged', label: 'Flagged', icon: Flag },
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

type NoteEntry = {
  id: string
  body: string
  author: string
  at: string
}

const ANIMATIONS = `
  @keyframes cp-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cp-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes cp-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes cp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes cp-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .cp-fade-up { animation: cp-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .cp-fade-in { animation: cp-fade-in .2s ease both; }
  .cp-slide-in { animation: cp-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .cp-pop { animation: cp-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .cp-pulse { animation: cp-pulse 1.5s ease-in-out infinite; }
  .cp-shimmer { position: relative; overflow: hidden; }
  .cp-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .cp-shimmer:hover::after { animation: cp-shimmer 1s ease; }
  .cp-stagger > * { animation: cp-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .cp-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .cp-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .cp-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .cp-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .cp-stagger > *:nth-child(5) { animation-delay: 240ms; }
  .cp-stagger > *:nth-child(6) { animation-delay: 300ms; }
  @media (prefers-reduced-motion: reduce) {
    .cp-fade-up, .cp-fade-in, .cp-slide-in, .cp-pop, .cp-pulse,
    .cp-stagger > *, .cp-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 0
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, (Date.now() - t) / (60 * 60 * 1000))
}

function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`
  if (hours < 24) return `${Math.floor(hours)}h`
  return `${Math.floor(hours / 24)}d`
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return '—'
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

function readField<T>(c: Record<string, unknown>, key: string): T | undefined {
  return c[key] as T | undefined
}

function getRiderName(c: Record<string, unknown>): string {
  return (
    readField<string>(c, 'riderName') ??
    readField<string>(c, 'userName') ??
    '—'
  )
}

function getRideId(c: Record<string, unknown>): string | null {
  return readField<string>(c, 'rideId') ?? null
}

function getSlaHours(priority: ComplaintPriority): number {
  switch (priority) {
    case 'urgent':
      return SLA_URGENT_HOURS
    case 'high':
      return SLA_HIGH_HOURS
    case 'normal':
      return SLA_NORMAL_HOURS
    case 'low':
      return SLA_LOW_HOURS
  }
}

function computeAnomalies(
  c: Record<string, unknown>,
  all: Array<Record<string, unknown>>,
): Anomaly[] {
  const out: Anomaly[] = []
  const status = readField<ComplaintStatus>(c, 'status') ?? 'open'
  const priority = readField<ComplaintPriority>(c, 'priority') ?? 'normal'
  const createdAt = readField<string>(c, 'createdAt') ?? null
  const hours = hoursSince(createdAt)

  if (status === 'resolved' || status === 'dismissed') return out

  const slaHours = getSlaHours(priority)

  if (hours > slaHours) {
    out.push({
      type: 'sla_breach',
      label: `${priority.toUpperCase()} SLA breach — open ${formatDuration(hours)}`,
      severity: hours > slaHours * 2 ? 'critical' : 'high',
    })
  }

  if (status === 'open' && hours >= STALE_OPEN_HOURS) {
    out.push({
      type: 'stale_open',
      label: `Open ${formatDuration(hours)} without review`,
      severity: hours >= 48 ? 'critical' : 'high',
    })
  }

  if (priority === 'urgent' && status === 'open') {
    out.push({
      type: 'urgent_unreviewed',
      label: 'Urgent complaint still unreviewed',
      severity: 'critical',
    })
  }

  // Same subject appearing multiple times (possible coordinated complaint)
  const subject = (readField<string>(c, 'subject') ?? '').toLowerCase().trim()
  if (subject && subject.length >= 8) {
    const related = all.filter((o) => {
      if (o === c) return false
      const s = (readField<string>(o, 'subject') ?? '').toLowerCase().trim()
      return s === subject
    })
    if (related.length >= 2) {
      out.push({
        type: 'repeat_subject',
        label: `Same subject filed ${related.length + 1}x`,
        severity: 'medium',
      })
    }
  }

  return out
}

function priorityScore(c: Record<string, unknown>): number {
  const priority = readField<ComplaintPriority>(c, 'priority') ?? 'normal'
  const map: Record<ComplaintPriority, number> = {
    urgent: 100,
    high: 75,
    normal: 50,
    low: 25,
  }
  const status = readField<ComplaintStatus>(c, 'status') ?? 'open'
  const statusBonus =
    status === 'open' ? 30 : status === 'in_review' ? 10 : 0
  return map[priority] + statusBonus
}

function sortComplaints(
  list: Array<Record<string, unknown>>,
  key: SortKey,
  anomaliesBy: Map<string, Anomaly[]>,
): Array<Record<string, unknown>> {
  const sorted = [...list]
  switch (key) {
    case 'newest':
      return sorted.sort(
        (a, b) =>
          Date.parse(readField<string>(b, 'createdAt') ?? '') -
          Date.parse(readField<string>(a, 'createdAt') ?? ''),
      )
    case 'oldest':
      return sorted.sort(
        (a, b) =>
          Date.parse(readField<string>(a, 'createdAt') ?? '') -
          Date.parse(readField<string>(b, 'createdAt') ?? ''),
      )
    case 'sla':
      return sorted.sort((a, b) => {
        const aHours = hoursSince(readField<string>(a, 'createdAt'))
        const bHours = hoursSince(readField<string>(b, 'createdAt'))
        return bHours - aHours
      })
    case 'priority':
    default:
      return sorted.sort((a, b) => {
        const sa = priorityScore(a) + (anomaliesBy.get(String(a.id))?.length ?? 0) * 20
        const sb = priorityScore(b) + (anomaliesBy.get(String(b.id))?.length ?? 0) * 20
        if (sa !== sb) return sb - sa
        return (
          Date.parse(readField<string>(a, 'createdAt') ?? '') -
          Date.parse(readField<string>(b, 'createdAt') ?? '')
        )
      })
  }
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
  return `complaints-${stamp}.${ext}`
}

function readNotes(id: string): NoteEntry[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY_PREFIX + id)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeNotes(id: string, notes: NoteEntry[]): void {
  try {
    window.localStorage.setItem(NOTES_KEY_PREFIX + id, JSON.stringify(notes))
  } catch {
    /* ignore */
  }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function ComplaintsPage() {
  const { data: complaints = [], isLoading, isError, error, refetch } =
    useComplaints()
  const update = useUpdateComplaint()

  const [tab, setTab] = useState<TabKey>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [search, setSearch] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(Date.now())
  const [copied, setCopied] = useState<string | null>(null)

  const searchRef = useRef<HTMLInputElement>(null)
  const copiedTimerRef = useRef<number | null>(null)

  /* ---------------------------- derived ---------------------------- */

  const raw = complaints as Array<Record<string, unknown>>

  const anomaliesByComplaint = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const c of raw) {
      map.set(String(c.id), computeAnomalies(c, raw))
    }
    return map
  }, [raw])

  const flaggedIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, list] of anomaliesByComplaint) {
      if (list.length > 0) s.add(id)
    }
    return s
  }, [anomaliesByComplaint])

  const sorted = useMemo(
    () => sortComplaints(raw, sortKey, anomaliesByComplaint),
    [raw, sortKey, anomaliesByComplaint],
  )

  const tabFiltered = useMemo(() => {
    let list = sorted
    switch (tab) {
      case 'open':
        list = list.filter(
          (c) => readField<ComplaintStatus>(c, 'status') === 'open',
        )
        break
      case 'in_review':
        list = list.filter(
          (c) => readField<ComplaintStatus>(c, 'status') === 'in_review',
        )
        break
      case 'resolved':
        list = list.filter(
          (c) => readField<ComplaintStatus>(c, 'status') === 'resolved',
        )
        break
      case 'urgent':
        list = list.filter(
          (c) =>
            readField<ComplaintPriority>(c, 'priority') === 'urgent' &&
            readField<ComplaintStatus>(c, 'status') !== 'resolved' &&
            readField<ComplaintStatus>(c, 'status') !== 'dismissed',
        )
        break
      case 'flagged':
        list = list.filter((c) => flaggedIds.has(String(c.id)))
        break
      default:
        break
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((c) => {
        const hay = [
          readField<string>(c, 'subject') ?? '',
          readField<string>(c, 'description') ?? '',
          getRiderName(c),
          readField<string>(c, 'category') ?? '',
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
    }

    return list
  }, [sorted, tab, flaggedIds, search])

  const counts = useMemo<Record<TabKey, number>>(() => {
    const open = raw.filter((c) => readField(c, 'status') === 'open').length
    const in_review = raw.filter(
      (c) => readField(c, 'status') === 'in_review',
    ).length
    const resolved = raw.filter(
      (c) => readField(c, 'status') === 'resolved',
    ).length
    const urgent = raw.filter(
      (c) =>
        readField(c, 'priority') === 'urgent' &&
        readField(c, 'status') !== 'resolved' &&
        readField(c, 'status') !== 'dismissed',
    ).length
    return {
      all: raw.length,
      open,
      in_review,
      resolved,
      urgent,
      flagged: flaggedIds.size,
    }
  }, [raw, flaggedIds])

  const stats = useMemo(() => {
    const open = counts.open
    const inReview = counts.in_review
    const resolved = counts.resolved
    const urgent = counts.urgent
    const active = open + inReview

    const slaBreaches = raw.filter((c) => {
      const status = readField<ComplaintStatus>(c, 'status')
      if (status === 'resolved' || status === 'dismissed') return false
      const priority =
        readField<ComplaintPriority>(c, 'priority') ?? 'normal'
      const hours = hoursSince(readField<string>(c, 'createdAt'))
      return hours > getSlaHours(priority)
    }).length

    const resolutionTimes = raw
      .map((c) => {
        const created = readField<string>(c, 'createdAt')
        const resolvedAt = readField<string>(c, 'resolvedAt')
        if (!created || !resolvedAt) return null
        return hoursSince(created) - hoursSince(resolvedAt)
      })
      .filter((v): v is number => v !== null && v >= 0)

    const avgResolution =
      resolutionTimes.length > 0
        ? resolutionTimes.reduce((s, t) => s + t, 0) / resolutionTimes.length
        : 0

    return {
      total: raw.length,
      open,
      inReview,
      resolved,
      urgent,
      active,
      slaBreaches,
      flagged: flaggedIds.size,
      avgResolutionHours: avgResolution,
    }
  }, [raw, counts, flaggedIds])

  const detail = useMemo(
    () =>
      detailId
        ? (raw.find((c) => String(c.id) === detailId) ?? null)
        : null,
    [raw, detailId],
  )

  const detailAnomalies = useMemo(
    () =>
      detail
        ? (anomaliesByComplaint.get(String(detail.id)) ?? [])
        : [],
    [detail, anomaliesByComplaint],
  )

  /* ---------------------------- effects ---------------------------- */

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Auto-refresh
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
  }, [detailId, tabFiltered, tab])

  /* ---------------------------- handlers --------------------------- */

  const handleStatus = async (id: string, status: ComplaintStatus) => {
    try {
      await update.mutateAsync({ id, status })
      toast.success(
        `Complaint ${status.replace('_', ' ')}`,
        'Status updated successfully.',
      )
    } catch (e) {
      toast.error('Update failed', e instanceof Error ? e.message : 'Try again.')
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
      toast.error('Nothing to export', 'No complaints match the current view.')
      return
    }
    const headers = [
      'id', 'subject', 'status', 'priority', 'category',
      'rider', 'createdAt', 'updatedAt', 'resolvedAt',
    ]
    const lines = [headers.join(',')]
    for (const c of rows) {
      lines.push(
        [
          String(c.id ?? ''),
          readField<string>(c, 'subject') ?? '',
          readField<string>(c, 'status') ?? '',
          readField<string>(c, 'priority') ?? '',
          readField<string>(c, 'category') ?? '',
          getRiderName(c),
          readField<string>(c, 'createdAt') ?? '',
          readField<string>(c, 'updatedAt') ?? '',
          readField<string>(c, 'resolvedAt') ?? '',
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success('CSV exported', `${rows.length} complaints downloaded.`)
  }, [tabFiltered])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No complaints match the current view.')
      return
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      stats,
      complaints: rows.map((c) => ({
        ...c,
        anomalies: anomaliesByComplaint.get(String(c.id)) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success('JSON exported', `${rows.length} complaints downloaded.`)
  }, [tabFiltered, tab, stats, anomaliesByComplaint])

  /* ---------------------------- error state ------------------------ */

  if (isError) {
    return (
      <AppShell title="Complaints">
        <style>{ANIMATIONS}</style>
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load complaints"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Complaints">
      <style>{ANIMATIONS}</style>

      {/* SLA banner */}
      {stats.slaBreaches > 0 ? (
        <div className="cp-fade-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-red-50 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-danger">
            <ShieldAlert size={15} aria-hidden="true" />
            <span className="font-semibold">
              {stats.slaBreaches} complaint{stats.slaBreaches === 1 ? '' : 's'} past SLA
            </span>
            <span className="text-xs text-danger/80">
              — response overdue
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTab('flagged')}
            className="inline-flex items-center gap-1 rounded-md bg-danger px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
          >
            Review flagged
            <ArrowRight size={11} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 cp-stagger">
        <KpiCard
          icon={<MessageSquare size={14} aria-hidden="true" />}
          tone="slate"
          label="Total"
          value={String(stats.total)}
          hint={`${stats.active} active`}
        />
        <KpiCard
          icon={<AlertCircle size={14} aria-hidden="true" />}
          tone="red"
          label="Open"
          value={String(stats.open)}
          hint="Awaiting action"
        />
        <KpiCard
          icon={<Clock size={14} aria-hidden="true" />}
          tone="sky"
          label="In review"
          value={String(stats.inReview)}
          hint="Being handled"
        />
        <KpiCard
          icon={<CheckCircle2 size={14} aria-hidden="true" />}
          tone="emerald"
          label="Resolved"
          value={String(stats.resolved)}
          hint={
            stats.avgResolutionHours > 0
              ? `Avg ${formatDuration(stats.avgResolutionHours)}`
              : 'No resolutions'
          }
        />
        <KpiCard
          icon={<ShieldAlert size={14} aria-hidden="true" />}
          tone={stats.urgent > 0 ? 'red' : 'slate'}
          label="Urgent"
          value={String(stats.urgent)}
          hint={stats.urgent > 0 ? 'Immediate attention' : 'None'}
        />
        <KpiCard
          icon={<Flag size={14} aria-hidden="true" />}
          tone={stats.flagged > 0 ? 'amber' : 'slate'}
          label="Flagged"
          value={String(stats.flagged)}
          hint={
            stats.slaBreaches > 0 ? `${stats.slaBreaches} breach` : 'No issues'
          }
        />
      </div>

      {/* Tabs + search + actions */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 cp-fade-up">
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
                      'cp-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'flagged' || key === 'urgent'
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-muted sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald cp-pulse" aria-hidden="true" />
            Live · {formatRelative(new Date(lastUpdated).toISOString())}
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
              placeholder="Search complaints…"
              className="w-44 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
            />
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort complaints"
            className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none"
          >
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="sla">SLA aging</option>
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
            className="cp-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
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

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <Skeleton className="h-4 w-64 mb-3" />
              <Skeleton className="h-3 w-40" />
            </div>
          ))}
        </div>
      ) : tabFiltered.length === 0 ? (
        <div className="rounded-xl bg-surface border border-border">
          <EmptyState
            icon={MessageSquare}
            title={
              search || tab !== 'all'
                ? 'No complaints in this view'
                : 'No complaints yet'
            }
            description={
              search || tab !== 'all'
                ? 'Try a different tab or clear the search.'
                : "Rider complaints will appear here as they're filed."
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {tabFiltered.map((c) => (
            <ComplaintCard
              key={String(c.id)}
              complaint={c}
              anomalies={anomaliesByComplaint.get(String(c.id)) ?? []}
              selected={String(c.id) === detailId}
              onSelect={() => setDetailId(String(c.id))}
              onStatusChange={handleStatus}
              updatePending={update.isPending}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {detail ? (
        <ComplaintDetailDrawer
          complaint={detail}
          anomalies={detailAnomalies}
          copied={copied}
          onCopy={handleCopy}
          onClose={() => setDetailId(null)}
          onStatusChange={handleStatus}
          updatePending={update.isPending}
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

function ComplaintCard({
  complaint,
  anomalies,
  selected,
  onSelect,
  onStatusChange,
  updatePending,
}: {
  complaint: Record<string, unknown>
  anomalies: Anomaly[]
  selected: boolean
  onSelect: () => void
  onStatusChange: (id: string, status: ComplaintStatus) => Promise<void>
  updatePending: boolean
}) {
  const status = readField<ComplaintStatus>(complaint, 'status') ?? 'open'
  const priority =
    readField<ComplaintPriority>(complaint, 'priority') ?? 'normal'
  const statusCfg = STATUS_MAP[status]
  const priCfg = PRIORITY_MAP[priority]
  const createdAt = readField<string>(complaint, 'createdAt') ?? ''
  const hours = hoursSince(createdAt)

  const slaHours = getSlaHours(priority)
  const isBreached =
    status !== 'resolved' && status !== 'dismissed' && hours > slaHours

  const isClosed = status === 'resolved' || status === 'dismissed'
  const topAnomaly = anomalies.length > 0
    ? anomalies.reduce((a, b) =>
        ANOMALY_ORDER[a.severity] >= ANOMALY_ORDER[b.severity] ? a : b,
      )
    : null

  return (
    <div
      className={`rounded-xl border bg-surface p-5 transition-all ${
        selected
          ? 'border-emerald shadow-sm ring-1 ring-emerald/20'
          : isBreached
            ? 'border-red-200'
            : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-ink mb-1 truncate">
            {readField<string>(complaint, 'subject') ?? '—'}
          </div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <StatusBadge status={statusCfg.tone}>{statusCfg.label}</StatusBadge>
            <StatusBadge status={priCfg.tone}>{priCfg.label}</StatusBadge>
            <span className="text-[10px] text-ink-muted capitalize">
              {readField<string>(complaint, 'category') ?? '—'}
            </span>
            <span className="text-[10px] text-ink-muted">
              · {new Date(createdAt).toLocaleDateString()}
            </span>
            {hours >= STALE_OPEN_HOURS && !isClosed ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-700">
                <Timer size={8} aria-hidden="true" />
                {formatDuration(hours)}
              </span>
            ) : null}
            {topAnomaly ? (
              <span
                title={anomalies.map((a) => a.label).join(' · ')}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${ANOMALY_STYLES[topAnomaly.severity].bg} ${ANOMALY_STYLES[topAnomaly.severity].text}`}
              >
                <AlertTriangle size={8} aria-hidden="true" />
                {anomalies.length} flag{anomalies.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-ink-secondary leading-relaxed line-clamp-2">
            {readField<string>(complaint, 'description') ?? '—'}
          </p>
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-muted">
            {getRiderName(complaint) !== '—' ? (
              <span className="inline-flex items-center gap-1">
                <User size={9} aria-hidden="true" />
                {getRiderName(complaint)}
              </span>
            ) : null}
            {getRideId(complaint) ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono">
                  #{getRideId(complaint)?.replace('rd_', '')}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <button
          type="button"
          onClick={onSelect}
          className="shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
          aria-label="View details"
        >
          <Eye size={15} aria-hidden="true" />
        </button>
      </div>

      {/* Actions */}
      {!isClosed ? (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border">
          {status === 'open' ? (
            <button
              type="button"
              onClick={() => onStatusChange(String(complaint.id), 'in_review')}
              disabled={updatePending}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-info hover:text-info transition-colors disabled:opacity-40"
            >
              <AlertCircle size={11} aria-hidden="true" />
              Start review
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onStatusChange(String(complaint.id), 'resolved')}
            disabled={updatePending}
            className="inline-flex items-center gap-1 rounded-md border border-emerald bg-emerald-light px-2.5 py-1 text-[11px] font-semibold text-emerald hover:bg-emerald/20 transition-colors disabled:opacity-40"
          >
            <CheckCircle2 size={11} aria-hidden="true" />
            Resolve
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(String(complaint.id), 'dismissed')}
            disabled={updatePending}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors disabled:opacity-40"
          >
            <XCircle size={11} aria-hidden="true" />
            Dismiss
          </button>
        </div>
      ) : (
        <div className="pt-3 border-t border-border text-[11px] text-ink-muted">
          {readField<string>(complaint, 'resolvedAt')
            ? `Resolved ${new Date(
                readField<string>(complaint, 'resolvedAt') ?? '',
              ).toLocaleDateString()}`
            : `Closed ${new Date(
                readField<string>(complaint, 'updatedAt') ??
                  new Date().toISOString(),
              ).toLocaleDateString()}`}
        </div>
      )}
    </div>
  )
}

function ComplaintDetailDrawer({
  complaint,
  anomalies,
  copied,
  onCopy,
  onClose,
  onStatusChange,
  updatePending,
}: {
  complaint: Record<string, unknown>
  anomalies: Anomaly[]
  copied: string | null
  onCopy: (value: string, key: string) => Promise<void>
  onClose: () => void
  onStatusChange: (id: string, status: ComplaintStatus) => Promise<void>
  updatePending: boolean
}) {
  const id = String(complaint.id)
  const status = readField<ComplaintStatus>(complaint, 'status') ?? 'open'
  const priority =
    readField<ComplaintPriority>(complaint, 'priority') ?? 'normal'
  const statusCfg = STATUS_MAP[status]
  const priCfg = PRIORITY_MAP[priority]
  const createdAt = readField<string>(complaint, 'createdAt') ?? ''
  const hours = hoursSince(createdAt)
  const slaHours = getSlaHours(priority)

  const [notes, setNotes] = useState<NoteEntry[]>(() => readNotes(id))
  const [draft, setDraft] = useState('')

  useEffect(() => {
    setNotes(readNotes(id))
  }, [id])

  const handleAddNote = () => {
    if (!draft.trim()) return
    const entry: NoteEntry = {
      id: `n_${Date.now()}`,
      body: draft.trim(),
      author: 'Admin',
      at: new Date().toISOString(),
    }
    const next = [entry, ...notes]
    setNotes(next)
    writeNotes(id, next)
    setDraft('')
    toast.success('Note saved')
  }

  const handleDeleteNote = (noteId: string) => {
    const next = notes.filter((n) => n.id !== noteId)
    setNotes(next)
    writeNotes(id, next)
  }

  const isClosed = status === 'resolved' || status === 'dismissed'

  return (
    <div
      className="cp-fade-in fixed inset-0 z-[10000] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Complaint details"
      onClick={onClose}
    >
      <div
        className="cp-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={statusCfg.tone}>{statusCfg.label}</StatusBadge>
              <StatusBadge status={priCfg.tone}>{priCfg.label}</StatusBadge>
              <span className="text-[10px] text-ink-muted capitalize">
                {readField<string>(complaint, 'category') ?? '—'}
              </span>
            </div>
            <h2 className="text-sm font-bold text-ink truncate">
              {readField<string>(complaint, 'subject') ?? '—'}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {formatRelative(createdAt)} · opened{' '}
              {new Date(createdAt).toLocaleString()}
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
          {/* SLA status */}
          {!isClosed ? (
            <div
              className={`rounded-lg border p-3 ${
                hours > slaHours
                  ? 'border-red-200 bg-red-50'
                  : 'border-emerald-200 bg-emerald-50'
              }`}
            >
              <div
                className={`flex items-center justify-between text-[11px] ${
                  hours > slaHours ? 'text-danger' : 'text-emerald-700'
                }`}
              >
                <span className="flex items-center gap-1.5 font-semibold uppercase tracking-wide">
                  <Timer size={11} aria-hidden="true" />
                  SLA Status
                </span>
                <span className="tabular-nums">
                  {formatDuration(hours)} / {formatDuration(slaHours)}
                </span>
              </div>
              <div
                className={`mt-1 text-xs font-medium ${
                  hours > slaHours ? 'text-danger' : 'text-emerald-700'
                }`}
              >
                {hours > slaHours
                  ? `Breached by ${formatDuration(hours - slaHours)}`
                  : `${formatDuration(slaHours - hours)} remaining`}
              </div>
            </div>
          ) : null}

          {/* Description */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Description
            </div>
            <div className="rounded-lg border border-border bg-surface-alt/40 p-3 text-xs text-ink-secondary leading-relaxed whitespace-pre-wrap">
              {readField<string>(complaint, 'description') ?? '—'}
            </div>
          </div>

          {/* Rider info */}
          {getRiderName(complaint) !== '—' || getRideId(complaint) ? (
            <div className="grid grid-cols-2 gap-3">
              {getRiderName(complaint) !== '—' ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    Rider
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-xs font-medium text-ink truncate">
                      {getRiderName(complaint)}
                    </span>
                  </div>
                </div>
              ) : null}
              {getRideId(complaint) ? (
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                    Ride
                  </div>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="font-mono text-xs text-ink truncate">
                      #{getRideId(complaint)?.replace('rd_', '')}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onCopy(getRideId(complaint) ?? '', `ride-${id}`)
                      }
                      className="rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
                      aria-label="Copy ride id"
                    >
                      {copied === `ride-${id}` ? (
                        <Check size={11} className="text-emerald" aria-hidden="true" />
                      ) : (
                        <Copy size={11} aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Anomalies */}
          {anomalies.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                <AlertTriangle size={11} aria-hidden="true" />
                Flags
                <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                  {anomalies.length}
                </span>
              </div>
              <div className="space-y-1">
                {anomalies.map((a) => {
                  const style = ANOMALY_STYLES[a.severity]
                  return (
                    <div
                      key={a.type}
                      className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${style.bg} ${style.text}`}
                    >
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{a.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-emerald/20 bg-emerald-light/40 px-2.5 py-1.5 text-[11px] text-emerald-dark">
              No anomalies detected for this complaint.
            </div>
          )}

          {/* Actions */}
          {!isClosed ? (
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Actions
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {status === 'open' ? (
                  <button
                    type="button"
                    onClick={() => onStatusChange(id, 'in_review')}
                    disabled={updatePending}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-info hover:text-info transition-colors disabled:opacity-40"
                  >
                    <AlertCircle size={11} aria-hidden="true" />
                    Start review
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onStatusChange(id, 'resolved')}
                  disabled={updatePending}
                  className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40"
                >
                  <CheckCircle2 size={11} aria-hidden="true" />
                  Resolve
                </button>
                <button
                  type="button"
                  onClick={() => onStatusChange(id, 'dismissed')}
                  disabled={updatePending}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors disabled:opacity-40"
                >
                  <XCircle size={11} aria-hidden="true" />
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}

          {/* Notes */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <History size={11} aria-hidden="true" />
              Admin notes ({notes.length})
            </div>
            <div className="flex items-start gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAddNote()
                }}
                rows={2}
                placeholder="Add a note… (⌘↵ to save)"
                className="flex-1 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 resize-none"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={!draft.trim()}
                className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus size={11} aria-hidden="true" />
                Save
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="mt-2 text-[10px] text-ink-muted text-center">
                No notes yet.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {notes.map((n) => (
                  <li
                    key={n.id}
                    className="group flex items-start justify-between gap-2 rounded-md border border-border bg-canvas px-2.5 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="whitespace-pre-wrap text-[11px] text-ink leading-relaxed">
                        {n.body}
                      </p>
                      <div className="mt-0.5 text-[9px] text-ink-muted">
                        {n.author} · {formatRelative(n.at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteNote(n.id)}
                      className="shrink-0 rounded p-0.5 text-ink-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100"
                      aria-label="Delete note"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Raw payload */}
          <div className="rounded-lg border border-border bg-surface-alt/50 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Raw payload
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {JSON.stringify(complaint, null, 2)}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <button
            type="button"
            onClick={() =>
              onCopy(JSON.stringify(complaint, null, 2), `full-${id}`)
            }
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            {copied === `full-${id}` ? (
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
          <span className="font-mono text-[10px] text-ink-muted">
            {String(complaint.id ?? '')}
          </span>
        </div>
      </div>
    </div>
  )
}