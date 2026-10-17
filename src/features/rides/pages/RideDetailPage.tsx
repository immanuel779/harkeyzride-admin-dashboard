import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Banknote,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  FileJson,
  FileQuestion,
  Flag,
  History,
  LayoutDashboard,
  Map as MapIcon,
  Navigation,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Trash2,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { Tabs, type TabItem } from '../../../components/shared/Tabs'
import { toast } from '../../../lib/toast'

import {
  getRideById,
  getRideCoordinates,
  getRideEvents,
  getRideFareBreakdown,
  getRideSosInfo,
  type Ride,
  type RideCoordinates,
  type RideEvent,
  type RideFareBreakdown,
  type RideSosInfo,
  type RideStatus,
} from '../data/mockRides'
import { RideRouteMap } from '../components/RideRouteMap'
import { RideTimeline } from '../components/RideTimeline'

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
  sos: { label: 'SOS Active', tone: 'danger' },
}

const HIGH_FARE_THRESHOLD = 5000
const LONG_TRIP_THRESHOLD_MIN = 60
const STUCK_TRIP_THRESHOLD_MIN = 30
const VERY_LONG_TRIP_THRESHOLD_MIN = 120

const RIDE_NOTES_KEY = 'hr.ride.notes.'
const RIDE_FLAGS_KEY = 'hr.ride.flags.'
const RIDE_REFUNDS_KEY = 'hr.ride.refunds.'
const RIDE_AUDIT_KEY = 'hr.ride.audit.'

type TabId = 'overview' | 'route' | 'timeline' | 'payment' | 'sos' | 'notes' | 'audit'

type RiskTier = 'low' | 'medium' | 'high' | 'critical'

type AuditAction =
  | 'flag'
  | 'unflag'
  | 'refund_request'
  | 'cancel_request'
  | 'note_added'
  | 'note_deleted'
  | 'sos_acknowledged'
  | 'sos_resolved'
  | 'sos_note'
  | 'export'

const ANIMATIONS = `
  @keyframes rdd-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rdd-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rdd-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes rdd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  .rdd-fade-in { animation: rdd-fade-in .2s ease both; }
  .rdd-fade-up { animation: rdd-fade-up .3s cubic-bezier(.22,1,.36,1) both; }
  .rdd-pop { animation: rdd-pop .3s cubic-bezier(.22,1,.36,1) both; }
  .rdd-pulse { animation: rdd-pulse 1.5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .rdd-fade-in, .rdd-fade-up, .rdd-pop, .rdd-pulse { animation: none !important; }
  }
`

/* ==========================================================================
   ADMIN ANNOTATION TYPES + STORAGE
   ========================================================================== */

type AdminNote = {
  id: string
  body: string
  author: string
  createdAt: number
}

type RideFlag = {
  id: string
  type: string
  note: string
  author: string
  createdAt: number
}

type RideRefund = {
  id: string
  amount: number
  reason: string
  author: string
  createdAt: number
  status: 'requested' | 'approved' | 'rejected'
}

type AuditEntry = {
  id: string
  at: number
  action: AuditAction
  actor: string
  description: string
}

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed = JSON.parse(raw)
    return parsed ?? fallback
  } catch {
    return fallback
  }
}

function writeLS<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

const FLAG_TYPES = [
  { value: 'fraud_suspected', label: 'Fraud suspected' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'fare_dispute', label: 'Fare dispute' },
  { value: 'route_anomaly', label: 'Route anomaly' },
  { value: 'driver_issue', label: 'Driver issue' },
  { value: 'rider_issue', label: 'Rider issue' },
  { value: 'system_error', label: 'System error' },
  { value: 'other', label: 'Other' },
]

const REFUND_REASONS = [
  'Driver no-show',
  'Rider cancelled early',
  'Overcharge',
  'Safety incident',
  'Technical error',
  'Service quality',
  'Goodwill',
  'Other',
]

/* ==========================================================================
   RISK ENGINE
   ========================================================================== */

type RideRisk = {
  score: number
  tier: RiskTier
  reasons: string[]
}

function computeRideRisk(
  ride: Ride,
  sosActive: boolean,
  flagCount: number,
  refundCount: number,
): RideRisk {
  let score = 0
  const reasons: string[] = []

  if (sosActive) {
    score += 100
    reasons.push('Active SOS')
  }
  if (ride.status === 'in_progress' && ride.durationMin > LONG_TRIP_THRESHOLD_MIN) {
    score += 40
    reasons.push(`Live for ${ride.durationMin} min (stuck)`)
  } else if (
    ride.status === 'in_progress' &&
    ride.durationMin > STUCK_TRIP_THRESHOLD_MIN
  ) {
    score += 20
    reasons.push(`Live for ${ride.durationMin} min`)
  }
  if (ride.status === 'cancelled' && ride.fare > 0) {
    score += 30
    reasons.push('Cancelled but fare charged')
  }
  if (ride.fare >= HIGH_FARE_THRESHOLD) {
    score += 15
    reasons.push(`High fare (₦${ride.fare.toLocaleString()})`)
  }
  if (ride.durationMin > VERY_LONG_TRIP_THRESHOLD_MIN) {
    score += 25
    reasons.push(`Very long duration (${ride.durationMin} min)`)
  }
  if (flagCount > 0) {
    score += Math.min(30, flagCount * 10)
    reasons.push(`${flagCount} admin flag${flagCount === 1 ? '' : 's'}`)
  }
  if (refundCount > 0) {
    score += 5
    reasons.push(`${refundCount} refund request${refundCount === 1 ? '' : 's'}`)
  }

  score = Math.min(100, score)
  const tier: RiskTier =
    score >= 80 ? 'critical' : score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'
  return { score, tier, reasons }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function RideDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const [tab, setTab] = useState<TabId>('overview')

  const ride = useMemo(() => getRideById(id), [id])
  const events = useMemo(() => (id ? getRideEvents(id) : []), [id])
  const coords = useMemo(() => (id ? getRideCoordinates(id) : null), [id])
  const sos = useMemo(
    () => (id && ride ? getRideSosInfo(ride.status, id) : null),
    [id, ride],
  )

  /* ---------------------------- admin state ---------------------------- */

  const [notes, setNotes] = useState<AdminNote[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [flags, setFlags] = useState<RideFlag[]>([])
  const [refunds, setRefunds] = useState<RideRefund[]>([])
  const [audit, setAudit] = useState<AuditEntry[]>([])

  const [sosOverride, setSosOverride] = useState<Partial<RideSosInfo> | null>(null)
  const [sosNote, setSosNote] = useState('')

  const [flagModalOpen, setFlagModalOpen] = useState(false)
  const [flagType, setFlagType] = useState('fraud_suspected')
  const [flagNote, setFlagNote] = useState('')

  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundAmount, setRefundAmount] = useState(0)
  const [refundReason, setRefundReason] = useState(REFUND_REASONS[0])
  const [refundNote, setRefundNote] = useState('')

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [cancelReason, setCancelReason] = useState('')

  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const copiedTimerRef = useRef<number | null>(null)

  /* ---------------------------- effects ---------------------------- */

  // Load admin data for this ride
  useEffect(() => {
    if (!id) return
    setNotes(readLS<AdminNote[]>(RIDE_NOTES_KEY + id, []))
    setFlags(readLS<RideFlag[]>(RIDE_FLAGS_KEY + id, []))
    setRefunds(readLS<RideRefund[]>(RIDE_REFUNDS_KEY + id, []))
    setAudit(readLS<AuditEntry[]>(RIDE_AUDIT_KEY + id, []))
    setSosOverride(null)
    setSosNote('')
  }, [id])

  // Prefill refund amount when ride loads
  useEffect(() => {
    if (ride) setRefundAmount(ride.fare)
  }, [ride])

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Esc closes modals
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (flagModalOpen) {
        setFlagModalOpen(false)
        e.stopPropagation()
      }
      if (refundModalOpen) {
        setRefundModalOpen(false)
        e.stopPropagation()
      }
      if (cancelModalOpen) {
        setCancelModalOpen(false)
        e.stopPropagation()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [flagModalOpen, refundModalOpen, cancelModalOpen])

  // Keyboard shortcut: ⌘/Ctrl + E exports
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportJSON()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ride, events, notes, flags, refunds, audit])

  /* ---------------------------- derived ---------------------------- */

  if (!ride || !coords) {
    return (
      <AppShell title="Ride Detail">
        <div className="rounded-xl bg-surface border border-border">
          <EmptyState
            icon={FileQuestion}
            title="Ride not found"
            description={`No ride matches ID: ${id}`}
            action={
              <button
                type="button"
                onClick={() => navigate('/rides')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-dark transition-colors"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Back to rides
              </button>
            }
          />
        </div>
      </AppShell>
    )
  }

  const cfg = STATUS_MAP[ride.status]
  const fare = getRideFareBreakdown(ride)
  const completedEvent = events.find((e) => e.type === 'trip_completed')
  const startedEvent = events.find((e) => e.type === 'trip_started')

  const effectiveSos: RideSosInfo | null = sos
    ? { ...sos, ...(sosOverride ?? {}) }
    : null
  const hasSos = effectiveSos !== null
  const sosActive = hasSos && effectiveSos!.resolvedAt === null

  const risk = computeRideRisk(ride, sosActive, flags.length, refunds.length)

  const canRefund = ride.status === 'completed' && refunds.length === 0
  const canCancel = ride.status === 'in_progress'

  /* ---------------------------- audit helpers ---------------------------- */

  const appendAudit = useCallback(
    (action: AuditAction, description: string) => {
      if (!id) return
      const entry: AuditEntry = {
        id: uid(),
        at: Date.now(),
        action,
        actor: 'Admin',
        description,
      }
      setAudit((prev) => {
        const next = [entry, ...prev]
        writeLS(RIDE_AUDIT_KEY + id, next)
        return next
      })
    },
    [id],
  )

  /* ---------------------------- handlers ---------------------------- */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    // Simulated refetch — real data reloads via route re-render anyway
    await new Promise((r) => setTimeout(r, 300))
    if (id) {
      setNotes(readLS<AdminNote[]>(RIDE_NOTES_KEY + id, []))
      setFlags(readLS<RideFlag[]>(RIDE_FLAGS_KEY + id, []))
      setRefunds(readLS<RideRefund[]>(RIDE_REFUNDS_KEY + id, []))
      setAudit(readLS<AuditEntry[]>(RIDE_AUDIT_KEY + id, []))
    }
    setRefreshing(false)
    toast.success('Refreshed')
  }, [id])

  const handleCopySummary = useCallback(async () => {
    const text = [
      `Ride #${ride.id.replace('rd_', '')}`,
      `Status: ${STATUS_MAP[ride.status].label}`,
      `Rider: ${ride.rider}`,
      `Driver: ${ride.driver}`,
      `Route: ${ride.pickup} → ${ride.destination}`,
      `Fare: ₦${ride.fare.toLocaleString()} (${ride.paymentMethod})`,
      `Duration: ${ride.durationMin} min`,
      `Risk: ${risk.tier.toUpperCase()} (${risk.score}/100)`,
      `Flags: ${flags.length} · Refunds: ${refunds.length} · Notes: ${notes.length}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [ride, risk, flags.length, refunds.length, notes.length])

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(ride.id)
      toast.success('Ride ID copied')
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [ride.id])

  const handleExportJSON = useCallback(() => {
    const payload = {
      generatedAt: new Date().toISOString(),
      ride,
      events,
      fare,
      sos: effectiveSos,
      risk,
      adminData: { notes, flags, refunds, audit },
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `ride-${ride.id}-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    appendAudit('export', 'Ride data exported as JSON')
    toast.success('Export ready', 'Ride data downloaded.')
  }, [ride, events, fare, effectiveSos, risk, notes, flags, refunds, audit, appendAudit])

  const handleFlagSubmit = () => {
    if (!id || !flagNote.trim()) {
      toast.error('Note required', 'Add a brief explanation for the flag.')
      return
    }
    const flag: RideFlag = {
      id: uid(),
      type: flagType,
      note: flagNote.trim(),
      author: 'Admin',
      createdAt: Date.now(),
    }
    const next = [flag, ...flags]
    setFlags(next)
    writeLS(RIDE_FLAGS_KEY + id, next)
    appendAudit('flag', `Flagged as "${flagType}" — ${flagNote.trim()}`)
    setFlagModalOpen(false)
    setFlagNote('')
    toast.success('Ride flagged', 'Admin flag recorded.')
  }

  const handleUnflag = (flagId: string) => {
    if (!id) return
    const flag = flags.find((f) => f.id === flagId)
    const next = flags.filter((f) => f.id !== flagId)
    setFlags(next)
    writeLS(RIDE_FLAGS_KEY + id, next)
    appendAudit('unflag', `Removed flag "${flag?.type ?? 'unknown'}"`)
    toast.success('Flag removed')
  }

  const handleRefundSubmit = () => {
    if (!id) return
    if (refundAmount <= 0) {
      toast.error('Invalid amount', 'Refund must be greater than zero.')
      return
    }
    if (refundAmount > ride.fare) {
      toast.error('Invalid amount', 'Refund cannot exceed the fare.')
      return
    }
    const refund: RideRefund = {
      id: uid(),
      amount: refundAmount,
      reason: refundNote.trim() ? `${refundReason} — ${refundNote.trim()}` : refundReason,
      author: 'Admin',
      createdAt: Date.now(),
      status: 'requested',
    }
    const next = [refund, ...refunds]
    setRefunds(next)
    writeLS(RIDE_REFUNDS_KEY + id, next)
    appendAudit(
      'refund_request',
      `Refund of ₦${refundAmount.toLocaleString()} requested — ${refundReason}`,
    )
    setRefundModalOpen(false)
    setRefundNote('')
    toast.success(
      'Refund requested',
      `₦${refundAmount.toLocaleString()} — awaiting approval.`,
    )
  }

  const handleCancelSubmit = () => {
    if (!id || !cancelReason.trim()) {
      toast.error('Reason required', 'Add a reason for requesting cancellation.')
      return
    }
    appendAudit('cancel_request', `Cancellation requested — ${cancelReason.trim()}`)
    setCancelModalOpen(false)
    setCancelReason('')
    toast.warning(
      'Cancellation requested',
      'Ops team has been notified to review this active ride.',
    )
  }

  const handleSosAcknowledge = () => {
    if (!effectiveSos) return
    setSosOverride((prev) => ({
      ...(prev ?? {}),
      acknowledgedBy: 'Admin',
    }))
    appendAudit('sos_acknowledged', 'SOS acknowledged by admin')
    toast.success('SOS acknowledged', 'Team has been notified.')
  }

  const handleSosResolve = () => {
    if (!effectiveSos) return
    setSosOverride((prev) => ({
      ...(prev ?? {}),
      resolvedBy: 'Admin',
      resolvedAt: new Date().toISOString(),
    }))
    appendAudit('sos_resolved', 'SOS resolved by admin')
    toast.success('SOS resolved', 'Emergency workflow closed.')
  }

  const handleSosAddNote = () => {
    if (!effectiveSos || !sosNote.trim()) return
    const nextNotes = [...(effectiveSos.notes ?? []), sosNote.trim()]
    setSosOverride((prev) => ({
      ...(prev ?? {}),
      notes: nextNotes,
    }))
    appendAudit('sos_note', `SOS note added — ${sosNote.trim()}`)
    setSosNote('')
    toast.success('Note added')
  }

  const handleAddNote = () => {
    if (!id || !noteDraft.trim()) return
    const note: AdminNote = {
      id: uid(),
      body: noteDraft.trim(),
      author: 'Admin',
      createdAt: Date.now(),
    }
    const next = [note, ...notes]
    setNotes(next)
    writeLS(RIDE_NOTES_KEY + id, next)
    appendAudit('note_added', 'Admin note added')
    setNoteDraft('')
    toast.success('Note saved')
  }

  const handleDeleteNote = (noteId: string) => {
    if (!id) return
    const next = notes.filter((n) => n.id !== noteId)
    setNotes(next)
    writeLS(RIDE_NOTES_KEY + id, next)
    appendAudit('note_deleted', 'Admin note deleted')
  }

  /* ---------------------------- tabs ---------------------------- */

  const tabs: TabItem<TabId>[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'route', label: 'Route', icon: MapIcon },
    { id: 'timeline', label: 'Timeline', icon: Clock, badge: events.length },
    { id: 'payment', label: 'Payment', icon: Wallet, badge: refunds.length || undefined },
    ...(hasSos
      ? [{ id: 'sos' as TabId, label: 'SOS', icon: ShieldAlert }]
      : []),
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: notes.length || undefined },
    { id: 'audit', label: 'Audit', icon: History, badge: audit.length || undefined },
  ]

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Ride Detail">
      <style>{ANIMATIONS}</style>

      {/* Back */}
      <button
        type="button"
        onClick={() => navigate('/rides')}
        className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink mb-4 transition-colors"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to rides
      </button>

      {/* SOS banner (preserved) */}
      {hasSos && effectiveSos!.resolvedAt === null ? (
        <div className="mb-4 rounded-xl border-2 border-danger bg-red-50 p-4 flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-danger text-white flex items-center justify-center flex-shrink-0 animate-pulse">
            <AlertTriangle size={18} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-danger">
              SOS ACTIVE — Immediate response required
            </div>
            <div className="text-xs text-ink-secondary mt-0.5">
              Rider triggered SOS {effectiveSos!.severity} alert.{' '}
              {effectiveSos!.acknowledgedBy
                ? `Acknowledged by ${effectiveSos!.acknowledgedBy}.`
                : 'Not yet acknowledged by admin.'}
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!effectiveSos!.acknowledgedBy ? (
              <button
                type="button"
                onClick={handleSosAcknowledge}
                className="inline-flex items-center gap-1 rounded-md bg-white border border-red-200 px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-red-50 transition-colors"
              >
                <Check size={11} aria-hidden="true" />
                Acknowledge
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => navigate('/sos')}
              className="inline-flex items-center gap-1.5 rounded-lg bg-danger px-3 py-2 text-white text-xs font-semibold hover:bg-danger/90 transition-colors"
            >
              <ShieldAlert size={12} aria-hidden="true" />
              Respond
            </button>
          </div>
        </div>
      ) : null}

      {/* Quick action bar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-ink-muted">
            #{ride.id.replace('rd_', '')}
          </span>
          <button
            type="button"
            onClick={handleCopyId}
            className="rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
            aria-label="Copy ride ID"
            title="Copy ride ID"
          >
            <ClipboardCopy size={11} aria-hidden="true" />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
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
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            {copied ? (
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
          <button
            type="button"
            onClick={handleExportJSON}
            title="Export JSON (Ctrl/Cmd + E)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            Export
          </button>
          <button
            type="button"
            onClick={() => setFlagModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-amber-500 hover:text-amber-700 transition-colors"
          >
            <Flag size={12} aria-hidden="true" />
            Flag{flags.length > 0 ? ` (${flags.length})` : ''}
          </button>
          {canRefund ? (
            <button
              type="button"
              onClick={() => setRefundModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-sky-500 hover:text-sky-700 transition-colors"
            >
              <Banknote size={12} aria-hidden="true" />
              Refund
            </button>
          ) : null}
          {canCancel ? (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
            >
              <Ban size={12} aria-hidden="true" />
              Cancel
            </button>
          ) : null}
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <KpiCard
          icon={<Banknote size={13} aria-hidden="true" />}
          tone="emerald"
          label="Fare"
          value={`₦${ride.fare.toLocaleString()}`}
          hint={ride.paymentMethod === 'wallet' ? 'Wallet' : 'Cash'}
        />
        <KpiCard
          icon={<Clock size={13} aria-hidden="true" />}
          tone="sky"
          label="Duration"
          value={`${ride.durationMin} min`}
          hint={
            ride.durationMin > VERY_LONG_TRIP_THRESHOLD_MIN
              ? 'Very long'
              : ride.durationMin > LONG_TRIP_THRESHOLD_MIN
                ? 'Long trip'
                : 'Normal'
          }
        />
        <KpiCard
          icon={<Zap size={13} aria-hidden="true" />}
          tone="amber"
          label="Events"
          value={String(events.length)}
          hint="Lifecycle records"
        />
        <KpiCard
          icon={<Flag size={13} aria-hidden="true" />}
          tone={flags.length > 0 ? 'red' : 'slate'}
          label="Flags"
          value={String(flags.length)}
          hint={flags.length > 0 ? 'Investigation open' : 'No flags'}
        />
        <KpiCard
          icon={<ShieldAlert size={13} aria-hidden="true" />}
          tone={sosActive ? 'red' : 'slate'}
          label="Risk"
          value={`${risk.score}/100`}
          hint={risk.tier.toUpperCase()}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* -------------------- Left summary -------------------- */}
        <div className="lg:col-span-1 space-y-4">
          {/* Ride summary (preserved) */}
          <div className="rounded-xl bg-surface border border-border p-6 rdd-fade-up">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-xs text-ink-muted">
                #{ride.id.replace('rd_', '')}
              </span>
              <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
            </div>

            <div className="text-3xl font-bold text-ink tracking-tight mb-4">
              ₦{ride.fare.toLocaleString()}
            </div>

            <div className="space-y-2 mb-4 text-sm">
              <Row label="Rider" value={ride.rider} />
              <Row label="Driver" value={ride.driver} />
              <Row
                label="Payment"
                value={ride.paymentMethod === 'wallet' ? 'Wallet' : 'Cash'}
              />
              <Row label="Duration" value={`${ride.durationMin} min`} />
              <Row
                label="Started"
                value={
                  ride.startedAt
                    ? new Date(ride.startedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'
                }
              />
            </div>
          </div>

          {/* Route snapshot (preserved) */}
          <div className="rounded-xl bg-surface border border-border p-5 rdd-fade-up">
            <div className="text-xs text-ink-secondary uppercase tracking-wide mb-2">
              Route snapshot
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center pt-1">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald" />
                <div className="w-0.5 h-8 bg-border my-1" />
                <div className="w-2.5 h-2.5 rounded-full bg-navy" />
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">
                    Pickup
                  </div>
                  <div className="text-xs text-ink font-medium truncate">
                    {ride.pickup}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-ink-muted">
                    Destination
                  </div>
                  <div className="text-xs text-ink font-medium truncate">
                    {ride.destination}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Risk card (new) */}
          <div className="rounded-xl bg-surface border border-border p-5 rdd-fade-up">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert size={13} className="text-ink-muted" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-ink">Risk score</h3>
              </div>
              <span className="text-[11px] font-bold text-ink tabular-nums">
                {risk.score}/100
              </span>
            </div>
            <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <div
                className={`rdd-pop absolute inset-y-0 left-0 rounded-full ${
                  risk.tier === 'critical'
                    ? 'bg-red-600'
                    : risk.tier === 'high'
                      ? 'bg-red-500'
                      : risk.tier === 'medium'
                        ? 'bg-amber-500'
                        : 'bg-emerald'
                }`}
                style={{ width: `${risk.score}%` }}
              />
            </div>
            {risk.reasons.length > 0 ? (
              <ul className="mt-3 space-y-1">
                {risk.reasons.map((r) => (
                  <li
                    key={r}
                    className="flex items-start gap-1.5 text-[11px] text-ink-secondary"
                  >
                    <span className="mt-1 inline-block h-1 w-1 rounded-full bg-ink-muted" />
                    {r}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[11px] text-emerald-dark">
                No risk factors detected.
              </p>
            )}
          </div>

          {/* Active flags (new) */}
          {flags.length > 0 ? (
            <div className="rounded-xl bg-surface border border-border p-5 rdd-fade-up">
              <div className="mb-2 flex items-center gap-2">
                <Flag size={13} className="text-amber-600" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-ink">
                  Flags ({flags.length})
                </h3>
              </div>
              <ul className="space-y-2">
                {flags.map((f) => (
                  <li
                    key={f.id}
                    className="group flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5"
                  >
                    <Flag
                      size={11}
                      className="mt-0.5 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-semibold text-amber-800">
                        {FLAG_TYPES.find((t) => t.value === f.type)?.label ?? f.type}
                      </div>
                      <div className="text-[10px] text-amber-700/80 mt-0.5">
                        {f.note}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnflag(f.id)}
                      className="shrink-0 rounded p-0.5 text-amber-600 opacity-0 group-hover:opacity-100 hover:bg-amber-100 transition-opacity"
                      aria-label="Remove flag"
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Refunds (new) */}
          {refunds.length > 0 ? (
            <div className="rounded-xl bg-surface border border-border p-5 rdd-fade-up">
              <div className="mb-2 flex items-center gap-2">
                <Banknote size={13} className="text-sky-600" aria-hidden="true" />
                <h3 className="text-xs font-semibold text-ink">
                  Refund requests ({refunds.length})
                </h3>
              </div>
              <ul className="space-y-1.5">
                {refunds.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[11px]"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-sky-800">
                        ₦{r.amount.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-sky-700/80 truncate">
                        {r.reason}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-800">
                      {r.status}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        {/* -------------------- Right tabbed area -------------------- */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-surface border border-border overflow-hidden rdd-fade-up">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />

            <div className="p-6">
              {tab === 'overview' ? (
                <OverviewTab
                  rideId={ride.id}
                  events={events}
                  startedAt={startedEvent?.at ?? null}
                  completedAt={completedEvent?.at ?? null}
                  risk={risk}
                  flags={flags}
                />
              ) : null}

              {tab === 'route' ? <RouteTab coords={coords} /> : null}

              {tab === 'timeline' ? <RideTimeline events={events} /> : null}

              {tab === 'payment' ? (
                <PaymentTab
                  fare={fare}
                  ride={ride}
                  refunds={refunds}
                  canRefund={canRefund}
                  onRequestRefund={() => setRefundModalOpen(true)}
                />
              ) : null}

              {tab === 'sos' && effectiveSos ? (
                <SosTab
                  sos={effectiveSos}
                  onAcknowledge={handleSosAcknowledge}
                  onResolve={handleSosResolve}
                  onAddNote={handleSosAddNote}
                  noteDraft={sosNote}
                  onNoteDraftChange={setSosNote}
                />
              ) : null}

              {tab === 'notes' ? (
                <NotesTab
                  notes={notes}
                  draft={noteDraft}
                  onDraftChange={setNoteDraft}
                  onAdd={handleAddNote}
                  onDelete={handleDeleteNote}
                />
              ) : null}

              {tab === 'audit' ? <AuditTab audit={audit} /> : null}
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- Flag modal -------------------- */}
      {flagModalOpen ? (
        <div
          className="rdd-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="flag-title"
          onClick={() => setFlagModalOpen(false)}
        >
          <div
            className="rdd-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 id="flag-title" className="text-sm font-bold text-ink">
                  Flag this ride
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Mark for investigation, tracking, or escalation.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFlagModalOpen(false)}
                className="rounded p-1 text-ink-muted hover:bg-surface-alt"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
              Flag type
            </label>
            <select
              value={flagType}
              onChange={(e) => setFlagType(e.target.value)}
              className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            >
              {FLAG_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
              Note (required)
            </label>
            <textarea
              value={flagNote}
              onChange={(e) => setFlagNote(e.target.value)}
              rows={3}
              placeholder="Explain why this ride is being flagged…"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 resize-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setFlagModalOpen(false)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFlagSubmit}
                disabled={!flagNote.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                <Flag size={12} />
                Confirm flag
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------- Refund modal -------------------- */}
      {refundModalOpen ? (
        <div
          className="rdd-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="refund-title"
          onClick={() => setRefundModalOpen(false)}
        >
          <div
            className="rdd-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 id="refund-title" className="text-sm font-bold text-ink">
                  Request refund
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Original fare: ₦{ride.fare.toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="rounded p-1 text-ink-muted hover:bg-surface-alt"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
              Amount
            </label>
            <input
              type="number"
              min={1}
              max={ride.fare}
              value={refundAmount}
              onChange={(e) => setRefundAmount(Number(e.target.value))}
              className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none"
            />

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
              Reason
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {REFUND_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRefundReason(r)}
                  className={`rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                    refundReason === r
                      ? 'border-emerald bg-emerald text-white'
                      : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>

            <textarea
              value={refundNote}
              onChange={(e) => setRefundNote(e.target.value)}
              rows={2}
              placeholder="Optional details for the finance team…"
              className="mb-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none resize-none"
            />

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRefundModalOpen(false)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRefundSubmit}
                disabled={refundAmount <= 0 || refundAmount > ride.fare}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50"
              >
                <Banknote size={12} />
                Submit refund
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* -------------------- Cancel modal -------------------- */}
      {cancelModalOpen ? (
        <div
          className="rdd-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-title"
          onClick={() => setCancelModalOpen(false)}
        >
          <div
            className="rdd-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 id="cancel-title" className="text-sm font-bold text-ink">
                  Request cancellation
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Ops team will review this active ride.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="rounded p-1 text-ink-muted hover:bg-surface-alt"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>

            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
              Reason (required)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Why should this active ride be cancelled?"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none resize-none"
            />

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCancelModalOpen(false)}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCancelSubmit}
                disabled={!cancelReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <Ban size={12} />
                Request cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  )
}

/* ==========================================================================
   KPI CARD
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
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center gap-2">
        <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${toneClass[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[9px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </div>
          <div className="text-sm font-bold text-ink tabular-nums truncate">
            {value}
          </div>
        </div>
      </div>
      <div className="mt-1 truncate text-[10px] text-ink-muted">{hint}</div>
    </div>
  )
}

/* ==========================================================================
   TABS
   ========================================================================== */

function OverviewTab({
  rideId,
  events,
  startedAt,
  completedAt,
  risk,
  flags,
}: {
  rideId: string
  events: RideEvent[]
  startedAt: string | null
  completedAt: string | null
  risk: RideRisk
  flags: RideFlag[]
}) {
  const duration =
    startedAt && completedAt
      ? Math.round(
          (new Date(completedAt).getTime() - new Date(startedAt).getTime()) /
            60000,
        )
      : null

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Events" value={events.length.toString()} />
        <Stat
          label="Trip duration"
          value={duration !== null ? `${duration} min` : '—'}
        />
        <Stat label="Avg per km" value="₦375" />
        <Stat
          label="Risk score"
          value={`${risk.score}/100`}
          tone={
            risk.tier === 'critical' || risk.tier === 'high'
              ? 'warning'
              : risk.tier === 'medium'
                ? 'warning'
                : 'success'
          }
        />
      </div>

      <div className="rounded-lg bg-surface-alt p-4 text-xs text-ink-secondary">
        <div className="font-semibold text-ink mb-1 flex items-center gap-1.5">
          <Sparkles size={12} aria-hidden="true" />
          Summary
        </div>
        <p className="leading-relaxed">
          Ride #{rideId.replace('rd_', '')} recorded {events.length} lifecycle
          events. {completedAt ? 'Completed successfully.' : 'Not yet completed.'}
          {flags.length > 0
            ? ` ${flags.length} admin flag${flags.length === 1 ? '' : 's'} under review.`
            : ''}
        </p>
      </div>

      <div>
        <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">
          Latest activity
        </h3>
        <div className="space-y-2">
          {events.slice(-3).map((e) => (
            <div key={e.id} className="flex items-center gap-3 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald flex-shrink-0" />
              <span className="font-medium text-ink truncate">{e.label}</span>
              <span className="text-ink-muted ml-auto whitespace-nowrap">
                {new Date(e.at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function RouteTab({ coords }: { coords: RideCoordinates }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Route map</h3>
        <RideRouteMap coords={coords} height="360px" />
      </div>

      <div className="rounded-lg bg-emerald-light border border-emerald/20 p-3 text-xs text-ink-secondary flex items-start gap-2">
        <Navigation
          size={14}
          className="text-emerald flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div>
          <strong className="text-ink">Live route reconstruction</strong> — map
          shows pickup, destination and driver start position. Real route
          polyline will be drawn when the backend streams geo traces.
        </div>
      </div>
    </div>
  )
}

function PaymentTab({
  fare,
  ride,
  refunds,
  canRefund,
  onRequestRefund,
}: {
  fare: RideFareBreakdown
  ride: Ride
  refunds: RideRefund[]
  canRefund: boolean
  onRequestRefund: () => void
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border divide-y divide-border">
        <PaymentRow label="Base fare" value={fare.baseFare} />
        <PaymentRow label="Distance charge" value={fare.distanceCharge} />
        <PaymentRow label="Time charge" value={fare.timeCharge} />
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-xs text-ink-secondary">CNG discount (10%)</span>
          <span className="text-xs font-medium text-emerald">
            -₦{fare.cngDiscount.toLocaleString()}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-light/40">
          <span className="text-sm font-semibold text-ink">Total charged</span>
          <span className="text-base font-bold text-emerald-dark">
            ₦{fare.total.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat
          label="Payment method"
          value={ride.paymentMethod === 'wallet' ? 'Wallet' : 'Cash'}
        />
        <Stat
          label="Status"
          value={ride.status === 'completed' ? 'Settled' : 'Pending'}
          tone={ride.status === 'completed' ? 'success' : 'warning'}
        />
      </div>

      <div className="rounded-lg bg-surface-alt p-4 text-xs text-ink-secondary">
        <div className="font-semibold text-ink mb-1">Reference</div>
        <div className="font-mono text-[11px] text-ink break-all">
          SR-RIDE-{ride.id.replace('rd_', '')}
        </div>
      </div>

      {/* Refund section */}
      {canRefund ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
          <div className="flex items-start gap-2">
            <Banknote size={14} className="mt-0.5 shrink-0 text-sky-600" aria-hidden="true" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-sky-800">
                Refund available
              </div>
              <p className="mt-0.5 text-[11px] text-sky-700/80">
                This ride completed without a refund. You can request a full or
                partial refund.
              </p>
            </div>
            <button
              type="button"
              onClick={onRequestRefund}
              className="shrink-0 rounded-md bg-sky-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-700 transition-colors"
            >
              Request refund
            </button>
          </div>
        </div>
      ) : null}

      {refunds.length > 0 ? (
        <div>
          <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">
            Refund history
          </h3>
          <div className="space-y-2">
            {refunds.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">
                      ₦{r.amount.toLocaleString()}
                    </div>
                    <div className="text-[11px] text-ink-secondary truncate">
                      {r.reason}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-sky-700">
                    {r.status}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-ink-muted">
                  Requested by {r.author} ·{' '}
                  {new Date(r.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function SosTab({
  sos,
  onAcknowledge,
  onResolve,
  onAddNote,
  noteDraft,
  onNoteDraftChange,
}: {
  sos: RideSosInfo
  onAcknowledge: () => void
  onResolve: () => void
  onAddNote: () => void
  noteDraft: string
  onNoteDraftChange: (v: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 text-danger flex items-center justify-center flex-shrink-0">
            <ShieldAlert size={16} aria-hidden="true" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">SOS Event</div>
            <div className="text-[11px] text-ink-secondary">
              Severity:{' '}
              <span className="uppercase font-semibold text-danger">
                {sos.severity}
              </span>
            </div>
          </div>
          <StatusBadge status={sos.resolvedAt ? 'success' : 'danger'}>
            {sos.resolvedAt ? 'Resolved' : 'Active'}
          </StatusBadge>
        </div>

        <div className="space-y-2 text-xs">
          <Row
            label="Triggered"
            value={new Date(sos.triggeredAt).toLocaleString()}
          />
          <Row label="Acknowledged by" value={sos.acknowledgedBy ?? 'Not yet'} />
          <Row label="Resolved by" value={sos.resolvedBy ?? 'Not yet'} />
          <Row
            label="Resolved at"
            value={
              sos.resolvedAt ? new Date(sos.resolvedAt).toLocaleString() : 'Pending'
            }
          />
        </div>

        {/* Action buttons */}
        {!sos.resolvedAt ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            {!sos.acknowledgedBy ? (
              <button
                type="button"
                onClick={onAcknowledge}
                className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition-colors"
              >
                <Check size={11} />
                Acknowledge
              </button>
            ) : null}
            <button
              type="button"
              onClick={onResolve}
              className="inline-flex items-center gap-1 rounded-md border border-emerald bg-emerald-light px-2.5 py-1 text-[11px] font-semibold text-emerald-dark hover:bg-emerald/20 transition-colors"
            >
              <CheckCircle2 size={11} />
              Mark resolved
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-emerald-light/40 px-2.5 py-1.5 text-[11px] text-emerald-dark">
            <CheckCircle2 size={11} aria-hidden="true" />
            SOS resolved by {sos.resolvedBy ?? 'admin'}
          </div>
        )}
      </div>

      {/* Notes */}
      <div>
        <h4 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">
          Notes ({sos.notes.length})
        </h4>
        {sos.notes.length > 0 ? (
          <div className="space-y-2">
            {sos.notes.map((n, i) => (
              <div
                key={i}
                className="rounded-lg bg-surface-alt p-3 text-xs text-ink-secondary"
              >
                {n}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg bg-surface-alt p-4 text-xs text-ink-secondary text-center">
            No notes recorded for this SOS event.
          </div>
        )}

        {/* Add note input */}
        {!sos.resolvedAt ? (
          <div className="mt-2 flex items-start gap-2">
            <textarea
              value={noteDraft}
              onChange={(e) => onNoteDraftChange(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onAddNote()
              }}
              rows={2}
              placeholder="Add a note to this SOS event…"
              className="flex-1 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none resize-none"
            />
            <button
              type="button"
              onClick={onAddNote}
              disabled={!noteDraft.trim()}
              className="shrink-0 inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50"
            >
              <Plus size={11} />
              Add
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function NotesTab({
  notes,
  draft,
  onDraftChange,
  onAdd,
  onDelete,
}: {
  notes: AdminNote[]
  draft: string
  onDraftChange: (v: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
        <label
          htmlFor="ride-admin-note"
          className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
        >
          Add a private admin note
        </label>
        <textarea
          id="ride-admin-note"
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onAdd()
          }}
          rows={3}
          placeholder="Notes are visible only to admins and stored locally in this browser."
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 resize-none"
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[10px] text-ink-muted">⌘/Ctrl + ↵ to save</span>
          <button
            type="button"
            onClick={onAdd}
            disabled={!draft.trim()}
            className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus size={11} aria-hidden="true" />
            Save note
          </button>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">
          No notes yet. Add one above.
        </p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className="group rounded-lg border border-border bg-surface p-3 hover:border-border-strong transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-xs text-ink leading-relaxed">
                    {n.body}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-muted">
                    <span>{n.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(n.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onDelete(n.id)}
                  aria-label="Delete note"
                  className="shrink-0 rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-red-50 hover:text-danger group-hover:opacity-100 focus:opacity-100"
                >
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AuditTab({ audit }: { audit: AuditEntry[] }) {
  if (audit.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="No admin actions yet"
        description="Every flag, refund, note, and export will appear here."
      />
    )
  }

  return (
    <ol className="relative space-y-3 pl-5">
      <span
        aria-hidden="true"
        className="absolute left-1.5 top-1 bottom-1 w-px bg-border"
      />
      {audit.map((entry) => {
        const tone =
          entry.action === 'sos_acknowledged' || entry.action === 'sos_resolved'
            ? 'danger'
            : entry.action === 'flag'
              ? 'warning'
              : entry.action === 'refund_request'
                ? 'info'
                : entry.action === 'cancel_request'
                  ? 'danger'
                  : 'default'
        return (
          <li key={entry.id} className="relative">
            <span
              className={`absolute -left-[13px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-surface ${
                tone === 'danger'
                  ? 'bg-red-500'
                  : tone === 'warning'
                    ? 'bg-amber-500'
                    : tone === 'info'
                      ? 'bg-sky-500'
                      : 'bg-emerald'
              }`}
              aria-hidden="true"
            />
            <div className="text-xs font-semibold text-ink">
              {entry.description}
            </div>
            <div className="mt-0.5 text-[10px] text-ink-muted">
              {entry.actor} · {new Date(entry.at).toLocaleString()}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className="text-xs font-medium text-ink truncate">{value}</span>
    </div>
  )
}

function PaymentRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className="text-xs text-ink font-medium">
        ₦{value.toLocaleString()}
      </span>
    </div>
  )
}

function Stat({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: string
  tone?: 'default' | 'warning' | 'success'
}) {
  const color =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'success'
        ? 'text-emerald'
        : 'text-ink'
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">
        {label}
      </div>
      <div className={'text-base font-bold truncate ' + color}>{value}</div>
    </div>
  )
}