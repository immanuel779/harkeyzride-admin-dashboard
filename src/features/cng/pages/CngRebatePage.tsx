import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Building2,
  CheckCircle2,
  ClipboardCopy,
  Download,
  Eye,
  FileJson,
  Flame,
  Fuel,
  Keyboard,
  Loader2,
  MapPin,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Trophy,
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
import {
  useCngSnapshot,
  useCngStations,
  useRefuels,
} from '../../../hooks/queries/useCng'
import type { RefuelEntry } from '../data/mockCng'
import { SnapshotCard } from '../../subscription/components/SnapshotCard'
import { StationCard } from '../components/StationCard'

/* ==========================================================================
   CONFIG
   ========================================================================== */

const HIGH_VOLUME_KG = 20
const HIGH_REBATE_NAIRA = 500

type TabKey = 'all' | 'today' | 'week' | 'high_volume' | 'rebate'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Fuel }> = [
  { key: 'all', label: 'All refuels', icon: Fuel },
  { key: 'today', label: 'Today', icon: Zap },
  { key: 'week', label: 'Last 7 days', icon: TrendingUp },
  { key: 'high_volume', label: 'High volume', icon: Flame },
  { key: 'rebate', label: 'With rebate', icon: Sparkles },
]

const ANIMATIONS = `
  @keyframes cng-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes cng-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes cng-slide-in-right { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes cng-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes cng-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes cng-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  @keyframes cng-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .cng-fade-up { animation: cng-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .cng-fade-in { animation: cng-fade-in .2s ease both; }
  .cng-slide-in { animation: cng-slide-in-right .3s cubic-bezier(.22,1,.36,1) both; }
  .cng-pop { animation: cng-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .cng-pulse { animation: cng-pulse 1.5s ease-in-out infinite; }
  .cng-shimmer { position: relative; overflow: hidden; }
  .cng-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .cng-shimmer:hover::after { animation: cng-shimmer 1s ease; }
  .cng-stagger > * { animation: cng-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .cng-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .cng-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .cng-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .cng-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .cng-bar { transform-origin: left center; animation: cng-bar-grow .6s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .cng-fade-up, .cng-fade-in, .cng-slide-in, .cng-pop, .cng-pulse, .cng-bar,
    .cng-stagger > *, .cng-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

function buildCSV(rows: RefuelEntry[]): string {
  const headers = [
    'Reference',
    'Driver',
    'Station',
    'Volume (kg)',
    'Total Cost (NGN)',
    'Rebate (NGN)',
    'Refueled At',
  ]
  const lines = [headers.join(',')]
  for (const r of rows) {
    lines.push(
      [
        r.reference,
        r.driverName,
        r.stationName,
        r.kg.toFixed(2),
        String(r.totalCost),
        String(Math.round(r.rebateEarned)),
        r.refueledAt,
      ]
        .map(escapeCSV)
        .join(','),
    )
  }
  return lines.join('\n')
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
  return `cng-refuels-${stamp}.${ext}`
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function CngRebatePage() {
  /* ---------------------------- hooks ---------------------------- */

  const { data: snapshot, isLoading: snapshotLoading } = useCngSnapshot()

  const {
    data: stations = [],
    isLoading: stationsLoading,
    isError: stationsError,
    error: stationsErr,
    refetch: refetchStations,
  } = useCngStations()

  const {
    data: refuels = [],
    isLoading: refuelsLoading,
    isError: refuelsError,
    error: refuelsErr,
    refetch: refetchRefuels,
  } = useRefuels()

  /* ---------------------------- state ---------------------------- */

  const [tab, setTab] = useState<TabKey>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<RefuelEntry | null>(null)
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())

  const copiedTimerRef = useRef<number | null>(null)

  /* ---------------------------- derived -------------------------- */

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'today': {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        return refuels.filter((r) => new Date(r.refueledAt).getTime() >= start.getTime())
      }
      case 'week': {
        const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
        return refuels.filter((r) => new Date(r.refueledAt).getTime() >= cutoff)
      }
      case 'high_volume':
        return refuels.filter((r) => r.kg >= HIGH_VOLUME_KG)
      case 'rebate':
        return refuels.filter((r) => r.rebateEarned >= HIGH_REBATE_NAIRA)
      default:
        return refuels
    }
  }, [refuels, tab])

  const tabCounts = useMemo<Record<TabKey, number>>(() => {
    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)
    const startOfTodayMs = startOfToday.getTime()
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

    return {
      all: refuels.length,
      today: refuels.filter((r) => new Date(r.refueledAt).getTime() >= startOfTodayMs).length,
      week: refuels.filter((r) => new Date(r.refueledAt).getTime() >= weekAgo).length,
      high_volume: refuels.filter((r) => r.kg >= HIGH_VOLUME_KG).length,
      rebate: refuels.filter((r) => r.rebateEarned >= HIGH_REBATE_NAIRA).length,
    }
  }, [refuels])

  const selectedEntries = useMemo(
    () => tabFiltered.filter((r) => selectedIds.has(r.id)),
    [tabFiltered, selectedIds],
  )

  const selectedTotals = useMemo(() => {
    return selectedEntries.reduce(
      (acc, r) => ({
        kg: acc.kg + r.kg,
        cost: acc.cost + r.totalCost,
        rebate: acc.rebate + r.rebateEarned,
      }),
      { kg: 0, cost: 0, rebate: 0 },
    )
  }, [selectedEntries])

  const allVisibleSelected = useMemo(() => {
    if (tabFiltered.length === 0) return false
    return tabFiltered.every((r) => selectedIds.has(r.id))
  }, [tabFiltered, selectedIds])

  const quickStats = useMemo(() => {
    const totalKg = tabFiltered.reduce((s, r) => s + r.kg, 0)
    const totalRebate = tabFiltered.reduce((s, r) => s + r.rebateEarned, 0)
    const drivers = new Set(tabFiltered.map((r) => r.driverName))
    const avgKg = tabFiltered.length > 0 ? totalKg / tabFiltered.length : 0
    return {
      avgKg,
      totalKg,
      totalRebate,
      uniqueDrivers: drivers.size,
      count: tabFiltered.length,
    }
  }, [tabFiltered])

  const leaderboard = useMemo(() => {
    const map = new Map<string, { station: string; kg: number; rebate: number; count: number }>()
    for (const r of tabFiltered) {
      let row = map.get(r.stationName)
      if (!row) {
        row = { station: r.stationName, kg: 0, rebate: 0, count: 0 }
        map.set(r.stationName, row)
      }
      row.kg += r.kg
      row.rebate += r.rebateEarned
      row.count += 1
    }
    const rows = [...map.values()].sort((a, b) => b.kg - a.kg)
    const max = rows.length > 0 ? rows[0].kg : 1
    return rows.map((r) => ({ ...r, share: max > 0 ? r.kg / max : 0 }))
  }, [tabFiltered])

  const last7Days = useMemo(() => {
    const out: Array<{ label: string; value: number; date: string }> = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const start = d.getTime()
      const end = start + 24 * 60 * 60 * 1000
      const total = tabFiltered
        .filter((r) => {
          const t = new Date(r.refueledAt).getTime()
          return t >= start && t < end
        })
        .reduce((s, r) => s + r.kg, 0)
      out.push({
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        value: total,
        date: d.toISOString().slice(0, 10),
      })
    }
    return out
  }, [tabFiltered])

  const last7Max = Math.max(1, ...last7Days.map((d) => d.value))

  const hourly = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: h, kg: 0, count: 0 }))
    for (const r of tabFiltered) {
      const h = new Date(r.refueledAt).getHours()
      buckets[h].kg += r.kg
      buckets[h].count += 1
    }
    const max = Math.max(1, ...buckets.map((b) => b.kg))
    return buckets.map((b) => ({ ...b, intensity: b.kg / max }))
  }, [tabFiltered])

  /* --------------------------- selection ------------------------- */

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

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  /* --------------------------- refresh --------------------------- */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await Promise.all([refetchStations(), refetchRefuels()])
      setLastUpdated(Date.now())
    } finally {
      setRefreshing(false)
    }
  }, [refetchStations, refetchRefuels])

  /* ---------------------------- export --------------------------- */

  const handleExportCSV = useCallback(
    (rows: RefuelEntry[] = tabFiltered) => {
      if (rows.length === 0) return
      downloadFile(buildCSV(rows), isoFilename('csv'), 'text/csv;charset=utf-8')
    },
    [tabFiltered],
  )

  const handleExportJSON = useCallback(
    (rows: RefuelEntry[] = tabFiltered) => {
      if (rows.length === 0) return
      const payload = {
        generatedAt: new Date().toISOString(),
        count: rows.length,
        tab,
        totals: selectedTotals,
        rows,
      }
      downloadFile(
        JSON.stringify(payload, null, 2),
        isoFilename('json'),
        'application/json',
      )
    },
    [tabFiltered, tab, selectedTotals],
  )

  const handleCopyJSON = useCallback(async (row: RefuelEntry) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(row, null, 2))
      setCopied(true)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard unavailable */
    }
  }, [])

  /* ---------------------- keyboard shortcuts --------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detail) { setDetail(null); return }
        if (selectedIds.size > 0) { clearSelection(); return }
        return
      }

      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        selectAllVisible()
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportCSV(selectedEntries.length > 0 ? selectedEntries : tabFiltered)
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleExportJSON(selectedEntries.length > 0 ? selectedEntries : tabFiltered)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [
    detail, selectedIds.size, clearSelection, selectAllVisible,
    handleExportCSV, handleExportJSON, selectedEntries, tabFiltered,
  ])

  useEffect(() => () => {
    if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
  }, [])

  /* --------------------------- columns --------------------------- */

  const columns: DataTableColumn<RefuelEntry>[] = [
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
          aria-label={`Select refuel ${r.reference}`}
          className="h-4 w-4 rounded border-border accent-emerald cursor-pointer"
        />
      ),
    },
    {
      key: 'reference',
      header: 'Reference',
      accessor: (r) => r.reference,
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs text-ink font-medium">
          {r.reference.split('-').slice(-1)[0]}
        </span>
      ),
    },
    {
      key: 'driverName',
      header: 'Driver',
      accessor: (r) => r.driverName,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-semibold">
            {r.driverName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="font-medium text-ink truncate">{r.driverName}</div>
        </div>
      ),
    },
    {
      key: 'stationName',
      header: 'Station',
      accessor: (r) => r.stationName,
      sortable: true,
      render: (r) => (
        <span className="text-ink-secondary text-xs">{r.stationName}</span>
      ),
    },
    {
      key: 'kg',
      header: 'Volume',
      accessor: (r) => r.kg,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-ink">{r.kg.toFixed(1)} kg</span>
          {r.kg >= HIGH_VOLUME_KG ? (
            <span
              title="High-volume refuel"
              className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700"
            >
              <Flame size={8} aria-hidden="true" />
              High
            </span>
          ) : null}
        </div>
      ),
    },
    {
      key: 'totalCost',
      header: 'Cost',
      accessor: (r) => r.totalCost,
      sortable: true,
      render: (r) => (
        <span className="text-ink text-xs">{formatNaira(r.totalCost)}</span>
      ),
    },
    {
      key: 'rebateEarned',
      header: 'Rebate',
      accessor: (r) => r.rebateEarned,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-emerald-dark">
            {formatNaira(Math.round(r.rebateEarned))}
          </span>
          {r.rebateEarned >= HIGH_REBATE_NAIRA ? (
            <Sparkles
              size={10}
              className="text-emerald"
              aria-label="High rebate"
            />
          ) : null}
        </div>
      ),
    },
    {
      key: 'refueledAt',
      header: 'When',
      accessor: (r) => r.refueledAt,
      sortable: true,
      render: (r) => (
        <span className="text-ink-secondary text-xs">{timeAgo(r.refueledAt)}</span>
      ),
    },
  ]

  /* --------------------------- filters --------------------------- */

  const filters: DataTableFilter<RefuelEntry>[] = [
    {
      key: 'stationName',
      label: 'Station',
      options: [
        { value: 'NIPCO Gas Bodija', label: 'NIPCO Bodija' },
        { value: 'NGV Ring Road', label: 'NGV Ring Road' },
        { value: 'Gaslink UI-Sango', label: 'Gaslink UI-Sango' },
        { value: 'Total Filling Station Dugbe', label: 'Total Dugbe' },
        { value: 'Aiteo CNG Challenge', label: 'Aiteo Challenge' },
      ],
      apply: (row, value) => row.stationName === value,
    },
  ]

  /* --------------------------- render ---------------------------- */

  return (
    <AppShell title="CNG Station B2B Rebate">
      <style>{ANIMATIONS}</style>

      {/* -------------------- Snapshot cards -------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6 cng-stagger">
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
              icon={Fuel}
              label="Volume Today"
              value={`${snapshot.volumeToday.toLocaleString()} kg`}
              hint="Across partner stations"
              tone="default"
            />
            <SnapshotCard
              icon={Zap}
              label="Volume This Month"
              value={`${snapshot.volumeThisMonth.toLocaleString()} kg`}
              hint="Fleet CNG consumption"
              tone="default"
            />
            <SnapshotCard
              icon={TrendingUp}
              label="Rebate This Month"
              value={`${snapshot.currency}${snapshot.rebateThisMonth.toLocaleString()}`}
              hint="B2B revenue share"
              tone="success"
            />
            <SnapshotCard
              icon={Building2}
              label="Active Stations"
              value={snapshot.activeStations.toString()}
              hint="Partner network"
              tone="default"
            />
          </>
        ) : null}
      </div>

      {/* -------------------- Quick stats strip -------------------- */}
      {!refuelsLoading && tabFiltered.length > 0 ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 cng-fade-up">
          <QuickStat
            icon={<GaugeIcon />}
            label="Avg refuel"
            value={`${quickStats.avgKg.toFixed(1)} kg`}
            hint={`across ${quickStats.count} events`}
          />
          <QuickStat
            icon={<Fuel size={14} className="text-emerald" aria-hidden="true" />}
            label="Total volume"
            value={`${quickStats.totalKg.toFixed(0)} kg`}
            hint="in current view"
          />
          <QuickStat
            icon={<Sparkles size={14} className="text-emerald" aria-hidden="true" />}
            label="Rebate"
            value={formatNaira(Math.round(quickStats.totalRebate))}
            hint="in current view"
          />
          <QuickStat
            icon={<MapPin size={14} className="text-emerald" aria-hidden="true" />}
            label="Unique drivers"
            value={quickStats.uniqueDrivers.toString()}
            hint="in current view"
          />
        </div>
      ) : null}

      {/* -------------------- Partner stations grid -------------------- */}
      <div className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Partner Stations</h2>
          <span className="text-xs text-ink-muted">
            {stations.length} stations ·{' '}
            {stations.filter((s) => s.status === 'active').length} active
          </span>
        </div>

        {stationsError ? (
          <div className="rounded-xl bg-surface border border-border">
            <ErrorState
              title="Could not load stations"
              description={
                stationsErr instanceof Error
                  ? stationsErr.message
                  : 'Please try again.'
              }
              onRetry={() => refetchStations()}
            />
          </div>
        ) : stationsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-surface border border-border p-5 h-44"
              >
                <Skeleton className="h-4 w-40 mb-2" />
                <Skeleton className="h-3 w-32 mb-4" />
                <Skeleton className="h-16 w-full mb-2" />
                <Skeleton className="h-3 w-24" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 cng-stagger">
            {stations.map((station) => (
              <StationCard key={station.id} station={station} />
            ))}
          </div>
        )}
      </div>

      {/* -------------------- Insights row -------------------- */}
      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Station leaderboard */}
        <div className="rounded-xl border border-border bg-surface p-5 cng-fade-up">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-emerald" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-ink">Station leaderboard</h3>
            </div>
            <span className="text-[11px] text-ink-muted">by volume</span>
          </div>

          {leaderboard.length === 0 ? (
            <p className="py-6 text-center text-xs text-ink-muted">
              No refuels in this view.
            </p>
          ) : (
            <div className="space-y-2.5">
              {leaderboard.slice(0, 5).map((row, i) => (
                <div key={row.station}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                          i === 0
                            ? 'bg-amber-100 text-amber-700'
                            : i === 1
                              ? 'bg-slate-100 text-slate-700'
                              : i === 2
                                ? 'bg-orange-100 text-orange-700'
                                : 'bg-surface-alt text-ink-muted'
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="truncate font-medium text-ink">
                        {row.station}
                      </span>
                    </div>
                    <span className="shrink-0 tabular-nums text-ink-secondary">
                      {row.kg.toFixed(0)} kg
                    </span>
                  </div>
                  <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className="cng-bar absolute inset-y-0 left-0 rounded-full bg-emerald"
                      style={{ width: `${row.share * 100}%` }}
                    />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-ink-muted">
                    <span>
                      {row.count} {row.count === 1 ? 'refuel' : 'refuels'}
                    </span>
                    <span className="text-emerald-dark">
                      {formatNaira(Math.round(row.rebate))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 7-day trend + hourly heatmap */}
        <div className="rounded-xl border border-border bg-surface p-5 cng-fade-up">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-emerald" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-ink">Volume trend</h3>
            </div>
            <span className="text-[11px] text-ink-muted">last 7 days</span>
          </div>

          <div className="mb-4 flex h-24 items-end justify-between gap-1.5">
            {last7Days.map((d) => {
              const h = (d.value / last7Max) * 100
              return (
                <div
                  key={d.date}
                  className="flex flex-1 flex-col items-center gap-1"
                  title={`${d.label}: ${d.value.toFixed(0)} kg`}
                >
                  <div className="relative flex h-full w-full items-end">
                    <div
                      className="cng-bar w-full rounded-t-md bg-emerald/80"
                      style={{ height: `${Math.max(4, h)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-ink-muted">{d.label}</span>
                </div>
              )
            })}
          </div>

          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-emerald" aria-hidden="true" />
              <h4 className="text-xs font-semibold text-ink">
                Hourly distribution
              </h4>
            </div>
            <span className="text-[10px] text-ink-muted">24h</span>
          </div>

          <div className="grid grid-cols-12 gap-1">
            {hourly.map((b) => (
              <div
                key={b.hour}
                title={`${b.hour.toString().padStart(2, '0')}:00 · ${b.count} refuels · ${b.kg.toFixed(0)} kg`}
                className="h-5 rounded-sm transition-transform hover:scale-110"
                style={{
                  backgroundColor:
                    b.intensity === 0
                      ? '#e5e7eb'
                      : `rgba(16, 185, 129, ${0.2 + b.intensity * 0.8})`,
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* -------------------- Tabs + actions -------------------- */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 cng-fade-up">
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
                      'cng-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
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

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-muted sm:inline-flex">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full bg-emerald cng-pulse"
              aria-hidden="true"
            />
            Live · {timeAgo(new Date(lastUpdated).toISOString())}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh data"
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
            onClick={() => handleExportCSV()}
            title="Export CSV (Ctrl/Cmd + E)"
            className="cng-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            onClick={() => handleExportJSON()}
            title="Export JSON (Ctrl/Cmd + J)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            JSON
          </button>
          <div
            title="Ctrl/Cmd + A select all · Ctrl/Cmd + E export · Esc close"
            className="hidden items-center gap-1 rounded-lg border border-border bg-surface-alt/60 px-2 py-1.5 text-[10px] text-ink-muted sm:inline-flex"
          >
            <Keyboard size={11} aria-hidden="true" />
            <kbd className="font-mono">⌘A</kbd>
            <kbd className="font-mono">⌘E</kbd>
          </div>
        </div>
      </div>

      {/* -------------------- Bulk action bar -------------------- */}
      {selectedIds.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald/30 bg-emerald-light px-4 py-2.5 cng-fade-up">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 font-semibold text-emerald-dark hover:text-emerald"
            >
              <CheckCircle2 size={12} aria-hidden="true" />
              {selectedIds.size} selected
              <X size={10} className="opacity-60" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={selectAllVisible}
              className="inline-flex items-center gap-1 font-medium text-emerald-dark/80 hover:text-emerald-dark"
            >
              {allVisibleSelected ? 'Deselect visible' : `Select all ${tabFiltered.length}`}
            </button>
            <span className="text-emerald-dark/70">
              {selectedTotals.kg.toFixed(1)} kg ·{' '}
              {formatNaira(Math.round(selectedTotals.rebate))} rebate
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExportCSV(selectedEntries)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald/30 bg-surface px-2.5 py-1 text-[11px] font-semibold text-emerald-dark hover:bg-surface-alt transition-colors"
            >
              <Download size={11} aria-hidden="true" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => handleExportJSON(selectedEntries)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald/30 bg-surface px-2.5 py-1 text-[11px] font-semibold text-emerald-dark hover:bg-surface-alt transition-colors"
            >
              <FileJson size={11} aria-hidden="true" />
              JSON
            </button>
          </div>
        </div>
      ) : null}

      {/* -------------------- Refuels table -------------------- */}
      {refuelsError ? (
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load refueling logs"
            description={
              refuelsErr instanceof Error
                ? refuelsErr.message
                : 'Please try again.'
            }
            onRetry={() => refetchRefuels()}
          />
        </div>
      ) : (
        <DataTable
          data={tabFiltered}
          columns={columns}
          rowKey={(r) => r.id}
          filters={filters}
          searchable
          searchPlaceholder="Search by driver, station, reference…"
          searchFn={(r, q) =>
            r.driverName.toLowerCase().includes(q) ||
            r.stationName.toLowerCase().includes(q) ||
            r.reference.toLowerCase().includes(q)
          }
          pageSize={8}
          loading={refuelsLoading}
          title="Driver CNG Refueling Logs"
          actions={(r) => (
            <div className="flex items-center justify-end gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setDetail(r)
                }}
                title="View details"
                aria-label={`View refuel details for ${r.driverName}`}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
              >
                <Eye size={13} aria-hidden="true" />
              </button>
            </div>
          )}
        />
      )}

      {/* -------------------- Detail drawer -------------------- */}
      {detail ? (
        <div
          className="cng-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Refuel details"
          onClick={() => setDetail(null)}
        >
          <div
            className="cng-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">
                    {detail.reference.split('-').slice(-1)[0]}
                  </span>
                  {detail.kg >= HIGH_VOLUME_KG ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
                      <Flame size={8} aria-hidden="true" />
                      High volume
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {timeAgo(detail.refueledAt)} ·{' '}
                  {new Date(detail.refueledAt).toLocaleString()}
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

            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
              {/* Driver card */}
              <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-alt/40 px-3 py-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-navy text-white text-sm font-semibold">
                  {detail.driverName.split(' ').map((n) => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-semibold text-ink">
                    {detail.driverName}
                  </div>
                  <div className="truncate text-[11px] text-ink-muted">
                    {detail.stationName}
                  </div>
                </div>
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-2 gap-3">
                <DetailField
                  label="Volume"
                  value={`${detail.kg.toFixed(2)} kg`}
                />
                <DetailField
                  label="Total cost"
                  value={formatNaira(detail.totalCost)}
                />
                <DetailField
                  label="Rebate earned"
                  value={formatNaira(Math.round(detail.rebateEarned))}
                />
                <DetailField
                  label="Rebate / kg"
                  value={
                    detail.kg > 0
                      ? formatNaira(
                          Math.round((detail.rebateEarned / detail.kg) * 100) / 100,
                        )
                      : '—'
                  }
                />
              </div>

              {/* Payload */}
              <div className="rounded-lg border border-border bg-surface-alt/50 p-3 text-xs text-ink-secondary">
                <div className="mb-1 font-semibold uppercase tracking-wide text-ink-muted">
                  Raw payload
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
                  {JSON.stringify(detail, null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
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
              <span className="font-mono text-[10px] text-ink-muted">
                {detail.reference}
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

function QuickStat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-ink tabular-nums">{value}</div>
      <div className="text-[10px] text-ink-muted">{hint}</div>
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

function GaugeIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-emerald"
      aria-hidden="true"
    >
      <path d="M12 14l4-4" />
      <path d="M3.34 19a10 10 0 1 1 17.32 0" />
    </svg>
  )
}