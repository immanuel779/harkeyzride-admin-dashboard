import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileJson,
  History,
  Keyboard,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  Radio,
  RefreshCw,
  Search,
  ShieldCheck,
  Siren,
  TrendingUp,
  Timer,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { AlertDetail } from '../components/AlertDetail'
import { useAuth } from '../../../store/AuthContext'
import { toast } from '../../../lib/toast'
import {
  useAcknowledgeSos,
  useResolveSos,
  useSosAlerts,
} from '../../../hooks/queries/useSos'
import type { SosAlert } from '../data/mockAlerts'

/* ==========================================================================
   CONFIG
   ========================================================================== */

const SLA_WARNING_MIN = 2
const SLA_AGING_MIN = 5
const SLA_BREACH_MIN = 10
const AUTO_REFRESH_MS = 30_000

const SOUND_PREF_KEY = 'hr.sos.sound.v1'
const AUTOREFRESH_PREF_KEY = 'hr.sos.autorefresh.v1'
const NOTES_KEY = 'hr.sos.notes.v1'

type SlaTier = 'fresh' | 'aging' | 'warning' | 'breach' | 'resolved'

const SLA_STYLES: Record<
  SlaTier,
  { bg: string; text: string; label: string; dot: string }
> = {
  fresh: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Fresh', dot: 'bg-emerald-500' },
  aging: { bg: 'bg-sky-50', text: 'text-sky-700', label: 'Aging', dot: 'bg-sky-500' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Warning', dot: 'bg-amber-500' },
  breach: { bg: 'bg-red-100', text: 'text-danger', label: 'SLA Breach', dot: 'bg-red-500' },
  resolved: { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Resolved', dot: 'bg-slate-400' },
}

type TabKey = 'all' | 'open' | 'acknowledged' | 'resolved' | 'breach'
type SortKey = 'priority' | 'newest' | 'oldest' | 'severity'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'all', label: 'All alerts' },
  { key: 'open', label: 'Open' },
  { key: 'acknowledged', label: 'Acknowledged' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'breach', label: 'SLA breach' },
]

type EscalationOption = {
  id: string
  label: string
  number: string | null
  hint: string
  tone: 'danger' | 'warning' | 'info' | 'success'
}

const ESCALATION_OPTIONS: EscalationOption[] = [
  { id: 'police', label: 'Police', number: '112', hint: 'Notify police emergency response', tone: 'danger' },
  { id: 'ambulance', label: 'Ambulance', number: '112', hint: 'Request medical assistance', tone: 'danger' },
  { id: 'fire', label: 'Fire service', number: '112', hint: 'Fire and rescue services', tone: 'warning' },
  { id: 'frsc', label: 'FRSC', number: '122', hint: 'Federal Road Safety Corps', tone: 'info' },
  { id: 'supervisor', label: 'Ops supervisor', number: null, hint: 'Escalate to on-call manager', tone: 'success' },
]

type NoteEntry = {
  id: string
  body: string
  author: string
  at: string
}

type EscalationEntry = {
  id: string
  option: string
  at: string
  admin: string
}

type NotesMap = Record<string, NoteEntry[]>
type EscalationsMap = Record<string, EscalationEntry[]>

const ANIMATIONS = `
  @keyframes sos-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sos-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sos-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes sos-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes sos-ping {
    0% { transform: scale(1); opacity: .75; }
    80%, 100% { transform: scale(2.2); opacity: 0; }
  }
  @keyframes sos-slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes sos-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .sos-fade-up { animation: sos-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .sos-fade-in { animation: sos-fade-in .2s ease both; }
  .sos-pop { animation: sos-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .sos-pulse { animation: sos-pulse 1.5s ease-in-out infinite; }
  .sos-ping { animation: sos-ping 1.5s cubic-bezier(0,0,.2,1) infinite; }
  .sos-slide-down { animation: sos-slide-down .3s cubic-bezier(.22,1,.36,1) both; }
  .sos-shimmer { position: relative; overflow: hidden; }
  .sos-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .sos-shimmer:hover::after { animation: sos-shimmer 1s ease; }
  .sos-stagger > * { animation: sos-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .sos-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .sos-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .sos-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .sos-stagger > *:nth-child(4) { animation-delay: 180ms; }
  @media (prefers-reduced-motion: reduce) {
    .sos-fade-up, .sos-fade-in, .sos-pop, .sos-pulse, .sos-ping, .sos-slide-down,
    .sos-stagger > *, .sos-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function minutesBetween(a: string | Date, b: string | Date = new Date()): number {
  const start = typeof a === 'string' ? new Date(a) : a
  const end = typeof b === 'string' ? new Date(b) : b
  return (end.getTime() - start.getTime()) / 60_000
}

function formatDuration(mins: number): string {
  if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`
  if (mins < 60) return `${Math.floor(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.floor(mins % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function computeSla(alert: SosAlert): { tier: SlaTier; minutesOpen: number; label: string } {
  if (alert.status === 'resolved') return { tier: 'resolved', minutesOpen: 0, label: 'Resolved' }
  const mins = minutesBetween(alert.triggeredAt)
  if (mins < SLA_WARNING_MIN) return { tier: 'fresh', minutesOpen: mins, label: formatDuration(mins) }
  if (mins < SLA_AGING_MIN) return { tier: 'aging', minutesOpen: mins, label: formatDuration(mins) }
  if (mins < SLA_BREACH_MIN) return { tier: 'warning', minutesOpen: mins, label: formatDuration(mins) }
  return { tier: 'breach', minutesOpen: mins, label: formatDuration(mins) }
}

function isSlaBreached(alert: SosAlert): boolean {
  return alert.status !== 'resolved' && minutesBetween(alert.triggeredAt) >= SLA_BREACH_MIN
}

function readField<T>(alert: SosAlert, key: string): T | undefined {
  return (alert as unknown as Record<string, unknown>)[key] as T | undefined
}

function getRiderName(alert: SosAlert): string {
  return readField<string>(alert, 'riderName') ?? 'Unknown rider'
}
function getDriverName(alert: SosAlert): string {
  return readField<string>(alert, 'driverName') ?? '—'
}
function getLocation(alert: SosAlert): string {
  return readField<string>(alert, 'location') ?? '—'
}
function getSeverity(alert: SosAlert): string {
  return readField<string>(alert, 'severity') ?? 'medium'
}
function getAcknowledgedAt(alert: SosAlert): string | null {
  return readField<string>(alert, 'acknowledgedAt') ?? null
}
function getResolvedAt(alert: SosAlert): string | null {
  return readField<string>(alert, 'resolvedAt') ?? null
}

function sortAlerts(alerts: SosAlert[], key: SortKey): SosAlert[] {
  const byStatus: Record<string, number> = { open: 0, acknowledged: 1, resolved: 2 }
  const bySeverity: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  const sorted = [...alerts]
  switch (key) {
    case 'newest':
      return sorted.sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime())
    case 'oldest':
      return sorted.sort((a, b) => new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime())
    case 'severity':
      return sorted.sort((a, b) => {
        const sa = bySeverity[getSeverity(a)] ?? 9
        const sb = bySeverity[getSeverity(b)] ?? 9
        return sa - sb
      })
    case 'priority':
    default:
      return sorted.sort((a, b) => {
        const sa = byStatus[a.status] ?? 9
        const sb = byStatus[b.status] ?? 9
        if (sa !== sb) return sa - sb
        const sevA = bySeverity[getSeverity(a)] ?? 9
        const sevB = bySeverity[getSeverity(b)] ?? 9
        if (sevA !== sevB) return sevA - sevB
        return new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime()
      })
  }
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return (JSON.parse(raw) as T) ?? fallback
  } catch {
    return fallback
  }
}

function saveJSON<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

/* ==========================================================================
   HOOKS
   ========================================================================== */

function useLiveClock(): number {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function useAlertSound(enabled: boolean): () => void {
  const ctxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const prime = () => {
      try {
        if (!ctxRef.current) ctxRef.current = new AudioContext()
        if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
      } catch {
        /* ignore */
      }
    }
    document.addEventListener('click', prime, { once: true })
    document.addEventListener('keydown', prime, { once: true })
    return () => {
      document.removeEventListener('click', prime)
      document.removeEventListener('keydown', prime)
    }
  }, [])

  const play = useCallback(() => {
    if (!enabled) return
    try {
      if (!ctxRef.current) ctxRef.current = new AudioContext()
      const ctx = ctxRef.current
      if (ctx.state === 'suspended') void ctx.resume()
      const now = ctx.currentTime
      const tones = [880, 660, 880]
      tones.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        const start = now + i * 0.12
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.15, start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.15)
      })
    } catch {
      /* ignore */
    }
  }, [enabled])

  return play
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function SosPage() {
  const { user } = useAuth()
  const { data: alerts = [], isLoading, isError, error, refetch } = useSosAlerts()
  const acknowledge = useAcknowledgeSos()
  const resolve = useResolveSos()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<TabKey>('all')
  const [sortKey, setSortKey] = useState<SortKey>('priority')
  const [search, setSearch] = useState('')

  const [soundEnabled, setSoundEnabled] = useState(() => {
    const stored = loadJSON<boolean | null>(SOUND_PREF_KEY, null)
    return stored ?? true
  })
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(() => {
    const stored = loadJSON<boolean | null>(AUTOREFRESH_PREF_KEY, null)
    return stored ?? true
  })

  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [showEscalate, setShowEscalate] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  const [notes, setNotes] = useState<NotesMap>(() => loadJSON<NotesMap>(NOTES_KEY, {}))
  const [escalations, setEscalations] = useState<EscalationsMap>({})

  const previousIdsRef = useRef<Set<string>>(new Set())
  const searchRef = useRef<HTMLInputElement>(null)

  const now = useLiveClock()
  const playSound = useAlertSound(soundEnabled)

  /* ---------------------------- effects ---------------------------- */

  useEffect(() => {
    saveJSON(SOUND_PREF_KEY, soundEnabled)
  }, [soundEnabled])
  useEffect(() => {
    saveJSON(AUTOREFRESH_PREF_KEY, autoRefreshEnabled)
  }, [autoRefreshEnabled])

  useEffect(() => {
    if (!autoRefreshEnabled) return
    const id = window.setInterval(async () => {
      try {
        await refetch()
        setLastUpdated(Date.now())
      } catch {
        /* silent */
      }
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [autoRefreshEnabled, refetch])

  useEffect(() => {
    const currentIds = new Set(alerts.map((a) => a.id))
    let hasNew = false
    currentIds.forEach((id) => {
      if (!previousIdsRef.current.has(id)) hasNew = true
    })
    if (hasNew && previousIdsRef.current.size > 0) {
      playSound()
      toast.warning('New SOS alert', 'A new emergency signal was received.')
    }
    previousIdsRef.current = currentIds
  }, [alerts, playSound])

  // Lock body scroll while modal open
  useEffect(() => {
    if (!showEscalate && !showHelp) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [showEscalate, showHelp])

  /* ---------------------------- derived ---------------------------- */

  const sorted = useMemo(() => sortAlerts(alerts, sortKey), [alerts, sortKey])

  const filtered = useMemo(() => {
    let list = sorted
    if (tab === 'open') list = list.filter((a) => a.status === 'open')
    else if (tab === 'acknowledged') list = list.filter((a) => a.status === 'acknowledged')
    else if (tab === 'resolved') list = list.filter((a) => a.status === 'resolved')
    else if (tab === 'breach') list = list.filter((a) => isSlaBreached(a))
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) => {
        const haystack = [a.id, getRiderName(a), getDriverName(a), getLocation(a)].join(' ').toLowerCase()
        return haystack.includes(q)
      })
    }
    return list
  }, [sorted, tab, search])

  const counts = useMemo(
    () => ({
      all: alerts.length,
      open: alerts.filter((a) => a.status === 'open').length,
      acknowledged: alerts.filter((a) => a.status === 'acknowledged').length,
      resolved: alerts.filter((a) => a.status === 'resolved').length,
      breach: alerts.filter((a) => isSlaBreached(a)).length,
    }),
    [alerts],
  )

  const analytics = useMemo(() => {
    const resolved = alerts.filter((a) => a.status === 'resolved')
    const acknowledged = alerts.filter((a) => getAcknowledgedAt(a) !== null)

    const ackTimes = acknowledged
      .map((a) => {
        const ack = getAcknowledgedAt(a)
        return ack ? minutesBetween(a.triggeredAt, ack) : null
      })
      .filter((v): v is number => v !== null)

    const resolveTimes = resolved
      .map((a) => {
        const res = getResolvedAt(a)
        return res ? minutesBetween(a.triggeredAt, res) : null
      })
      .filter((v): v is number => v !== null)

    const avgAck = ackTimes.length > 0 ? ackTimes.reduce((s, t) => s + t, 0) / ackTimes.length : 0
    const avgResolve =
      resolveTimes.length > 0 ? resolveTimes.reduce((s, t) => s + t, 0) / resolveTimes.length : 0
    const fastest = resolveTimes.length > 0 ? Math.min(...resolveTimes) : 0
    const slowest = resolveTimes.length > 0 ? Math.max(...resolveTimes) : 0

    return { avgAck, avgResolve, fastest, slowest, totalResolved: resolved.length }
  }, [alerts])

  const selected = useMemo(() => {
    if (selectedId) return sorted.find((a) => a.id === selectedId) ?? null
    return filtered[0] ?? sorted[0] ?? null
  }, [selectedId, sorted, filtered])

  const selectedNotes = selected ? notes[selected.id] ?? [] : []
  const selectedEscalations = selected ? escalations[selected.id] ?? [] : []

  const relatedAlerts = useMemo(() => {
    if (!selected) return []
    return alerts.filter((a) => {
      if (a.id === selected.id) return false
      const sameRider = getRiderName(a) !== 'Unknown rider' && getRiderName(a) === getRiderName(selected)
      const sameDriver = getDriverName(a) !== '—' && getDriverName(a) === getDriverName(selected)
      const sameLocation = getLocation(a) !== '—' && getLocation(a) === getLocation(selected)
      return sameRider || sameDriver || sameLocation
    })
  }, [alerts, selected])

  /* ---------------------------- actions ---------------------------- */

  const handleAcknowledge = async () => {
    if (!selected) return
    try {
      await acknowledge.mutateAsync(selected.id)
      toast.info('Alert acknowledged', 'You are now handling this SOS.')
    } catch (e) {
      toast.error('Could not acknowledge', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleResolve = async (note: string) => {
    if (!selected) return
    try {
      await resolve.mutateAsync({ id: selected.id, note })
      toast.success('SOS resolved', `Note saved by ${user?.firstName ?? 'admin'}.`)
    } catch (e) {
      toast.error('Could not resolve', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
      setLastUpdated(Date.now())
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }

  const handleAddNote = (body: string) => {
    if (!selected || !body.trim()) return
    const entry: NoteEntry = {
      id: `n_${Date.now()}`,
      body: body.trim(),
      author: `${user?.firstName ?? 'Admin'} ${user?.lastName ?? ''}`.trim(),
      at: new Date().toISOString(),
    }
    const next = { ...notes, [selected.id]: [entry, ...(notes[selected.id] ?? [])] }
    setNotes(next)
    saveJSON(NOTES_KEY, next)
    toast.success('Note saved')
  }

  const handleDeleteNote = (noteId: string) => {
    if (!selected) return
    const next = { ...notes, [selected.id]: (notes[selected.id] ?? []).filter((n) => n.id !== noteId) }
    setNotes(next)
    saveJSON(NOTES_KEY, next)
  }

  const handleEscalate = (option: EscalationOption) => {
    if (!selected) return
    const entry: EscalationEntry = {
      id: `e_${Date.now()}`,
      option: option.label,
      at: new Date().toISOString(),
      admin: `${user?.firstName ?? 'Admin'}`,
    }
    const next = { ...escalations, [selected.id]: [...(escalations[selected.id] ?? []), entry] }
    setEscalations(next)
    setShowEscalate(false)
    toast.success('Escalated', `${option.label} notified.`)
  }

  const handleCopySummary = async () => {
    if (!selected) return
    const sla = computeSla(selected)
    const text = [
      `SOS Alert — ${selected.id}`,
      `Status: ${selected.status}`,
      `Rider: ${getRiderName(selected)}`,
      `Driver: ${getDriverName(selected)}`,
      `Location: ${getLocation(selected)}`,
      `Severity: ${getSeverity(selected)}`,
      `Time open: ${sla.label}`,
      `Triggered: ${new Date(selected.triggeredAt).toLocaleString()}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied', 'Alert summary in clipboard.')
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }

  const handleExportCSV = () => {
    const rows = filtered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No alerts match the current view.')
      return
    }
    const headers = ['id', 'status', 'severity', 'rider', 'driver', 'location', 'triggeredAt', 'acknowledgedAt', 'resolvedAt']
    const escape = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
    const lines = [headers.join(',')]
    for (const a of rows) {
      lines.push(
        [a.id, a.status, getSeverity(a), getRiderName(a), getDriverName(a), getLocation(a), a.triggeredAt, getAcknowledgedAt(a) ?? '', getResolvedAt(a) ?? '']
          .map(escape)
          .join(','),
      )
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sos-alerts-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('CSV exported', `${rows.length} alerts downloaded.`)
  }

  const handleExportJSON = () => {
    const rows = filtered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No alerts match the current view.')
      return
    }
    const payload = { exportedAt: new Date().toISOString(), count: rows.length, analytics, alerts: rows }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sos-alerts-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('JSON exported', `${rows.length} alerts downloaded.`)
  }

  const handleSelectNext = () => {
    if (filtered.length === 0) return
    const i = selected ? filtered.findIndex((a) => a.id === selected.id) : -1
    setSelectedId(filtered[(i + 1) % filtered.length].id)
  }
  const handleSelectPrev = () => {
    if (filtered.length === 0) return
    const i = selected ? filtered.findIndex((a) => a.id === selected.id) : -1
    setSelectedId(filtered[(i - 1 + filtered.length) % filtered.length].id)
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (showEscalate) {
          setShowEscalate(false)
          return
        }
        if (showHelp) {
          setShowHelp(false)
          return
        }
        return
      }
      if (inField) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
        return
      }
      if (e.key === '?') {
        e.preventDefault()
        setShowHelp((v) => !v)
        return
      }
      if (e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleSelectNext()
      }
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handleSelectPrev()
      }
      if (e.key.toLowerCase() === 'a' && selected?.status === 'open') {
        e.preventDefault()
        handleAcknowledge()
      }
      if (e.key.toLowerCase() === 'e' && selected) {
        e.preventDefault()
        setShowEscalate(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, showEscalate, showHelp, filtered])

  /* ---------------------------- render ---------------------------- */

  const breachCount = counts.breach
  const worstOpenAlert = alerts
    .filter((a) => a.status !== 'resolved')
    .reduce<SosAlert | null>((worst, a) => {
      if (!worst) return a
      return minutesBetween(a.triggeredAt) > minutesBetween(worst.triggeredAt) ? a : worst
    }, null)

  return (
    <AppShell title="SOS Emergency Response Desk">
      <style>{ANIMATIONS}</style>

      {breachCount > 0 ? (
        <div className="sos-slide-down mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-danger bg-red-50 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-danger text-white">
              <span className="sos-ping absolute inset-0 rounded-full bg-danger/40" />
              <AlertTriangle size={16} aria-hidden="true" />
            </div>
            <div>
              <div className="text-sm font-bold text-danger">{breachCount} alert{breachCount === 1 ? '' : 's'} past SLA</div>
              <div className="text-[11px] text-danger/80">
                {worstOpenAlert ? `Worst: ${formatDuration(minutesBetween(worstOpenAlert.triggeredAt))} open — ${getRiderName(worstOpenAlert)}` : 'Immediate response required'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {worstOpenAlert ? (
              <button
                type="button"
                onClick={() => setSelectedId(worstOpenAlert.id)}
                className="inline-flex items-center gap-1 rounded-md bg-danger px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Jump to worst
                <ChevronRight size={11} aria-hidden="true" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setTab('breach')}
              className="inline-flex items-center gap-1 rounded-md border border-danger/40 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-red-50 transition-colors"
            >
              View all
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 sos-stagger">
        <KpiOpen count={counts.open} breach={counts.breach} />
        <KpiAck count={counts.acknowledged} avgAck={analytics.avgAck} />
        <KpiResolved count={counts.resolved} avgResolve={analytics.avgResolve} />
        <KpiSystem
          autoRefresh={autoRefreshEnabled}
          sound={soundEnabled}
          lastUpdated={lastUpdated}
          now={now}
          onToggleRefresh={() => setAutoRefreshEnabled((v) => !v)}
          onToggleSound={() => setSoundEnabled((v) => !v)}
        />
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 sos-fade-up">
          {TABS.map(({ key, label }) => {
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
                    ? key === 'breach'
                      ? 'border-danger bg-danger text-white shadow-sm shadow-danger/20'
                      : 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                    : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                ].join(' ')}
              >
                {label}
                {count > 0 ? (
                  <span
                    className={[
                      'sos-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active ? 'bg-white/25 text-white' : key === 'breach' ? 'bg-red-100 text-danger' : 'bg-surface-alt text-ink-muted',
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
            <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rider, driver, location…"
              className="w-48 rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
            />
          </div>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            aria-label="Sort alerts"
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none"
          >
            <option value="priority">Priority</option>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="severity">Severity</option>
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} aria-hidden="true" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="sos-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            CSV
          </button>

          <button
            type="button"
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            JSON
          </button>

          <button
            type="button"
            onClick={() => setShowHelp(true)}
            className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1.5 text-[10px] font-mono text-ink-muted hover:border-emerald hover:text-emerald transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard size={11} aria-hidden="true" />?
          </button>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load alerts"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-ink">
                Alert Queue <span className="text-ink-muted font-normal">({filtered.length} of {alerts.length})</span>
              </h3>
              <span className="text-[11px] text-ink-muted">J / K to navigate</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-surface border border-border h-32 animate-pulse" />
              ))
            ) : filtered.length === 0 ? (
              <div className="rounded-xl bg-surface border border-border">
                <EmptyState
                  icon={ShieldCheck}
                  title={search || tab !== 'all' ? 'No matches' : 'No active alerts'}
                  description={search || tab !== 'all' ? 'Try clearing the search or a different tab.' : 'All clear. New SOS signals will appear here in real time.'}
                />
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((alert) => (
                  <EnhancedAlertCard
                    key={alert.id}
                    alert={alert}
                    selected={alert.id === selected?.id}
                    onClick={() => setSelectedId(alert.id)}
                    now={now}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {selected ? (
              <>
                <AlertDetail alert={selected} onAcknowledge={handleAcknowledge} onResolve={handleResolve} />

                <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-surface p-2">
                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                  >
                    <Copy size={11} aria-hidden="true" />
                    Copy summary
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowEscalate(true)}
                    className="inline-flex items-center gap-1.5 rounded-md bg-danger px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-red-700 transition-colors"
                  >
                    <Siren size={11} aria-hidden="true" />
                    Escalate
                  </button>

                  {selectedEscalations.length > 0 ? (
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-danger">
                      {selectedEscalations.length} escalation{selectedEscalations.length === 1 ? '' : 's'}
                    </span>
                  ) : null}
                </div>

                {selectedEscalations.length > 0 ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-danger">
                      <Siren size={11} aria-hidden="true" />
                      Escalations
                    </div>
                    <ul className="space-y-1">
                      {selectedEscalations.map((e) => (
                        <li key={e.id} className="flex items-center justify-between text-[11px] text-danger">
                          <span className="font-medium">{e.option}</span>
                          <span className="text-[10px] opacity-70">
                            {new Date(e.at).toLocaleTimeString()} · {e.admin}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {relatedAlerts.length > 0 ? (
                  <div className="rounded-xl border border-border bg-surface p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      <History size={11} aria-hidden="true" />
                      Related alerts ({relatedAlerts.length})
                    </div>
                    <ul className="space-y-1">
                      {relatedAlerts.slice(0, 4).map((a) => {
                        const s = computeSla(a)
                        return (
                          <li key={a.id}>
                            <button
                              type="button"
                              onClick={() => setSelectedId(a.id)}
                              className="flex w-full items-center justify-between gap-2 rounded-md bg-surface-alt/40 px-2.5 py-1.5 text-left text-[11px] hover:bg-surface-alt transition-colors"
                            >
                              <span className="truncate text-ink-secondary">{getRiderName(a)} · {getLocation(a)}</span>
                              <span className="flex shrink-0 items-center gap-1">
                                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${SLA_STYLES[s.tier].bg} ${SLA_STYLES[s.tier].text}`}>
                                  {s.tier === 'resolved' ? 'Closed' : s.label}
                                </span>
                                <ChevronRight size={10} className="text-ink-muted" aria-hidden="true" />
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : null}

                <AdminNotesPanel notes={selectedNotes} onAdd={handleAddNote} onDelete={handleDeleteNote} />
              </>
            ) : (
              <div className="rounded-xl bg-surface border border-border">
                <EmptyState icon={ShieldCheck} title="Select an alert" description="Choose an alert from the queue to view details and take action." />
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat icon={<Timer size={12} className="text-sky-500" />} label="Avg ack" value={analytics.avgAck > 0 ? formatDuration(analytics.avgAck) : '—'} hint={`Target < ${SLA_WARNING_MIN}m`} tone={analytics.avgAck === 0 || analytics.avgAck < SLA_WARNING_MIN ? 'success' : analytics.avgAck < SLA_AGING_MIN ? 'warning' : 'danger'} />
        <MiniStat icon={<TrendingUp size={12} className="text-emerald" />} label="Avg resolve" value={analytics.avgResolve > 0 ? formatDuration(analytics.avgResolve) : '—'} hint={`Target < ${SLA_BREACH_MIN}m`} tone={analytics.avgResolve === 0 || analytics.avgResolve < SLA_BREACH_MIN ? 'success' : 'danger'} />
        <MiniStat icon={<Zap size={12} className="text-amber-500" />} label="Fastest today" value={analytics.fastest > 0 ? formatDuration(analytics.fastest) : '—'} hint="Best response" tone="default" />
        <MiniStat icon={<AlertCircle size={12} className="text-danger" />} label="Slowest today" value={analytics.slowest > 0 ? formatDuration(analytics.slowest) : '—'} hint={`${analytics.totalResolved} resolved`} tone={analytics.slowest >= SLA_BREACH_MIN ? 'danger' : 'default'} />
      </div>

      {/* ---------------- Escalate modal — z-[10000] above Leaflet ---------------- */}
      {showEscalate && selected ? (
        <EscalateModal alert={selected} onSelect={handleEscalate} onClose={() => setShowEscalate(false)} />
      ) : null}

      {showHelp ? <KeyboardHelpModal onClose={() => setShowHelp(false)} /> : null}
    </AppShell>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

function KpiOpen({ count, breach }: { count: number; breach: number }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
        <span className="relative flex h-2 w-2">
          <span className="sos-ping absolute inline-flex h-full w-full rounded-full bg-danger/60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
        </span>
        Open
      </div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-2xl font-bold text-danger">{count}</div>
        {breach > 0 ? (
          <span className="inline-flex items-center rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-danger">{breach} breach</span>
        ) : null}
      </div>
      <div className="mt-0.5 text-[10px] text-ink-muted">{count === 0 ? 'No active alerts' : 'Immediate response required'}</div>
    </div>
  )
}

function KpiAck({ count, avgAck }: { count: number; avgAck: number }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
        <AlertTriangle size={12} className="text-warning" />
        Acknowledged
      </div>
      <div className="text-2xl font-bold text-warning">{count}</div>
      <div className="mt-0.5 text-[10px] text-ink-muted">{avgAck > 0 ? `Avg ack ${formatDuration(avgAck)}` : 'No data yet'}</div>
    </div>
  )
}

function KpiResolved({ count, avgResolve }: { count: number; avgResolve: number }) {
  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
        <CheckCircle2 size={12} className="text-emerald" />
        Resolved
      </div>
      <div className="text-2xl font-bold text-emerald">{count}</div>
      <div className="mt-0.5 text-[10px] text-ink-muted">{avgResolve > 0 ? `Avg resolve ${formatDuration(avgResolve)}` : 'No resolutions yet'}</div>
    </div>
  )
}

function KpiSystem({
  autoRefresh,
  sound,
  lastUpdated,
  now,
  onToggleRefresh,
  onToggleSound,
}: {
  autoRefresh: boolean
  sound: boolean
  lastUpdated: number
  now: number
  onToggleRefresh: () => void
  onToggleSound: () => void
}) {
  const since = Math.max(0, Math.floor((now - lastUpdated) / 1000))
  const sinceLabel = since < 60 ? `${since}s ago` : since < 3600 ? `${Math.floor(since / 60)}m ago` : `${Math.floor(since / 3600)}h ago`
  return (
    <div className="rounded-xl bg-surface border border-border p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
        <Radio size={12} className="text-info" />
        System
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleRefresh}
          title={autoRefresh ? 'Pause auto-refresh' : 'Enable auto-refresh'}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${autoRefresh ? 'bg-emerald-light text-emerald-dark hover:bg-emerald/20' : 'bg-surface-alt text-ink-muted hover:bg-surface-alt/80'}`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${autoRefresh ? 'bg-emerald sos-pulse' : 'bg-ink-muted/50'}`} aria-hidden="true" />
          {autoRefresh ? 'Live' : 'Paused'}
        </button>
        <button
          type="button"
          onClick={onToggleSound}
          title={sound ? 'Mute alerts' : 'Enable sound'}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-colors ${sound ? 'bg-emerald-light text-emerald-dark hover:bg-emerald/20' : 'bg-surface-alt text-ink-muted hover:bg-surface-alt/80'}`}
        >
          {sound ? <Volume2 size={9} aria-hidden="true" /> : <VolumeX size={9} aria-hidden="true" />}
          {sound ? 'Sound on' : 'Muted'}
        </button>
      </div>
      <div className="mt-1 text-[10px] text-ink-muted">Updated {sinceLabel}</div>
    </div>
  )
}

function MiniStat({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint: string
  tone: 'success' | 'warning' | 'danger' | 'default'
}) {
  const valueColor = tone === 'success' ? 'text-emerald' : tone === 'warning' ? 'text-amber-600' : tone === 'danger' ? 'text-danger' : 'text-ink'
  return (
    <div className="rounded-lg border border-border bg-surface px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        {icon}
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-bold tabular-nums ${valueColor}`}>{value}</div>
      <div className="text-[10px] text-ink-muted">{hint}</div>
    </div>
  )
}

function EnhancedAlertCard({
  alert,
  selected,
  onClick,
  now,
}: {
  alert: SosAlert
  selected: boolean
  onClick: () => void
  now: number
}) {
  const minutesOpen = alert.status === 'resolved' ? 0 : Math.max(0, (now - new Date(alert.triggeredAt).getTime()) / 60_000)
  const liveTier: SlaTier =
    alert.status === 'resolved' ? 'resolved' : minutesOpen < SLA_WARNING_MIN ? 'fresh' : minutesOpen < SLA_AGING_MIN ? 'aging' : minutesOpen < SLA_BREACH_MIN ? 'warning' : 'breach'
  const style = SLA_STYLES[liveTier]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border bg-surface p-3.5 text-left transition-all ${selected ? 'border-emerald bg-emerald/5 shadow-sm ring-1 ring-emerald/20' : 'border-border hover:border-emerald/40 hover:shadow-sm'}`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="font-mono text-[10px] text-ink-muted">#{alert.id.slice(0, 6).toUpperCase()}</span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style.bg} ${style.text}`}>
              <span className={`h-1 w-1 rounded-full ${style.dot}`} aria-hidden="true" />
              {style.label}
            </span>
            {getSeverity(alert) === 'critical' ? (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-danger">
                <Zap size={8} aria-hidden="true" />
                Critical
              </span>
            ) : null}
          </div>
          <div className="truncate text-sm font-semibold text-ink">{getRiderName(alert)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-ink-secondary">
            <MapPin size={9} className="shrink-0" aria-hidden="true" />
            <span className="truncate">{getLocation(alert)}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold tabular-nums text-ink">{alert.status === 'resolved' ? '—' : formatDuration(minutesOpen)}</div>
          <div className="text-[9px] uppercase tracking-wide text-ink-muted">{alert.status === 'resolved' ? 'resolved' : 'open'}</div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[10px] text-ink-muted">
        <span className="truncate">{getDriverName(alert) !== '—' ? `Driver: ${getDriverName(alert)}` : ''}</span>
        <span className="shrink-0">{new Date(alert.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>

      {liveTier === 'breach' ? (
        <div className="mt-1.5 flex items-center gap-1 rounded-md bg-red-50 px-2 py-1 text-[10px] font-semibold text-danger">
          <AlertTriangle size={10} aria-hidden="true" />
          SLA breach — response overdue
        </div>
      ) : null}
    </button>
  )
}

function AdminNotesPanel({
  notes,
  onAdd,
  onDelete,
}: {
  notes: NoteEntry[]
  onAdd: (body: string) => void
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState('')
  const handleSubmit = () => {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
        <MessageSquare size={11} aria-hidden="true" />
        Admin notes ({notes.length})
      </div>

      <div className="flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleSubmit()
          }}
          rows={2}
          placeholder="Add a note for the team… (⌘↵ to save)"
          className="flex-1 rounded-lg border border-border bg-canvas px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 resize-none"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!draft.trim()}
          className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Plus size={11} aria-hidden="true" />
          Save
        </button>
      </div>

      {notes.length === 0 ? (
        <p className="mt-2 text-[10px] text-ink-muted text-center">No notes yet.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {notes.map((n) => (
            <li key={n.id} className="group flex items-start justify-between gap-2 rounded-md border border-border bg-canvas px-2.5 py-1.5">
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-[11px] text-ink leading-relaxed">{n.body}</p>
                <div className="mt-0.5 text-[9px] text-ink-muted">{n.author} · {new Date(n.at).toLocaleTimeString()}</div>
              </div>
              <button
                type="button"
                onClick={() => onDelete(n.id)}
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
  )
}

/* ==========================================================================
   ESCALATE MODAL — fixed z-index above Leaflet (map z-index can reach 400-1000)
   ========================================================================== */

function EscalateModal({
  alert,
  onSelect,
  onClose,
}: {
  alert: SosAlert
  onSelect: (option: EscalationOption) => void
  onClose: () => void
}) {
  return (
    <div
      // z-[10000] guarantees we render above Leaflet tiles, controls, and popups
      className="sos-fade-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="escalate-title"
      onClick={onClose}
    >
      <div
        className="sos-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 id="escalate-title" className="text-sm font-bold text-ink">
              Escalate SOS — {getRiderName(alert)}
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Notify emergency services or supervisor. This is logged.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-surface-alt"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="space-y-1.5">
          {ESCALATION_OPTIONS.map((opt) => {
            const toneClass: Record<EscalationOption['tone'], string> = {
              danger: 'border-red-200 bg-red-50 hover:bg-red-100',
              warning: 'border-amber-200 bg-amber-50 hover:bg-amber-100',
              info: 'border-sky-200 bg-sky-50 hover:bg-sky-100',
              success: 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100',
            }
            const textClass: Record<EscalationOption['tone'], string> = {
              danger: 'text-danger',
              warning: 'text-amber-700',
              info: 'text-sky-700',
              success: 'text-emerald-dark',
            }
            return (
              <div key={opt.id} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition-colors ${toneClass[opt.tone]}`}>
                <div className="min-w-0">
                  <div className={`text-xs font-semibold ${textClass[opt.tone]}`}>{opt.label}</div>
                  <div className="text-[10px] text-ink-secondary truncate">{opt.hint}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {opt.number ? (
                    <a
                      href={`tel:${opt.number}`}
                      onClick={(e) => e.stopPropagation()}
                      className={`inline-flex items-center gap-1 rounded-md bg-white border border-border px-2 py-1 text-[10px] font-semibold ${textClass[opt.tone]} hover:shadow-sm transition-shadow`}
                    >
                      <Phone size={9} aria-hidden="true" />
                      {opt.number}
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onSelect(opt)}
                    className={`inline-flex items-center gap-1 rounded-md bg-white border border-border px-2 py-1 text-[10px] font-semibold ${textClass[opt.tone]} hover:shadow-sm transition-shadow`}
                  >
                    <Check size={9} aria-hidden="true" />
                    Log
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-[10px] text-ink-muted">
          Tip: click a number to dial directly from your device. Escalating logs the action but does not auto-dial.
        </p>
      </div>
    </div>
  )
}

/* ==========================================================================
   KEYBOARD HELP MODAL — same z-index treatment
   ========================================================================== */

function KeyboardHelpModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['J'], label: 'Next alert' },
    { keys: ['K'], label: 'Previous alert' },
    { keys: ['A'], label: 'Acknowledge selected (if open)' },
    { keys: ['E'], label: 'Escalate selected' },
    { keys: ['/'], label: 'Focus search' },
    { keys: ['?'], label: 'Toggle this help' },
    { keys: ['Esc'], label: 'Close modals' },
  ]
  return (
    <div
      className="sos-fade-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-title"
      onClick={onClose}
    >
      <div className="sos-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 id="help-title" className="text-sm font-bold text-ink flex items-center gap-1.5">
              <Keyboard size={14} aria-hidden="true" />
              Keyboard shortcuts
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">Works when focus is not in an input.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 text-ink-muted hover:bg-surface-alt" aria-label="Close">
            <X size={14} />
          </button>
        </div>
        <ul className="space-y-1">
          {shortcuts.map((s) => (
            <li key={s.label} className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-alt transition-colors">
              <span className="text-xs text-ink-secondary">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd key={k} className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-ink-muted">{k}</kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}