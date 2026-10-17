import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Download,
  Eye,
  FileJson,
  Filter,
  Flag,
  Gauge,
  Gift,
  Hash,
  Info,
  Layers,
  Loader2,
  Pause,
  Pencil,
  Percent,
  Play,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Star,
  Tag,
  Timer,
  Trash2,
  TrendingUp,
  User,
  Zap,
  X,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import {
  useCreatePromotion,
  useDeletePromotion,
  usePromotions,
} from '../../../hooks/queries/usePromotions'
import type { Promotion, PromotionType } from '../data/mockPromotions'

/* ==========================================================================
   CONFIG
   ========================================================================== */

const EXPIRING_SOON_DAYS = 7
const HIGH_COST_THRESHOLD = 500_000
const ZERO_REDEMPTION_GRACE_DAYS = 3

type TabKey =
  | 'all'
  | 'live'
  | 'scheduled'
  | 'expired'
  | 'paused'
  | 'expiring'
  | 'top'
  | 'issues'

type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

type Anomaly = {
  type: string
  label: string
  severity: AnomalySeverity
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof Gift }> = [
  { key: 'all', label: 'All codes', icon: Gift },
  { key: 'live', label: 'Live', icon: Play },
  { key: 'scheduled', label: 'Scheduled', icon: Timer },
  { key: 'expiring', label: 'Expiring soon', icon: AlertTriangle },
  { key: 'expired', label: 'Expired', icon: AlertCircle },
  { key: 'paused', label: 'Paused', icon: Pause },
  { key: 'top', label: 'Top performers', icon: TrendingUp },
  { key: 'issues', label: 'Issues', icon: Flag },
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

const META_KEY = 'hr.promo.meta.v1'
const STATE_KEY = 'hr.promo.state.v1'
const STATS_KEY = 'hr.promo.stats.v1'

const ANIMATIONS = `
  @keyframes pp-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes pp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes pp-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes pp-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes pp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes pp-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  @keyframes pp-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .pp-fade-up { animation: pp-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .pp-fade-in { animation: pp-fade-in .2s ease both; }
  .pp-slide-in { animation: pp-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .pp-pop { animation: pp-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .pp-pulse { animation: pp-pulse 1.5s ease-in-out infinite; }
  .pp-shimmer { position: relative; overflow: hidden; }
  .pp-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .pp-shimmer:hover::after { animation: pp-shimmer 1s ease; }
  .pp-bar { transform-origin: left center; animation: pp-bar-grow .6s cubic-bezier(.22,1,.36,1) both; }
  .pp-stagger > * { animation: pp-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .pp-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .pp-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .pp-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .pp-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .pp-stagger > *:nth-child(5) { animation-delay: 240ms; }
  .pp-stagger > *:nth-child(6) { animation-delay: 300ms; }
  @media (prefers-reduced-motion: reduce) {
    .pp-fade-up, .pp-fade-in, .pp-slide-in, .pp-pop, .pp-pulse, .pp-bar,
    .pp-stagger > *, .pp-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   TYPES & STORAGE
   ========================================================================== */

type PromotionMeta = {
  campaignName?: string
  description?: string
  maxDiscount?: number
  minFare?: number
  usageLimit?: number
  perRiderLimit?: number
  startsAt?: string
  stackable?: boolean
  autoApply?: boolean
}

type PromotionState = {
  paused?: boolean
}

type PromotionStats = {
  redemptions: number
  uniqueRiders: number
  totalDiscount: number
  lastRedeemedAt?: string
}

type MetaMap = Record<string, PromotionMeta>
type StateMap = Record<string, PromotionState>
type StatsMap = Record<string, PromotionStats>

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return (JSON.parse(raw) as T) ?? fallback
  } catch {
    return fallback
  }
}

function writeJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

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

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000))
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function formatExpiry(iso: string | null | undefined): string {
  if (!iso) return 'No expiry'
  const d = daysUntil(iso)
  if (d === null) return '—'
  if (d < 0) return 'Expired'
  if (d === 0) return 'Expires today'
  if (d === 1) return 'Expires tomorrow'
  if (d < 30) return `Expires in ${d} days`
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function generateCode(prefix: string): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const suffix = Array.from({ length: 4 }, () =>
    chars[Math.floor(Math.random() * chars.length)],
  ).join('')
  return `${prefix || 'PROMO'}${suffix}`
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
  return `promotions-${stamp}.${ext}`
}

function valueLabel(p: Promotion): string {
  return p.type === 'percent' ? `${p.value}% off` : `${formatNaira(p.value)} off`
}

function isExpired(p: Promotion): boolean {
  if (!p.expiresAt) return false
  return Date.parse(p.expiresAt) < Date.now()
}

function isScheduled(p: Promotion, meta: PromotionMeta | undefined): boolean {
  if (!meta?.startsAt) return false
  return Date.parse(meta.startsAt) > Date.now()
}

function isExpiringSoon(p: Promotion): boolean {
  if (!p.expiresAt) return false
  const d = daysUntil(p.expiresAt)
  return d !== null && d >= 0 && d <= EXPIRING_SOON_DAYS
}

function isLive(p: Promotion, meta: PromotionMeta | undefined, state: PromotionState | undefined): boolean {
  if (!p.active) return false
  if (state?.paused) return false
  if (isExpired(p)) return false
  if (isScheduled(p, meta)) return false
  return true
}

function computeAnomalies(
  p: Promotion,
  meta: PromotionMeta | undefined,
  state: PromotionState | undefined,
  stats: PromotionStats | undefined,
): Anomaly[] {
  const out: Anomaly[] = []

  if (isExpired(p) && p.active && !state?.paused) {
    out.push({
      type: 'expired_active',
      label: 'Expired but still marked active',
      severity: 'high',
    })
  }

  if (isExpiringSoon(p)) {
    const d = daysUntil(p.expiresAt)
    out.push({
      type: 'expiring',
      label: d === 0 ? 'Expires today' : d === 1 ? 'Expires tomorrow' : `Expires in ${d} days`,
      severity: d !== null && d <= 1 ? 'high' : 'medium',
    })
  }

  if (stats && meta?.usageLimit && stats.redemptions > meta.usageLimit) {
    out.push({
      type: 'over_redeemed',
      label: `Over limit: ${stats.redemptions}/${meta.usageLimit}`,
      severity: 'critical',
    })
  }

  if (
    p.active &&
    stats &&
    stats.redemptions === 0 &&
    daysSince(p.createdAt) !== null &&
    (daysSince(p.createdAt) ?? 0) > ZERO_REDEMPTION_GRACE_DAYS &&
    isLive(p, meta, state)
  ) {
    out.push({
      type: 'zero_redemptions',
      label: `No redemptions in ${daysSince(p.createdAt)} days`,
      severity: 'medium',
    })
  }

  if (stats && stats.totalDiscount >= HIGH_COST_THRESHOLD) {
    out.push({
      type: 'high_cost',
      label: `High cost: ${formatNaira(stats.totalDiscount)} given`,
      severity: 'high',
    })
  }

  return out
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function PromotionsPage() {
  const { data: promos = [], isLoading, isError, error, refetch } = usePromotions()
  const create = useCreatePromotion()
  const del = useDeletePromotion()

  /* ---------------------------- state ---------------------------- */

  const [tab, setTab] = useState<TabKey>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [formPrefill, setFormPrefill] = useState<Promotion | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Promotion | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [meta, setMeta] = useState<MetaMap>({})
  const [state, setState] = useState<StateMap>({})
  const [stats, setStats] = useState<StatsMap>({})

  const copiedTimerRef = useRef<number | null>(null)

  /* --------------------------- effects --------------------------- */

  useEffect(() => {
    setMeta(readJSON<MetaMap>(META_KEY, {}))
    setState(readJSON<StateMap>(STATE_KEY, {}))
    setStats(readJSON<StatsMap>(STATS_KEY, {}))
  }, [])

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Esc closes topmost overlay
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (previewId) {
        setPreviewId(null)
        return
      }
      if (detailId) {
        setDetailId(null)
        return
      }
      if (formOpen) {
        setFormOpen(false)
        return
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewId, detailId, formOpen])

  /* ---------------------------- derived -------------------------- */

  const anomaliesByCode = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const p of promos) {
      map.set(
        p.code,
        computeAnomalies(p, meta[p.code], state[p.code], stats[p.code]),
      )
    }
    return map
  }, [promos, meta, state, stats])

  const flaggedCodes = useMemo(() => {
    const s = new Set<string>()
    for (const [code, list] of anomaliesByCode) if (list.length > 0) s.add(code)
    return s
  }, [anomaliesByCode])

  const tabFiltered = useMemo(() => {
    let list = [...promos]
    switch (tab) {
      case 'live':
        list = list.filter((p) => isLive(p, meta[p.code], state[p.code]))
        break
      case 'scheduled':
        list = list.filter((p) => isScheduled(p, meta[p.code]))
        break
      case 'expiring':
        list = list.filter((p) => isExpiringSoon(p))
        break
      case 'expired':
        list = list.filter((p) => isExpired(p))
        break
      case 'paused':
        list = list.filter((p) => state[p.code]?.paused)
        break
      case 'top':
        list = list
          .slice()
          .sort(
            (a, b) =>
              (stats[b.code]?.redemptions ?? 0) -
              (stats[a.code]?.redemptions ?? 0),
          )
        break
      case 'issues':
        list = list.filter((p) => flaggedCodes.has(p.code))
        break
      default:
        break
    }

    const q = searchQuery.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          (meta[p.code]?.campaignName ?? '').toLowerCase().includes(q) ||
          (meta[p.code]?.description ?? '').toLowerCase().includes(q),
      )
    }

    return list
  }, [promos, tab, meta, state, stats, flaggedCodes, searchQuery])

  const counts = useMemo(() => {
    const out: Record<TabKey, number> = {
      all: promos.length,
      live: 0,
      scheduled: 0,
      expiring: 0,
      expired: 0,
      paused: 0,
      top: 0,
      issues: flaggedCodes.size,
    }
    for (const p of promos) {
      if (isLive(p, meta[p.code], state[p.code])) out.live += 1
      if (isScheduled(p, meta[p.code])) out.scheduled += 1
      if (isExpiringSoon(p)) out.expiring += 1
      if (isExpired(p)) out.expired += 1
      if (state[p.code]?.paused) out.paused += 1
    }
    out.top = promos.filter((p) => (stats[p.code]?.redemptions ?? 0) > 0).length
    return out
  }, [promos, meta, state, stats, flaggedCodes])

  const stats_totals = useMemo(() => {
    let totalRedemptions = 0
    let totalDiscount = 0
    let uniqueRiders = 0
    for (const p of promos) {
      const s = stats[p.code]
      if (!s) continue
      totalRedemptions += s.redemptions
      totalDiscount += s.totalDiscount
      uniqueRiders += s.uniqueRiders
    }
    const avgDiscount =
      totalRedemptions > 0 ? Math.round(totalDiscount / totalRedemptions) : 0
    const bestCode =
      promos
        .slice()
        .sort(
          (a, b) =>
            (stats[b.code]?.redemptions ?? 0) - (stats[a.code]?.redemptions ?? 0),
        )[0]?.code ?? null
    return {
      totalRedemptions,
      totalDiscount,
      uniqueRiders,
      avgDiscount,
      bestCode,
    }
  }, [promos, stats])

  const detail = useMemo(
    () => (detailId ? promos.find((p) => p.code === detailId) ?? null : null),
    [promos, detailId],
  )

  const preview = useMemo(
    () => (previewId ? promos.find((p) => p.code === previewId) ?? null : null),
    [promos, previewId],
  )

  /* --------------------------- handlers -------------------------- */

  const persistMeta = useCallback((next: MetaMap) => {
    setMeta(next)
    writeJSON(META_KEY, next)
  }, [])

  const persistState = useCallback((next: StateMap) => {
    setState(next)
    writeJSON(STATE_KEY, next)
  }, [])

  const persistStats = useCallback((next: StatsMap) => {
    setStats(next)
    writeJSON(STATS_KEY, next)
  }, [])

  const handleCreate = async (input: {
    code: string
    type: PromotionType
    value: number
    active: boolean
    expiresAt?: string
    meta: PromotionMeta
  }) => {
    if (!input.code.trim() || !input.value) {
      toast.error('Missing fields', 'Code and value are required.')
      return
    }
    const num = Number(input.value)
    if (isNaN(num) || num <= 0) {
      toast.error('Invalid value', 'Must be a positive number.')
      return
    }
    if (input.type === 'percent' && num > 100) {
      toast.error('Invalid percentage', 'Percentage cannot exceed 100.')
      return
    }

    const code = input.code.trim().toUpperCase()
    try {
      await create.mutateAsync({
        code,
        type: input.type,
        value: num,
        active: input.active,
        expiresAt: input.expiresAt
          ? new Date(input.expiresAt).toISOString()
          : undefined,
      })

      persistMeta({ ...meta, [code]: input.meta })
      persistStats({
        ...stats,
        [code]: stats[code] ?? {
          redemptions: 0,
          uniqueRiders: 0,
          totalDiscount: 0,
        },
      })

      toast.success(
        'Promotion created',
        `${code} is live on Rider and Driver apps.`,
      )
      setFormOpen(false)
      setFormPrefill(null)
      await refetch()
    } catch (e) {
      toast.error('Create failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await del.mutateAsync(deleteTarget.id)
      const nextMeta = { ...meta }
      const nextState = { ...state }
      const nextStats = { ...stats }
      delete nextMeta[deleteTarget.code]
      delete nextState[deleteTarget.code]
      delete nextStats[deleteTarget.code]
      persistMeta(nextMeta)
      persistState(nextState)
      persistStats(nextStats)
      toast.success('Promotion deleted', `${deleteTarget.code} removed.`)
      setDeleteTarget(null)
      if (detailId === deleteTarget.code) setDetailId(null)
    } catch (e) {
      toast.error('Delete failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleTogglePause = (p: Promotion) => {
    const current = state[p.code]?.paused ?? false
    const next = { ...state, [p.code]: { paused: !current } }
    persistState(next)
    toast.success(
      current ? 'Promotion resumed' : 'Promotion paused',
      `${p.code} ${current ? 'is live again' : 'is now hidden from apps'}.`,
    )
  }

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCode(code)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(
        () => setCopiedCode(null),
        1400,
      )
      toast.success('Code copied', code)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }

  const handleDuplicate = (p: Promotion) => {
    setFormPrefill(p)
    setFormOpen(true)
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleSimulateRedemption = (code: string) => {
    const current = stats[code] ?? {
      redemptions: 0,
      uniqueRiders: 0,
      totalDiscount: 0,
    }
    const p = promos.find((x) => x.code === code)
    const discountAmount =
      p && p.type === 'fixed' ? p.value : Math.round(2000 * ((p?.value ?? 10) / 100))
    persistStats({
      ...stats,
      [code]: {
        redemptions: current.redemptions + 1,
        uniqueRiders: current.uniqueRiders + 1,
        totalDiscount: current.totalDiscount + discountAmount,
        lastRedeemedAt: new Date().toISOString(),
      },
    })
    toast.success('Simulated redemption', `+${formatNaira(discountAmount)} discount applied.`)
  }

  const handleExportCSV = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No promotions match the current view.')
      return
    }
    const headers = [
      'code', 'type', 'value', 'active', 'expiresAt',
      'status', 'redemptions', 'totalDiscount', 'campaignName',
    ]
    const lines = [headers.join(',')]
    for (const p of rows) {
      const st = stats[p.code]
      const live = isLive(p, meta[p.code], state[p.code])
      lines.push(
        [
          p.code,
          p.type,
          String(p.value),
          String(p.active),
          p.expiresAt ?? '',
          live ? 'live' : state[p.code]?.paused ? 'paused' : isExpired(p) ? 'expired' : 'inactive',
          String(st?.redemptions ?? 0),
          String(st?.totalDiscount ?? 0),
          meta[p.code]?.campaignName ?? '',
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success('CSV exported', `${rows.length} codes downloaded.`)
  }, [tabFiltered, meta, state, stats])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No promotions match the current view.')
      return
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      totals: stats_totals,
      promotions: rows.map((p) => ({
        ...p,
        meta: meta[p.code] ?? {},
        state: state[p.code] ?? {},
        stats: stats[p.code] ?? {},
        status: isLive(p, meta[p.code], state[p.code])
          ? 'live'
          : state[p.code]?.paused
            ? 'paused'
            : isExpired(p)
              ? 'expired'
              : 'inactive',
        anomalies: anomaliesByCode.get(p.code) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success('JSON exported', `${rows.length} codes downloaded.`)
  }, [tabFiltered, tab, stats_totals, meta, state, stats, anomaliesByCode])

  /* ---------------------------- error state ---------------------- */

  if (isError) {
    return (
      <AppShell title="Promotions">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load promotions"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render --------------------------- */

  return (
    <AppShell title="Promotions">
      <style>{ANIMATIONS}</style>

      {/* Live banner — critical UX for both-apps impact */}
      <div className="pp-fade-up mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald/30 bg-emerald-light px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald text-white">
            <Zap size={16} aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-bold text-emerald-dark">
              Changes go live instantly
            </div>
            <div className="text-[11px] text-emerald-dark/80 flex items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <User size={10} aria-hidden="true" />
                Rider app
              </span>
              <span className="inline-flex items-center gap-1">
                <Gift size={10} aria-hidden="true" />
                Driver app
              </span>
              <span className="text-emerald-dark/50">·</span>
              <span>
                {counts.live} {counts.live === 1 ? 'code is' : 'codes are'} currently visible to users
              </span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="pp-shimmer inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
        >
          <Plus size={12} aria-hidden="true" />
          New promotion
        </button>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 pp-stagger">
        <KpiCard
          icon={<Gift size={14} aria-hidden="true" />}
          tone="slate"
          label="Total codes"
          value={String(promos.length)}
          hint={`${counts.live} live · ${counts.paused} paused`}
        />
        <KpiCard
          icon={<Play size={14} aria-hidden="true" />}
          tone="emerald"
          label="Live"
          value={String(counts.live)}
          hint="Visible in apps"
        />
        <KpiCard
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone={counts.expiring > 0 ? 'amber' : 'slate'}
          label="Expiring soon"
          value={String(counts.expiring)}
          hint={`Within ${EXPIRING_SOON_DAYS} days`}
        />
        <KpiCard
          icon={<Sparkles size={14} aria-hidden="true" />}
          tone="sky"
          label="Redemptions"
          value={stats_totals.totalRedemptions.toLocaleString()}
          hint={`${stats_totals.uniqueRiders} unique riders`}
        />
        <KpiCard
          icon={<TrendingUp size={14} aria-hidden="true" />}
          tone="amber"
          label="Discount given"
          value={formatCompactNaira(stats_totals.totalDiscount)}
          hint={`Avg ${formatNaira(stats_totals.avgDiscount)}`}
        />
        <KpiCard
          icon={<Star size={14} aria-hidden="true" />}
          tone="emerald"
          label="Top performer"
          value={stats_totals.bestCode ?? '—'}
          hint={
            stats_totals.bestCode
              ? `${stats[stats_totals.bestCode]?.redemptions ?? 0} redemptions`
              : 'No data yet'
          }
        />
      </div>

      {/* Tabs + search + actions */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 pp-fade-up">
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
                      'pp-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'expiring'
                          ? 'bg-amber-100 text-amber-700'
                          : key === 'issues'
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
          <div className="relative">
            <Search
              size={12}
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
              aria-hidden="true"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or name…"
              className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
            />
          </div>
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
            title="Export CSV"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            title="Export JSON"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-surface border border-border p-4">
              <Skeleton className="h-4 w-40 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      ) : tabFiltered.length === 0 ? (
        <div className="rounded-xl bg-surface border border-border">
          <EmptyState
            icon={Tag}
            title={
              searchQuery
                ? 'No matches'
                : tab === 'all'
                  ? 'No promotions yet'
                  : `No ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}`
            }
            description={
              searchQuery
                ? 'Try a different search term.'
                : tab === 'all'
                  ? 'Create your first promo code to offer discounts to riders.'
                  : 'Try another tab or clear the search.'
            }
            action={
              tab === 'all' && !searchQuery ? (
                <button
                  type="button"
                  onClick={() => setFormOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
                >
                  <Plus size={12} aria-hidden="true" />
                  New promotion
                </button>
              ) : null
            }
          />
        </div>
      ) : (
        <div className="space-y-2">
          {tabFiltered.map((p) => (
            <PromoCard
              key={p.code}
              promo={p}
              meta={meta[p.code]}
              state={state[p.code]}
              stats={stats[p.code]}
              anomalies={anomaliesByCode.get(p.code) ?? []}
              copiedCode={copiedCode}
              onCopyCode={handleCopyCode}
              onTogglePause={handleTogglePause}
              onDuplicate={handleDuplicate}
              onDelete={() => setDeleteTarget(p)}
              onView={() => setDetailId(p.code)}
              onPreview={() => setPreviewId(p.code)}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {formOpen ? (
        <CreatePromoModal
          onClose={() => {
            setFormOpen(false)
            setFormPrefill(null)
          }}
          onSubmit={handleCreate}
          loading={create.isPending}
          prefill={formPrefill}
          existingCodes={promos.map((p) => p.code)}
        />
      ) : null}

      {/* Detail drawer */}
      {detail ? (
        <PromoDetailDrawer
          promo={detail}
          meta={meta[detail.code]}
          state={state[detail.code]}
          stats={stats[detail.code]}
          anomalies={anomaliesByCode.get(detail.code) ?? []}
          onClose={() => setDetailId(null)}
          onPreview={() => setPreviewId(detail.code)}
          onSimulateRedemption={() => handleSimulateRedemption(detail.code)}
          onTogglePause={() => handleTogglePause(detail)}
          onDuplicate={() => {
            setDetailId(null)
            handleDuplicate(detail)
          }}
          onDelete={() => {
            setDetailId(null)
            setDeleteTarget(detail)
          }}
        />
      ) : null}

      {/* Live preview modal */}
      {preview ? (
        <PromoPreviewModal
          promo={preview}
          meta={meta[preview.code]}
          onClose={() => setPreviewId(null)}
        />
      ) : null}

      {/* Confirm delete (preserved) */}
      <ConfirmModal
        open={deleteTarget !== null}
        title={`Delete ${deleteTarget?.code ?? ''}?`}
        description="This will remove the promo code. Riders won't be able to use it."
        confirmLabel="Delete"
        variant="danger"
        loading={del.isPending}
        onConfirm={handleDelete}
        onClose={() => (del.isPending ? null : setDeleteTarget(null))}
      />
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

function PromoCard({
  promo,
  meta,
  state,
  stats,
  anomalies,
  copiedCode,
  onCopyCode,
  onTogglePause,
  onDuplicate,
  onDelete,
  onView,
  onPreview,
}: {
  promo: Promotion
  meta: PromotionMeta | undefined
  state: PromotionState | undefined
  stats: PromotionStats | undefined
  anomalies: Anomaly[]
  copiedCode: string | null
  onCopyCode: (code: string) => void
  onTogglePause: (p: Promotion) => void
  onDuplicate: (p: Promotion) => void
  onDelete: () => void
  onView: () => void
  onPreview: () => void
}) {
  const live = isLive(promo, meta, state)
  const paused = state?.paused ?? false
  const expired = isExpired(promo)
  const scheduled = isScheduled(promo, meta)
  const used = stats?.redemptions ?? 0
  const limit = meta?.usageLimit
  const usagePct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : null
  const expiryDays = daysUntil(promo.expiresAt)

  const statusLabel = live
    ? 'Live'
    : paused
      ? 'Paused'
      : expired
        ? 'Expired'
        : scheduled
          ? 'Scheduled'
          : 'Inactive'

  const statusTone: 'success' | 'warning' | 'danger' | 'neutral' | 'info' = live
    ? 'success'
    : paused
      ? 'warning'
      : expired
        ? 'neutral'
        : scheduled
          ? 'info'
          : 'neutral'

  return (
    <div
      className="group rounded-xl bg-surface border border-border p-4 transition-all hover:border-border-strong hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-lg flex-shrink-0 ${
            live
              ? 'bg-emerald-light text-emerald'
              : paused
                ? 'bg-amber-50 text-amber-700'
                : expired
                  ? 'bg-surface-alt text-ink-muted'
                  : 'bg-sky-50 text-sky-700'
          }`}
        >
          {promo.type === 'percent' ? (
            <Percent size={16} aria-hidden="true" />
          ) : (
            <Tag size={16} aria-hidden="true" />
          )}
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => onCopyCode(promo.code)}
              className="font-mono text-sm font-bold text-ink hover:text-emerald transition-colors inline-flex items-center gap-1"
              title="Click to copy"
            >
              {promo.code}
              {copiedCode === promo.code ? (
                <Check size={11} className="text-emerald" aria-hidden="true" />
              ) : (
                <ClipboardCopy size={11} className="opacity-0 group-hover:opacity-60" aria-hidden="true" />
              )}
            </button>
            <StatusBadge status={statusTone}>{statusLabel}</StatusBadge>
            {meta?.campaignName ? (
              <span className="text-[11px] text-ink-muted truncate">
                · {meta.campaignName}
              </span>
            ) : null}
            {anomalies.length > 0 ? (
              <span
                title={anomalies.map((a) => a.label).join(' · ')}
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                  ANOMALY_STYLES[
                    anomalies.reduce((a, b) =>
                      ANOMALY_ORDER[a.severity] >= ANOMALY_ORDER[b.severity] ? a : b,
                    ).severity
                  ].bg
                } ${
                  ANOMALY_STYLES[
                    anomalies.reduce((a, b) =>
                      ANOMALY_ORDER[a.severity] >= ANOMALY_ORDER[b.severity] ? a : b,
                    ).severity
                  ].text
                }`}
              >
                <AlertTriangle size={8} aria-hidden="true" />
                {anomalies.length} flag{anomalies.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </div>

          <div className="text-xs text-ink-secondary mb-2">
            <span className="font-semibold text-ink">{valueLabel(promo)}</span>
            {meta?.minFare ? (
              <span className="text-ink-muted">
                {' '}
                · Min {formatNaira(meta.minFare)}
              </span>
            ) : null}
            {meta?.maxDiscount ? (
              <span className="text-ink-muted">
                {' '}
                · Cap {formatNaira(meta.maxDiscount)}
              </span>
            ) : null}
            <span className="text-ink-muted">
              {' '}
              · {formatExpiry(promo.expiresAt)}
            </span>
          </div>

          {/* Usage bar */}
          {limit ? (
            <div className="mb-2">
              <div className="mb-1 flex items-center justify-between text-[10px] text-ink-muted">
                <span>
                  Used <strong className="text-ink">{used}</strong> / {limit}
                </span>
                <span className="tabular-nums">{Math.round(usagePct ?? 0)}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className={`pp-bar h-full rounded-full ${
                    (usagePct ?? 0) >= 90
                      ? 'bg-red-500'
                      : (usagePct ?? 0) >= 60
                        ? 'bg-amber-500'
                        : 'bg-emerald'
                  }`}
                  style={{ width: `${usagePct ?? 0}%` }}
                />
              </div>
            </div>
          ) : used > 0 ? (
            <div className="mb-2 text-[10px] text-ink-muted">
              <strong className="text-ink">{used}</strong> redemptions ·{' '}
              {formatNaira(stats?.totalDiscount ?? 0)} given
            </div>
          ) : null}

          {/* Expiry / app pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {expiryDays !== null && expiryDays >= 0 && expiryDays <= EXPIRING_SOON_DAYS ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700">
                <Timer size={9} aria-hidden="true" />
                {expiryDays === 0
                  ? 'Expires today'
                  : expiryDays === 1
                    ? 'Expires tomorrow'
                    : `${expiryDays}d left`}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-alt px-1.5 py-0.5 text-[9px] font-medium text-ink-muted">
              <User size={9} aria-hidden="true" />
              Rider
            </span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-surface-alt px-1.5 py-0.5 text-[9px] font-medium text-ink-muted">
              <Gift size={9} aria-hidden="true" />
              Driver
            </span>
            {meta?.stackable ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">
                <Layers size={9} aria-hidden="true" />
                Stackable
              </span>
            ) : null}
            {meta?.autoApply ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-light px-1.5 py-0.5 text-[9px] font-semibold text-emerald-dark">
                <Sparkles size={9} aria-hidden="true" />
                Auto-apply
              </span>
            ) : null}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            type="button"
            onClick={onPreview}
            className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
            aria-label="Preview in apps"
            title="Preview"
          >
            <Eye size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onTogglePause(promo)}
            disabled={expired}
            className={`p-1.5 rounded-lg transition-colors disabled:opacity-40 ${
              paused
                ? 'hover:bg-emerald-light text-emerald'
                : 'hover:bg-amber-50 text-amber-600'
            }`}
            aria-label={paused ? 'Resume' : 'Pause'}
            title={paused ? 'Resume' : 'Pause'}
          >
            {paused ? (
              <Play size={15} aria-hidden="true" />
            ) : (
              <Pause size={15} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={onView}
            className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
            aria-label="View details"
            title="Details"
          >
            <Info size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(promo)}
            className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
            aria-label="Duplicate"
            title="Duplicate"
          >
            <Copy size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-50 text-ink-muted hover:text-danger transition-colors"
            aria-label={`Delete ${promo.code}`}
            title="Delete"
          >
            <Trash2 size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}

function CreatePromoModal({
  onClose,
  onSubmit,
  loading,
  prefill,
  existingCodes,
}: {
  onClose: () => void
  onSubmit: (input: {
    code: string
    type: PromotionType
    value: number
    active: boolean
    expiresAt?: string
    meta: PromotionMeta
  }) => Promise<void>
  loading: boolean
  prefill: Promotion | null
  existingCodes: string[]
}) {
  const [code, setCode] = useState(prefill?.code ? `${prefill.code}-V2` : '')
  const [type, setType] = useState<PromotionType>(prefill?.type ?? 'percent')
  const [value, setValue] = useState(prefill?.value ? String(prefill.value) : '')
  const [expiresAt, setExpiresAt] = useState(
    prefill?.expiresAt
      ? new Date(prefill.expiresAt).toISOString().slice(0, 10)
      : '',
  )
  const [active, setActive] = useState(prefill?.active ?? true)

  const [campaignName, setCampaignName] = useState('')
  const [description, setDescription] = useState('')
  const [maxDiscount, setMaxDiscount] = useState('')
  const [minFare, setMinFare] = useState('')
  const [usageLimit, setUsageLimit] = useState('')
  const [perRiderLimit, setPerRiderLimit] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [stackable, setStackable] = useState(false)
  const [autoApply, setAutoApply] = useState(false)

  const [advancedOpen, setAdvancedOpen] = useState(false)

  const numericValue = Number(value)
  const codeError =
    code.trim() &&
    existingCodes.includes(code.trim().toUpperCase())
      ? 'Code already exists'
      : null

  const canSubmit =
    code.trim().length > 0 &&
    numericValue > 0 &&
    (type !== 'percent' || numericValue <= 100) &&
    !codeError

  const handleGenerate = () => {
    const prefix = campaignName
      ? campaignName.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 6)
      : 'PROMO'
    setCode(generateCode(prefix))
  }

  return (
    <div
      className="pp-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-promo-title"
      onClick={onClose}
    >
      <div
        className="pp-pop w-full max-w-3xl rounded-xl border border-border bg-surface shadow-2xl my-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="create-promo-title" className="text-sm font-bold text-ink">
              {prefill ? 'Duplicate promotion' : 'Create promotion'}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted flex items-center gap-1.5">
              <Zap size={10} className="text-emerald" aria-hidden="true" />
              Will appear on Rider + Driver apps immediately when active
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

        <div className="max-h-[70vh] overflow-y-auto p-5 space-y-4">
          {/* Basic */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Basic
              </div>
              <label className="flex items-center gap-1.5 text-[11px] text-ink-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border accent-emerald"
                />
                Active immediately
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                  Code
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-mono text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
                  />
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-2 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                    title="Auto-generate"
                  >
                    <Sparkles size={11} aria-hidden="true" />
                    Generate
                  </button>
                </div>
                {codeError ? (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-danger">
                    <AlertCircle size={10} aria-hidden="true" />
                    {codeError}
                  </p>
                ) : null}
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                  Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as PromotionType)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                >
                  <option value="percent">Percent off</option>
                  <option value="fixed">Fixed ₦ off</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                  Value {type === 'percent' ? '(%)' : '(₦)'}
                </label>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={type === 'percent' ? '10' : '500'}
                  min={0}
                  max={type === 'percent' ? 100 : undefined}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                  Expires on (optional)
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Advanced toggle */}
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-alt/40 px-3 py-2 text-xs font-semibold text-ink-secondary hover:bg-surface-alt transition-colors"
          >
            <span className="flex items-center gap-2">
              <Layers size={12} aria-hidden="true" />
              Advanced options
            </span>
            <span className="text-[10px] text-ink-muted">
              {advancedOpen ? 'Hide' : 'Show'}
            </span>
          </button>

          {advancedOpen ? (
            <div className="space-y-4 pp-fade-up">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                    Campaign name (internal)
                  </label>
                  <input
                    type="text"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. New Year 2026"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                    Description (shown to users)
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Get 10% off your next 3 rides"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                  />
                </div>

                {type === 'percent' ? (
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                      Max discount cap (₦)
                    </label>
                    <input
                      type="number"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                      placeholder="e.g. 2000"
                      className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                    Min ride fare (₦)
                  </label>
                  <input
                    type="number"
                    value={minFare}
                    onChange={(e) => setMinFare(e.target.value)}
                    placeholder="e.g. 1000"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                    Total uses limit
                  </label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    placeholder="e.g. 500"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                    Per-rider limit
                  </label>
                  <input
                    type="number"
                    value={perRiderLimit}
                    onChange={(e) => setPerRiderLimit(e.target.value)}
                    placeholder="e.g. 1"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[10px] uppercase tracking-wide text-ink-secondary mb-1.5 font-semibold">
                    Start date (optional)
                  </label>
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2.5 cursor-pointer hover:border-emerald/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={stackable}
                    onChange={(e) => setStackable(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-emerald"
                  />
                  <div>
                    <div className="text-xs font-semibold text-ink">Stackable</div>
                    <div className="text-[10px] text-ink-muted">
                      Can be combined with other promo codes
                    </div>
                  </div>
                </label>

                <label className="flex items-start gap-2 rounded-lg border border-border bg-surface p-2.5 cursor-pointer hover:border-emerald/40 transition-colors">
                  <input
                    type="checkbox"
                    checked={autoApply}
                    onChange={(e) => setAutoApply(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-emerald"
                  />
                  <div>
                    <div className="text-xs font-semibold text-ink">Auto-apply</div>
                    <div className="text-[10px] text-ink-muted">
                      Automatically applied to eligible rides (no code entry needed)
                    </div>
                  </div>
                </label>
              </div>
            </div>
          ) : null}

          {/* Live preview */}
          {code && value && numericValue > 0 ? (
            <div className="rounded-lg border border-emerald/30 bg-emerald-light/40 p-3">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-dark/80">
                Preview — how riders will see it
              </div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald">
                  <Gift size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-emerald-dark truncate">
                    {description || `${valueLabel({ type, value: numericValue } as Promotion)} on your next ride`}
                  </div>
                  <div className="text-[11px] text-emerald-dark/70 font-mono">
                    {code}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <div className="text-[10px] text-ink-muted">
            ⚡ Live on Rider + Driver apps
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (!canSubmit) return
                onSubmit({
                  code: code.trim().toUpperCase(),
                  type,
                  value: numericValue,
                  active,
                  expiresAt: expiresAt || undefined,
                  meta: {
                    campaignName: campaignName.trim() || undefined,
                    description: description.trim() || undefined,
                    maxDiscount: maxDiscount ? Number(maxDiscount) : undefined,
                    minFare: minFare ? Number(minFare) : undefined,
                    usageLimit: usageLimit ? Number(usageLimit) : undefined,
                    perRiderLimit: perRiderLimit ? Number(perRiderLimit) : undefined,
                    startsAt: startsAt || undefined,
                    stackable,
                    autoApply,
                  },
                })
              }}
              disabled={loading || !canSubmit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : (
                <Plus size={12} aria-hidden="true" />
              )}
              {loading ? 'Creating…' : 'Create & publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromoDetailDrawer({
  promo,
  meta,
  state,
  stats,
  anomalies,
  onClose,
  onPreview,
  onSimulateRedemption,
  onTogglePause,
  onDuplicate,
  onDelete,
}: {
  promo: Promotion
  meta: PromotionMeta | undefined
  state: PromotionState | undefined
  stats: PromotionStats | undefined
  anomalies: Anomaly[]
  onClose: () => void
  onPreview: () => void
  onSimulateRedemption: () => void
  onTogglePause: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const live = isLive(promo, meta, state)
  const paused = state?.paused ?? false
  const statusLabel = live
    ? 'Live'
    : paused
      ? 'Paused'
      : isExpired(promo)
        ? 'Expired'
        : isScheduled(promo, meta)
          ? 'Scheduled'
          : 'Inactive'

  return (
    <div
      className="pp-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Promotion details"
      onClick={onClose}
    >
      <div
        className="pp-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-ink truncate">
                {promo.code}
              </span>
              <StatusBadge
                status={
                  live
                    ? 'success'
                    : paused
                      ? 'warning'
                      : isExpired(promo)
                        ? 'neutral'
                        : 'info'
                }
              >
                {statusLabel}
              </StatusBadge>
            </div>
            {meta?.campaignName ? (
              <p className="mt-0.5 text-[11px] text-ink-muted truncate">
                {meta.campaignName}
              </p>
            ) : null}
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
          {/* Value big display */}
          <div className="rounded-xl border border-border bg-surface-alt/40 p-4 text-center">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted mb-1">
              Discount
            </div>
            <div className="text-3xl font-bold text-ink tabular-nums">
              {valueLabel(promo)}
            </div>
            {meta?.description ? (
              <div className="mt-1 text-[11px] text-ink-muted">
                {meta.description}
              </div>
            ) : null}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <DetailField
              label="Redemptions"
              value={String(stats?.redemptions ?? 0)}
            />
            <DetailField
              label="Unique riders"
              value={String(stats?.uniqueRiders ?? 0)}
            />
            <DetailField
              label="Total discount"
              value={formatNaira(stats?.totalDiscount ?? 0)}
            />
            <DetailField
              label="Last used"
              value={
                stats?.lastRedeemedAt
                  ? new Date(stats.lastRedeemedAt).toLocaleDateString()
                  : '—'
              }
            />
          </div>

          {/* Config */}
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <Gauge size={11} aria-hidden="true" />
              Configuration
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-3 text-[11px]">
              <ConfigRow label="Type" value={promo.type === 'percent' ? 'Percent' : 'Fixed'} />
              <ConfigRow
                label="Value"
                value={promo.type === 'percent' ? `${promo.value}%` : formatNaira(promo.value)}
              />
              <ConfigRow
                label="Expires"
                value={formatExpiry(promo.expiresAt)}
              />
              <ConfigRow
                label="Starts"
                value={
                  meta?.startsAt
                    ? new Date(meta.startsAt).toLocaleDateString()
                    : 'Immediately'
                }
              />
              {meta?.usageLimit ? (
                <ConfigRow label="Usage limit" value={String(meta.usageLimit)} />
              ) : null}
              {meta?.perRiderLimit ? (
                <ConfigRow label="Per rider" value={String(meta.perRiderLimit)} />
              ) : null}
              {meta?.maxDiscount ? (
                <ConfigRow
                  label="Max discount"
                  value={formatNaira(meta.maxDiscount)}
                />
              ) : null}
              {meta?.minFare ? (
                <ConfigRow label="Min fare" value={formatNaira(meta.minFare)} />
              ) : null}
              <ConfigRow label="Stackable" value={meta?.stackable ? 'Yes' : 'No'} />
              <ConfigRow
                label="Auto-apply"
                value={meta?.autoApply ? 'Yes' : 'No'}
              />
            </div>
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 ? (
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                <Flag size={11} aria-hidden="true" />
                Flags
              </div>
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
            </div>
          ) : (
            <div className="rounded-md border border-emerald/20 bg-emerald-light/40 px-2.5 py-1.5 text-[11px] text-emerald-dark">
              No issues detected.
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onPreview}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:text-ink transition-colors"
            >
              <Eye size={11} aria-hidden="true" />
              Preview
            </button>
            <button
              type="button"
              onClick={onSimulateRedemption}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:text-ink transition-colors"
            >
              <Sparkles size={11} aria-hidden="true" />
              Test use
            </button>
            <button
              type="button"
              onClick={onTogglePause}
              disabled={isExpired(promo)}
              className={`flex-1 inline-flex items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-40 ${
                paused
                  ? 'bg-emerald text-white hover:bg-emerald-dark'
                  : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {paused ? (
                <Play size={11} aria-hidden="true" />
              ) : (
                <Pause size={11} aria-hidden="true" />
              )}
              {paused ? 'Resume' : 'Pause'}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onDuplicate}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:text-ink transition-colors"
            >
              <Copy size={11} aria-hidden="true" />
              Duplicate
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-red-100 transition-colors"
            >
              <Trash2 size={11} aria-hidden="true" />
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function PromoPreviewModal({
  promo,
  meta,
  onClose,
}: {
  promo: Promotion
  meta: PromotionMeta | undefined
  onClose: () => void
}) {
  const [screen, setScreen] = useState<'rider' | 'driver'>('rider')

  return (
    <div
      className="pp-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      onClick={onClose}
    >
      <div
        className="pp-pop w-full max-w-4xl rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 id="preview-title" className="text-sm font-bold text-ink">
              Live preview — {promo.code}
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              This is how the promotion appears in each app
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

        <div className="border-b border-border px-5 py-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setScreen('rider')}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                screen === 'rider'
                  ? 'border-emerald bg-emerald text-white'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50'
              }`}
            >
              <User size={11} aria-hidden="true" />
              Rider app
            </button>
            <button
              type="button"
              onClick={() => setScreen('driver')}
              className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                screen === 'driver'
                  ? 'border-emerald bg-emerald text-white'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50'
              }`}
            >
              <Gift size={11} aria-hidden="true" />
              Driver app
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-2">
          {/* Phone mockup */}
          <div className="flex justify-center">
            <div className="relative rounded-[2.5rem] border-[8px] border-navy bg-canvas p-2 w-full max-w-[280px]">
              <div className="rounded-[2rem] bg-gradient-to-b from-canvas to-surface min-h-[420px] p-3 flex flex-col">
                {/* Status bar */}
                <div className="flex items-center justify-between text-[9px] text-ink-muted mb-3 px-1">
                  <span>9:41</span>
                  <span className="font-semibold">
                    {screen === 'rider' ? 'Rider' : 'Driver'}
                  </span>
                </div>

                {/* App content */}
                {screen === 'rider' ? (
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] text-ink-muted">Rewards</div>
                    <div className="rounded-xl bg-white border border-border p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald text-white flex-shrink-0">
                          <Gift size={16} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-ink leading-tight">
                            {meta?.description ||
                              `${valueLabel(promo)} on your next ride`}
                          </div>
                          <div className="mt-1 inline-flex items-center gap-1 rounded bg-emerald-light px-1.5 py-0.5 text-[9px] font-bold text-emerald-dark font-mono">
                            {promo.code}
                          </div>
                        </div>
                      </div>
                      {meta?.minFare ? (
                        <div className="mt-2 text-[9px] text-ink-muted border-t border-border pt-1.5">
                          Min ride fare {formatNaira(meta.minFare)}
                        </div>
                      ) : null}
                      {promo.expiresAt ? (
                        <div className="mt-0.5 text-[9px] text-amber-600">
                          {formatExpiry(promo.expiresAt)}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-[9px] text-ink-muted px-1 mt-2">
                      Available to you
                    </div>
                    <div className="rounded-lg bg-surface-alt/60 p-2 flex items-center gap-2">
                      <div className="h-7 w-7 rounded bg-surface-alt flex items-center justify-center">
                        <Tag size={12} className="text-ink-muted" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-medium text-ink truncate">
                          Bonus loyalty rewards
                        </div>
                        <div className="text-[9px] text-ink-muted">
                          Complete 5 rides
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col gap-2">
                    <div className="text-[10px] text-ink-muted">Offers</div>
                    <div className="rounded-xl bg-white border border-border p-3 shadow-sm">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700 flex-shrink-0">
                          <Sparkles size={14} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold text-ink leading-tight">
                            Bonus for drivers
                          </div>
                          <div className="text-[9px] text-ink-muted">
                            {valueLabel(promo)} on qualifying trips
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 rounded bg-amber-50 px-1.5 py-0.5 inline-block text-[9px] font-bold text-amber-700 font-mono">
                        {promo.code}
                      </div>
                    </div>

                    <div className="text-[9px] text-ink-muted px-1 mt-2">
                      Active promotions
                    </div>
                    <div className="rounded-lg bg-surface-alt/60 p-2 flex items-center gap-2">
                      <div className="h-7 w-7 rounded bg-surface-alt flex items-center justify-center">
                        <Gauge size={12} className="text-ink-muted" aria-hidden="true" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-medium text-ink truncate">
                          Peak hour bonus
                        </div>
                        <div className="text-[9px] text-ink-muted">
                          +₦500 per trip · 6-9pm
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Explanation */}
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                <Info size={11} aria-hidden="true" />
                What riders/drivers see
              </div>
              <ul className="space-y-1 text-[11px] text-ink-secondary">
                <li className="flex items-start gap-1.5">
                  <Check size={10} className="text-emerald mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    <strong className="text-ink">{valueLabel(promo)}</strong>{' '}
                    {meta?.description ? `— ${meta.description}` : 'applied at checkout'}
                  </span>
                </li>
                {meta?.minFare ? (
                  <li className="flex items-start gap-1.5">
                    <Check size={10} className="text-emerald mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Requires minimum fare of{' '}
                      <strong className="text-ink">{formatNaira(meta.minFare)}</strong>
                    </span>
                  </li>
                ) : null}
                {meta?.maxDiscount ? (
                  <li className="flex items-start gap-1.5">
                    <Check size={10} className="text-emerald mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Maximum discount capped at{' '}
                      <strong className="text-ink">{formatNaira(meta.maxDiscount)}</strong>
                    </span>
                  </li>
                ) : null}
                {promo.expiresAt ? (
                  <li className="flex items-start gap-1.5">
                    <Timer size={10} className="text-amber-500 mt-0.5 shrink-0" aria-hidden="true" />
                    <span>{formatExpiry(promo.expiresAt)}</span>
                  </li>
                ) : (
                  <li className="flex items-start gap-1.5">
                    <Check size={10} className="text-emerald mt-0.5 shrink-0" aria-hidden="true" />
                    <span>No expiry</span>
                  </li>
                )}
                {meta?.perRiderLimit ? (
                  <li className="flex items-start gap-1.5">
                    <Check size={10} className="text-emerald mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      Usable up to{' '}
                      <strong className="text-ink">{meta.perRiderLimit}</strong>{' '}
                      time{meta.perRiderLimit === 1 ? '' : 's'} per person
                    </span>
                  </li>
                ) : null}
              </ul>
            </div>

            <div className="rounded-lg border border-emerald/30 bg-emerald-light/40 p-3 text-[11px] text-emerald-dark">
              <div className="flex items-start gap-1.5">
                <Zap size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  This promotion is <strong>visible</strong> on both apps.
                  Any changes here apply instantly — riders and drivers will
                  see the update immediately.
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
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

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="text-ink-muted">{label}</span>
      <span className="text-ink font-medium text-right truncate">{value}</span>
    </>
  )
}