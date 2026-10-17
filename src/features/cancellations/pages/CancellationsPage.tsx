import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  ArrowDownUp,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  ClipboardCopy,
  Download,
  Eye,
  FileJson,
  Flag,
  Keyboard,
  Loader2,
  Sparkles,
  Square,
  Tag,
  UserX,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import { useAuth } from '../../../store/AuthContext'
import {
  useCancellationSnapshot,
  useCancellations,
  useWaivePenalty,
} from '../../../hooks/queries/useCancellations'
import {
  REASON_LABELS,
  type CancellationBy,
  type CancellationEntry,
} from '../data/mockCancellations'
import { GraceBadge } from '../components/GraceBadge'
import { WaiveModal } from '../components/WaiveModal'
import { SnapshotCard } from '../../subscription/components/SnapshotCard'

/* ==========================================================================
   CONFIG
   ========================================================================== */

const BY_CONFIG: Record<
  CancellationBy,
  { label: string; tone: 'danger' | 'warning' | 'neutral' }
> = {
  rider: { label: 'Rider', tone: 'warning' },
  driver: { label: 'Driver', tone: 'danger' },
  system: { label: 'System', tone: 'neutral' },
}

type TabKey = 'all' | 'penalized' | 'waived' | 'within_grace' | 'recent'

const TABS: Array<{
  key: TabKey
  label: string
  icon: typeof AlertCircle
}> = [
  { key: 'all', label: 'All events', icon: Sparkles },
  { key: 'penalized', label: 'Penalized', icon: AlertCircle },
  { key: 'waived', label: 'Waived', icon: CheckCircle2 },
  { key: 'within_grace', label: 'Within grace', icon: Zap },
  { key: 'recent', label: 'Last 24h', icon: Flag },
]

const BULK_REASONS = [
  'Verified safety concern — penalty reversed',
  'Technical platform error — no rider fault',
  'Admin override — customer service goodwill',
  'Bulk waiver — policy review',
]

const HIGH_FEE_THRESHOLD = 500

const ANIMATIONS = `
  @keyframes cn-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cn-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cn-slide-in-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes cn-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes cn-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
  @keyframes cn-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .cn-fade-up { animation: cn-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .cn-fade-in { animation: cn-fade-in .2s ease both; }
  .cn-slide-in { animation: cn-slide-in-right .3s cubic-bezier(.22,1,.36,1) both; }
  .cn-pop { animation: cn-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .cn-pulse { animation: cn-pulse 1.4s ease-in-out infinite; }
  .cn-shimmer { position: relative; overflow: hidden; }
  .cn-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .cn-shimmer:hover::after { animation: cn-shimmer 1s ease; }
  .snapshot-stagger > * { animation: cn-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .snapshot-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .snapshot-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .snapshot-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .snapshot-stagger > *:nth-child(4) { animation-delay: 180ms; }
  @media (prefers-reduced-motion: reduce) {
    .cn-fade-up, .cn-fade-in, .cn-slide-in, .cn-pop, .cn-pulse,
    .snapshot-stagger > *, .cn-shimmer:hover::after { animation: none !important; }
  }
`

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

function formatNaira(n: number): string {
  return `₦${n.toLocaleString()}`
}

function isoFilename(suffix: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
  return `cancellations-${stamp}${suffix}`
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

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

function buildCSV(rows: CancellationEntry[]): string {
  const headers = [
    'Ride ID',
    'Rider',
    'Driver',
    'Cancelled By',
    'Reason',
    'Grace',
    'Minutes Elapsed',
    'Fee (NGN)',
    'Cancelled At',
    'Waived By',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    const row = [
      r.rideId,
      r.riderName,
      r.driverName,
      BY_CONFIG[r.cancelledBy].label,
      REASON_LABELS[r.reason],
      r.graceStatus,
      String(r.minutesElapsed),
      String(r.fee),
      r.cancelledAt,
      r.overriddenBy ?? '',
    ]
    lines.push(row.map(escapeCSV).join(','))
  }
  return lines.join('\n')
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function CancellationsPage() {
  const { user } = useAuth()

  /* ---------------------------- hooks ---------------------------- */

  const { data: snapshot, isLoading: snapshotLoading } = useCancellationSnapshot()

  const {
    data: cancellations = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useCancellations()

  const waive = useWaivePenalty()

  /* ---------------------------- state ---------------------------- */

  const [selected, setSelected] = useState<CancellationEntry | null>(null)
  const [detail, setDetail] = useState<CancellationEntry | null>(null)
  const [tab, setTab] = useState<TabKey>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkConfirm, setBulkConfirm] = useState<CancellationEntry[] | null>(null)
  const [bulkNote, setBulkNote] = useState('')
  const [copied, setCopied] = useState(false)

  const escapeHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null)

  /* ---------------------------- derived --------------------------- */

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'penalized':
        return cancellations.filter((r) => r.fee > 0 && !r.overriddenBy)
      case 'waived':
        return cancellations.filter((r) => !!r.overriddenBy)
      case 'within_grace':
        return cancellations.filter((r) => r.graceStatus === 'within_grace')
      case 'recent': {
        const cutoff = Date.now() - 24 * 60 * 60 * 1000
        return cancellations.filter(
          (r) => new Date(r.cancelledAt).getTime() > cutoff,
        )
      }
      default:
        return cancellations
    }
  }, [cancellations, tab])

  const tabCounts = useMemo(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000
    return {
      all: cancellations.length,
      penalized: cancellations.filter((r) => r.fee > 0 && !r.overriddenBy).length,
      waived: cancellations.filter((r) => !!r.overriddenBy).length,
      within_grace: cancellations.filter((r) => r.graceStatus === 'within_grace').length,
      recent: cancellations.filter(
        (r) => new Date(r.cancelledAt).getTime() > cutoff,
      ).length,
    } as Record<TabKey, number>
  }, [cancellations])

  const selectedEntries = useMemo(
    () => cancellations.filter((r) => selectedIds.has(r.id)),
    [cancellations, selectedIds],
  )

  const selectedWaivable = useMemo(
    () => selectedEntries.filter((r) => r.fee > 0 && !r.overriddenBy),
    [selectedEntries],
  )

  const selectedTotalFee = useMemo(
    () => selectedWaivable.reduce((sum, r) => sum + r.fee, 0),
    [selectedWaivable],
  )

  const allVisibleSelected = useMemo(() => {
    if (tabFiltered.length === 0) return false
    return tabFiltered.every((r) => selectedIds.has(r.id))
  }, [tabFiltered, selectedIds])

  const highRiskCount = tabFiltered.filter((r) => r.fee >= HIGH_FEE_THRESHOLD).length

  /* ---------------------------- selection ------------------------- */

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const r of tabFiltered) next.delete(r.id)
      } else {
        for (const r of tabFiltered) next.add(r.id)
      }
      return next
    })
  }, [allVisibleSelected, tabFiltered])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  /* ---------------------------- waive ----------------------------- */

  const handleWaive = async (note: string) => {
    if (!selected || !note) {
      if (!note) toast.error('Note required', 'Please explain why you are waiving.')
      return
    }

    const adminName = user ? `${user.firstName} ${user.lastName}` : 'Admin'

    try {
      await waive.mutateAsync({ id: selected.id, note, adminName })
      toast.success(
        'Penalty waived',
        `₦200 waived for ${selected.riderName} by ${adminName}.`,
      )
      setSelected(null)
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleBulkWaive = async () => {
    if (!bulkConfirm || !bulkNote.trim()) {
      toast.error('Note required', 'Add a reason before waiving.')
      return
    }

    const adminName = user ? `${user.firstName} ${user.lastName}` : 'Admin'
    const items = bulkConfirm

    const results = await Promise.allSettled(
      items.map((item) =>
        waive.mutateAsync({ id: item.id, note: bulkNote.trim(), adminName }),
      ),
    )

    const ok = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    if (ok > 0) {
      toast.success(
        `${ok} ${ok === 1 ? 'penalty' : 'penalties'} waived`,
        `${formatNaira(items.reduce((s, i) => s + i.fee, 0))} reversed by ${adminName}.`,
      )
    }
    if (failed > 0) {
      toast.error(
        `${failed} ${failed === 1 ? 'waive' : 'waives'} failed`,
        'Some items could not be waived — please retry.',
      )
    }

    setBulkConfirm(null)
    setBulkNote('')
    setSelectedIds(new Set())
  }

  const openBulkWaive = () => {
    if (selectedWaivable.length === 0) {
      toast.error(
        'Nothing to waive',
        'Selected rows have no outstanding penalties.',
      )
      return
    }
    setBulkConfirm(selectedWaivable)
    setBulkNote('')
  }

  /* --------------------------- export ----------------------------- */

  const handleExportCSV = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No rows match the current view.')
      return
    }
    downloadFile(buildCSV(rows), isoFilename('.csv'), 'text/csv;charset=utf-8')
    toast.success(
      'CSV exported',
      `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} downloaded.`,
    )
  }, [tabFiltered])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No rows match the current view.')
      return
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      rows,
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('.json'),
      'application/json',
    )
    toast.success(
      'JSON exported',
      `${rows.length} ${rows.length === 1 ? 'row' : 'rows'} downloaded.`,
    )
  }, [tabFiltered, tab])

  const handleCopyJSON = useCallback(async (row: CancellationEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [])

  /* ------------------------ keyboard shortcuts -------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField =
        tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // Escape always runs
      if (e.key === 'Escape') {
        if (detail) { setDetail(null); return }
        if (bulkConfirm) { setBulkConfirm(null); return }
        if (selected) { setSelected(null); return }
        if (selectedIds.size > 0) { clearSelection(); return }
        return
      }

      if (inField) return
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllVisible()
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportCSV()
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleExportJSON()
      }
    }

    escapeHandlerRef.current = handler
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      escapeHandlerRef.current = null
    }
  }, [
    detail, bulkConfirm, selected, selectedIds.size,
    clearSelection, selectAllVisible, handleExportCSV, handleExportJSON,
  ])

  /* --------------------------- columns ---------------------------- */

  const columns: DataTableColumn<CancellationEntry>[] = [
    {
      key: '_select',
      header: '',
      accessor: (r) => r.id,
      render: (r) => (
        <input
          type="checkbox"
          checked={selectedIds.has(r.id)}
          onChange={() => toggleSelect(r.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select cancellation for ${r.riderName}`}
          className="h-4 w-4 rounded border-border accent-emerald cursor-pointer"
        />
      ),
    },
    {
      key: 'rideId',
      header: 'Ride',
      accessor: (r) => r.rideId,
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs text-ink font-medium">
          #{r.rideId.replace('rd_', '')}
        </span>
      ),
    },
    {
      key: 'rider',
      header: 'Rider / Driver',
      accessor: (r) => r.riderName,
      sortable: true,
      render: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-ink truncate">{r.riderName}</div>
          <div className="text-xs text-ink-secondary truncate">
            with {r.driverName}
          </div>
        </div>
      ),
    },
    {
      key: 'cancelledBy',
      header: 'Cancelled by',
      accessor: (r) => r.cancelledBy,
      sortable: true,
      render: (r) => {
        const cfg = BY_CONFIG[r.cancelledBy]
        return <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
      },
    },
    {
      key: 'reason',
      header: 'Reason',
      accessor: (r) => REASON_LABELS[r.reason],
      sortable: true,
      render: (r) => (
        <span className="text-ink text-xs">{REASON_LABELS[r.reason]}</span>
      ),
    },
    {
      key: 'grace',
      header: 'Grace',
      render: (r) => (
        <GraceBadge status={r.graceStatus} minutesElapsed={r.minutesElapsed} />
      ),
    },
    {
      key: 'fee',
      header: 'Penalty',
      accessor: (r) => r.fee,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span
            className={
              r.fee === 0
                ? 'text-ink-muted text-xs'
                : 'font-medium text-ink text-sm'
            }
          >
            {r.fee === 0 ? '—' : `₦${r.fee}`}
          </span>
          {r.fee >= HIGH_FEE_THRESHOLD && !r.overriddenBy ? (
            <span
              title="High-value penalty"
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
            >
              <Tag size={8} aria-hidden="true" />
              High
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'cancelledAt',
      header: 'When',
      accessor: (r) => r.cancelledAt,
      sortable: true,
      render: (r) => (
        <div>
          <div className="text-ink-secondary text-xs">
            {timeAgo(r.cancelledAt)}
          </div>
          {r.overriddenBy ? (
            <div className="text-[10px] text-info">
              Waived by {r.overriddenBy.split(' ')[0]}
            </div>
          ) : null}
        </div>
      ),
    },
  ]

  /* --------------------------- filters ---------------------------- */

  const filters: DataTableFilter<CancellationEntry>[] = [
    {
      key: 'cancelledBy',
      label: 'By',
      options: [
        { value: 'rider', label: 'Rider' },
        { value: 'driver', label: 'Driver' },
        { value: 'system', label: 'System' },
      ],
      apply: (row, value) => row.cancelledBy === value,
    },
    {
      key: 'graceStatus',
      label: 'Grace',
      options: [
        { value: 'within_grace', label: 'Within grace' },
        { value: 'after_grace', label: 'After grace' },
        { value: 'waived', label: 'Waived' },
      ],
      apply: (row, value) => {
        if (value === 'waived') return !!row.overriddenBy
        return row.graceStatus === value && !row.overriddenBy
      },
    },
  ]

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Cancellation Penalty Audit">
      <style>{ANIMATIONS}</style>

      {/* -------------------- Snapshot cards -------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 snapshot-stagger">
        {snapshotLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="w-9 h-9" />
              </div>
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : snapshot ? (
          <>
            <SnapshotCard
              icon={AlertCircle}
              label="Penalties Today"
              value={snapshot.penaltiesToday.toString()}
              hint={`${snapshot.currency}${snapshot.penaltiesAmount.toLocaleString()} assessed`}
              tone="warning"
            />
            <SnapshotCard
              icon={CheckCircle2}
              label="Waivers Issued"
              value={snapshot.waiversToday.toString()}
              hint="By admin review"
              tone="success"
            />
            <SnapshotCard
              icon={Flag}
              label="Disputed"
              value={snapshot.disputed.toString()}
              hint="Awaiting resolution"
              tone="danger"
            />
            <SnapshotCard
              icon={UserX}
              label="Driver Cancels"
              value={snapshot.driverCancels.toString()}
              hint="Rider not penalized"
              tone="default"
            />
          </>
        ) : null}
      </div>

      {/* -------------------- Tabs + actions -------------------- */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 cn-fade-up">
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
                      'cn-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
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

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export CSV (Ctrl/Cmd + E)"
            className="cn-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
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
          <div
            title="Ctrl/Cmd + A select all · Ctrl/Cmd + E export · Esc close"
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-border bg-surface-alt/60 px-2 py-1.5 text-[10px] text-ink-muted"
          >
            <Keyboard size={11} aria-hidden="true" />
            <kbd className="font-mono">⌘A</kbd>
            <kbd className="font-mono">⌘E</kbd>
          </div>
        </div>
      </div>

      {/* -------------------- Bulk action bar -------------------- */}
      {selectedIds.size > 0 ? (
        <div className="cn-fade-up mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald/30 bg-emerald-light px-4 py-2.5">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 font-semibold text-emerald-dark hover:text-emerald"
            >
              <CheckSquare size={12} aria-hidden="true" />
              {selectedIds.size} selected
              <X size={10} className="opacity-60" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={selectAllVisible}
              className="inline-flex items-center gap-1 text-emerald-dark/80 hover:text-emerald-dark font-medium"
            >
              {allVisibleSelected ? (
                <>
                  <Square size={11} aria-hidden="true" />
                  Deselect visible
                </>
              ) : (
                <>
                  <CheckSquare size={11} aria-hidden="true" />
                  Select all {tabFiltered.length}
                </>
              )}
            </button>
            {selectedWaivable.length > 0 ? (
              <span className="text-emerald-dark/70">
                {selectedWaivable.length} waivable · {formatNaira(selectedTotalFee)}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={clearSelection}
              className="rounded-md border border-emerald/30 bg-surface px-2.5 py-1 text-[11px] font-semibold text-emerald-dark hover:bg-surface-alt transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={openBulkWaive}
              disabled={selectedWaivable.length === 0 || waive.isPending}
              className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {waive.isPending ? (
                <Loader2 size={11} className="animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles size={11} aria-hidden="true" />
              )}
              Waive {selectedWaivable.length || ''}
            </button>
          </div>
        </div>
      ) : null}

      {/* -------------------- Table -------------------- */}
      {isError ? (
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load cancellations"
            description={
              error instanceof Error ? error.message : 'Please try again.'
            }
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <DataTable
          data={tabFiltered}
          columns={columns}
          rowKey={(r) => r.id}
          filters={filters}
          searchable
          searchPlaceholder="Search by rider, driver, ride ID…"
          searchFn={(r, q) =>
            r.riderName.toLowerCase().includes(q) ||
            r.driverName.toLowerCase().includes(q) ||
            r.rideId.toLowerCase().includes(q)
          }
          pageSize={8}
          loading={isLoading}
          title="Cancellation Events"
          actions={(r) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDetail(r)
                }}
                title="View details"
                className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                aria-label={`View details for ${r.riderName}`}
              >
                <Eye size={13} aria-hidden="true" />
              </button>
              {r.fee > 0 && !r.overriddenBy ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelected(r)
                  }}
                  className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                  title="Waive penalty"
                >
                  Waive
                </button>
              ) : r.overriddenBy ? (
                <span className="text-[11px] text-info font-medium">Waived</span>
              ) : (
                <span className="text-[11px] text-ink-muted">No fee</span>
              )}
            </div>
          )}
        />
      )}

      {/* -------------------- Detail drawer -------------------- */}
      {detail ? (
        <div
          className="cn-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Cancellation details"
          onClick={() => setDetail(null)}
        >
          <div
            className="cn-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">
                    #{detail.rideId.replace('rd_', '')}
                  </span>
                  <StatusBadge status={BY_CONFIG[detail.cancelledBy].tone}>
                    {BY_CONFIG[detail.cancelledBy].label}
                  </StatusBadge>
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {timeAgo(detail.cancelledAt)} ·{' '}
                  {new Date(detail.cancelledAt).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                aria-label="Close details"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <DetailField label="Rider" value={detail.riderName} />
                <DetailField label="Driver" value={detail.driverName} />
                <DetailField
                  label="Reason"
                  value={REASON_LABELS[detail.reason]}
                />
                <DetailField
                  label="Grace"
                  value={
                    detail.graceStatus === 'within_grace'
                      ? `Within grace · ${detail.minutesElapsed}m`
                      : `After grace · ${detail.minutesElapsed}m`
                  }
                />
                <DetailField
                  label="Penalty"
                  value={
                    detail.fee === 0 ? 'None' : formatNaira(detail.fee)
                  }
                />
                <DetailField
                  label="Status"
                  value={
                    detail.overriddenBy
                      ? `Waived by ${detail.overriddenBy}`
                      : detail.fee > 0
                        ? 'Penalty active'
                        : 'No action needed'
                  }
                />
              </div>

              <div className="rounded-lg border border-border bg-surface-alt/50 p-3 text-xs text-ink-secondary">
                <div className="mb-1 font-semibold uppercase tracking-wide text-ink-muted">
                  Raw payload
                </div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>

            <div className="border-t border-border bg-surface-alt/30 px-5 py-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => handleCopyJSON(detail)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 size={12} className="text-emerald" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <ClipboardCopy size={12} aria-hidden="true" />
                    Copy JSON
                  </>
                )}
              </button>
              {detail.fee > 0 && !detail.overriddenBy ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelected(detail)
                    setDetail(null)
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
                >
                  <Sparkles size={12} aria-hidden="true" />
                  Waive penalty
                </button>
              ) : (
                <span className="text-[11px] text-ink-muted">No action available</span>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------- Bulk confirm modal -------------------- */}
      {bulkConfirm ? (
        <div
          className="cn-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bulk-waive-title"
        >
          <div className="cn-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3
                  id="bulk-waive-title"
                  className="text-sm font-semibold text-ink"
                >
                  Waive {bulkConfirm.length}{' '}
                  {bulkConfirm.length === 1 ? 'penalty' : 'penalties'}
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Total reversal: {formatNaira(bulkConfirm.reduce((s, r) => s + r.fee, 0))}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBulkConfirm(null)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <div className="mb-3 max-h-32 overflow-y-auto rounded-lg border border-border bg-surface-alt/40 p-2 space-y-1">
              {bulkConfirm.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between text-[11px] text-ink-secondary"
                >
                  <span className="truncate">
                    {r.riderName}{' '}
                    <span className="text-ink-muted">· #{r.rideId.replace('rd_', '')}</span>
                  </span>
                  <span className="font-medium text-ink">{formatNaira(r.fee)}</span>
                </div>
              ))}
            </div>

            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-ink-secondary">
              Reason
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {BULK_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setBulkNote(reason)}
                  className={[
                    'rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors',
                    bulkNote === reason
                      ? 'border-emerald bg-emerald/10 text-emerald-dark'
                      : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                  ].join(' ')}
                >
                  {reason}
                </button>
              ))}
            </div>
            <textarea
              value={bulkNote}
              onChange={(e) => setBulkNote(e.target.value)}
              rows={3}
              placeholder="Or type a custom reason…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkConfirm(null)}
                disabled={waive.isPending}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBulkWaive}
                disabled={waive.isPending || !bulkNote.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {waive.isPending ? (
                  <>
                    <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                    Waiving…
                  </>
                ) : (
                  <>
                    <Sparkles size={12} aria-hidden="true" />
                    Confirm waive
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------- Single waive modal (preserved) -------------------- */}
      <WaiveModal
        open={selected !== null}
        riderName={selected?.riderName ?? ''}
        fee={selected?.fee ?? 0}
        loading={waive.isPending}
        onConfirm={handleWaive}
        onClose={() => (waive.isPending ? null : setSelected(null))}
      />
    </AppShell>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

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