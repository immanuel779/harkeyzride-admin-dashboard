import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileJson,
  FileText,
  FileWarning,
  Image as ImageIcon,
  LifeBuoy,
  Mail,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Route as RouteIcon,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  UserX,
  Wallet,
  X,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal' // ← NEW
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { Tabs, type TabItem } from '../../../components/shared/Tabs'
import { BRAND } from '../../../config/brand' // ← NEW
import { toast } from '../../../lib/toast'
import { useReinstateRider, useRider, useSuspendRider } from '../../../hooks/queries/useRiders'
import {
  getRiderTrips,
  getSupportTickets,
  getWalletTransactions,
  updateTicketStatusApi,
  type Rider,
  type RiderStatus,
  type RiderTrip,
  type SupportTicket,
  type WalletTransaction,
} from '../data/mockRiders'

// ← NEW: KYC module
import {
  DOCUMENT_STATUS_META as KYC_STATUS_META,
  DOCUMENT_TYPE_META as KYC_TYPE_META,
  approveDocument as approveKycDoc,
  daysUntil,
  formatBytes,
  formatDate,
  getEntityKYC,
  isExpiringSoon,
  rejectDocument as rejectKycDoc,
  type Document as KycDocument,
} from '../../documents/data/mockDocuments'

/* ==========================================================================
   CONFIG (unchanged)
   ========================================================================== */

const STATUS_MAP: Record<
  RiderStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  nin_pending: { label: 'NIN Pending', tone: 'warning' },
}

const TICKET_STATUS_MAP: Record<
  SupportTicket['status'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
> = {
  open: { label: 'Open', tone: 'danger' },
  in_progress: { label: 'In Progress', tone: 'info' },
  resolved: { label: 'Resolved', tone: 'success' },
  closed: { label: 'Closed', tone: 'neutral' },
}

const PRIORITY_MAP: Record<
  SupportTicket['priority'],
  { label: string; tone: 'danger' | 'warning' | 'info' | 'neutral' }
> = {
  urgent: { label: 'Urgent', tone: 'danger' },
  high: { label: 'High', tone: 'warning' },
  normal: { label: 'Normal', tone: 'info' },
  low: { label: 'Low', tone: 'neutral' },
}

const LOW_RATING_THRESHOLD = 3.5
const LOW_WALLET_THRESHOLD = 500
const HIGH_WALLET_THRESHOLD = 20000
const SLA_HOURS = 24

const NOTES_KEY_PREFIX = 'hr.rider.notes.'
const MAX_NOTES = 100

const ANIMATIONS = `
  @keyframes rd-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes rd-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes rd-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes rd-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes rd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes rd-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .rd-fade-up { animation: rd-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .rd-fade-in { animation: rd-fade-in .2s ease both; }
  .rd-slide-in { animation: rd-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .rd-pop { animation: rd-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .rd-pulse { animation: rd-pulse 1.5s ease-in-out infinite; }
  .rd-shimmer { position: relative; overflow: hidden; }
  .rd-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .rd-shimmer:hover::after { animation: rd-shimmer 1s ease; }
  .rd-stagger > * { animation: rd-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .rd-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .rd-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .rd-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .rd-stagger > *:nth-child(4) { animation-delay: 180ms; }
  @media (prefers-reduced-motion: reduce) {
    .rd-fade-up, .rd-fade-in, .rd-slide-in, .rd-pop, .rd-pulse,
    .rd-stagger > *, .rd-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   TYPES
   ========================================================================== */

type TabId = 'profile' | 'rides' | 'wallet' | 'support' | 'documents' | 'activity' | 'notes' // ← NEW: 'documents'

type RiskTier = 'low' | 'medium' | 'high'

type AdminNote = {
  id: string
  body: string
  createdAt: number
  author: string
}

type TripStatusFilter = 'all' | 'completed' | 'cancelled' | 'in_progress'

type WalletFilter = 'all' | 'credit' | 'debit'

// ← NEW: preview model
type PreviewDoc = {
  id: string
  title: string
  fileName: string
  fileUrl: string
  mimeType: string
  sizeBytes: number | null
  uploadedAt: string
  status: 'approved' | 'pending' | 'rejected' | 'expired'
  statusLabel: string
  statusTone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  reviewNote: string | null
  documentNumber: string | null
  expiresAt: string | null
}

// ← NEW: decision intent
type DecisionIntent = 'reinstate' | 'activate' | 'suspend'

/* ==========================================================================
   HELPERS
   ========================================================================== */

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function formatRelativeTime(iso: string | number): string {
  const t = typeof iso === 'number' ? iso : Date.parse(iso)
  if (Number.isNaN(t)) return String(iso)
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

function computeRisk(rider: {
  status: RiderStatus
  rating: number
  totalRides: number
  walletBalance: number
  nin?: string | null
}, tickets: SupportTicket[]): { score: number; tier: RiskTier; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  if (rider.status === 'suspended') {
    score += 40
    reasons.push('Currently suspended')
  }
  if (rider.status === 'nin_pending' || !rider.nin) {
    score += 25
    reasons.push('NIN not verified')
  }
  if (rider.rating < LOW_RATING_THRESHOLD && rider.totalRides >= 3) {
    score += 20
    reasons.push(`Low rating (${rider.rating.toFixed(1)}★)`)
  }
  const urgent = tickets.filter(
    (t) =>
      (t.status === 'open' || t.status === 'in_progress') && t.priority === 'urgent',
  ).length
  if (urgent > 0) {
    score += 15
    reasons.push(`${urgent} urgent ticket${urgent === 1 ? '' : 's'}`)
  }
  if (rider.walletBalance < LOW_WALLET_THRESHOLD && rider.totalRides > 0) {
    score += 10
    reasons.push('Low wallet balance')
  }
  if (rider.walletBalance >= HIGH_WALLET_THRESHOLD) {
    score += 5
    reasons.push('High-value wallet')
  }

  score = Math.min(100, score)
  const tier: RiskTier = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return { score, tier, reasons }
}

function loadNotes(riderId: string): AdminNote[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY_PREFIX + riderId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.slice(0, MAX_NOTES)
  } catch {
    return []
  }
}

function persistNotes(riderId: string, notes: AdminNote[]): void {
  try {
    window.localStorage.setItem(
      NOTES_KEY_PREFIX + riderId,
      JSON.stringify(notes.slice(0, MAX_NOTES)),
    )
  } catch {
    /* storage unavailable */
  }
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

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ← NEW: convert KYC doc to unified preview model
function toPreviewFromKyc(doc: KycDocument): PreviewDoc {
  return {
    id: doc.id,
    title: KYC_TYPE_META[doc.type]?.label ?? doc.type,
    fileName: doc.fileUrl.split('/').pop() ?? String(doc.type),
    fileUrl: doc.fileUrl,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    uploadedAt: doc.submittedAt,
    status: doc.status === 'expired' ? 'expired' : (doc.status as PreviewDoc['status']),
    statusLabel: KYC_STATUS_META[doc.status].label,
    statusTone: KYC_STATUS_META[doc.status].tone,
    reviewNote: doc.notes,
    documentNumber: doc.documentNumber,
    expiresAt: doc.expiresAt,
  }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function RiderDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const { data: rider, isLoading, isError, error, refetch } = useRider(id)
  const suspend = useSuspendRider()
  const reinstate = useReinstateRider()

  const [tab, setTab] = useState<TabId>('profile')
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null)
  const [notes, setNotes] = useState<AdminNote[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [showActions, setShowActions] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [copied, setCopied] = useState(false)

  // ← NEW state
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null)
  const [kycVersion, setKycVersion] = useState(0)
  const [decision, setDecision] = useState<DecisionIntent | null>(null)
  const [activating, setActivating] = useState(false)

  const actionsRef = useRef<HTMLDivElement | null>(null)
  const copiedTimerRef = useRef<number | null>(null)

  const trips = useMemo(() => (id ? getRiderTrips(id) : []), [id])
  const walletTxns = useMemo(() => (id ? getWalletTransactions(id) : []), [id])
  const effectiveTickets = tickets ?? (id ? getSupportTickets(id) : [])

  // ← NEW: KYC state
  const kyc = useMemo(
    () => (id ? getEntityKYC('rider', id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, kycVersion],
  )
  const kycDocs = kyc?.documents ?? []
  const pendingKyc = kyc?.pendingCount ?? 0
  const rejectedKyc = kyc?.rejectedCount ?? 0
  const approvedKyc = kyc?.approvedCount ?? 0
  const verifiedKyc = kyc?.kycStatus === 'verified'

  /* --------------------------- derived --------------------------- */

  const openTickets = effectiveTickets.filter(
    (t) => t.status === 'open' || t.status === 'in_progress',
  ).length

  const risk = useMemo(
    () =>
      rider
        ? computeRisk(
            {
              status: rider.status,
              rating: rider.rating,
              totalRides: rider.totalRides,
              walletBalance: rider.walletBalance,
              nin: rider.nin,
            },
            effectiveTickets,
          )
        : null,
    [rider, effectiveTickets],
  )

  const verificationChecks = useMemo(() => {
    if (!rider) return []
    return [
      { label: 'NIN verified', ok: !!rider.nin },
      { label: 'Active status', ok: rider.status === 'active' },
      { label: 'Contact verified', ok: !!rider.phone && !!rider.email },
      { label: 'KYC documents verified', ok: verifiedKyc }, // ← NEW
      { label: 'Completed first ride', ok: rider.totalRides > 0 },
    ]
  }, [rider, verifiedKyc])

  const tabs: TabItem<TabId>[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'rides', label: 'Rides', icon: RouteIcon, badge: trips.length },
    { id: 'wallet', label: 'Wallet', icon: Wallet },
    { id: 'support', label: 'Support', icon: LifeBuoy, badge: openTickets },
    { id: 'documents', label: 'Documents', icon: FileCheck, badge: pendingKyc || undefined }, // ← NEW
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: notes.length || undefined },
  ]

  /* --------------------------- effects --------------------------- */

  useEffect(() => {
    if (!id) return
    setNotes(loadNotes(id))
  }, [id])

  useEffect(() => {
    if (!showActions) return
    const handler = (e: MouseEvent) => {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setShowActions(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showActions])

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // ← NEW: Esc closes preview → decision → actions menu in that order
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (previewDoc) {
          setPreviewDoc(null)
          return
        }
        if (decision) {
          setDecision(null)
          return
        }
        setShowActions(false)
        return
      }

      if (inField) return
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportJSON()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rider, trips, walletTxns, effectiveTickets, notes, previewDoc, decision])

  /* --------------------------- handlers -------------------------- */

  const handleTicketStatus = async (
    ticketId: string,
    status: SupportTicket['status'],
  ) => {
    try {
      await updateTicketStatusApi(ticketId, status)
      const next = effectiveTickets.map((t) =>
        t.id === ticketId
          ? { ...t, status, updatedAt: new Date().toISOString() }
          : t,
      )
      setTickets(next)
      toast.success('Ticket updated', `Marked as ${status.replace('_', ' ')}.`)
    } catch (e) {
      toast.error('Could not update ticket', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setKycVersion((v) => v + 1)
      if (id) setNotes(loadNotes(id))
    } finally {
      setRefreshing(false)
    }
  }, [refetch, id])

  const handleSuspend = useCallback(async () => {
    if (!rider) return
    try {
      await suspend.mutateAsync(rider.id)
      toast.error(`${rider.name} suspended`, 'Rider cannot book rides until reinstated.')
    } catch (e) {
      toast.error('Suspend failed', e instanceof Error ? e.message : 'Try again.')
    }
  }, [rider, suspend])

  const handleReinstate = useCallback(async () => {
    if (!rider) return
    try {
      await reinstate.mutateAsync(rider.id)
      toast.success(`${rider.name} reinstated`, 'Full access restored.')
    } catch (e) {
      toast.error('Reinstate failed', e instanceof Error ? e.message : 'Try again.')
    }
  }, [rider, reinstate])

  // ← NEW: approve a single KYC document
  const handleKycApprove = useCallback(
    async (docId: string) => {
      try {
        await approveKycDoc(docId, 'Admin')
        setKycVersion((v) => v + 1)
        toast.success('Document approved', 'KYC document marked as approved.')
        // Refresh open preview to reflect new status
        if (previewDoc?.id === docId) {
          const fresh = getEntityKYC('rider', id!)?.documents.find((d) => d.id === docId)
          if (fresh) setPreviewDoc(toPreviewFromKyc(fresh))
        }
      } catch (e) {
        toast.error('Approve failed', e instanceof Error ? e.message : 'Try again.')
      }
    },
    [id, previewDoc],
  )

  // ← NEW: reject a single KYC document
  const handleKycReject = useCallback(
    async (docId: string) => {
      try {
        await rejectKycDoc(docId, 'Admin', 'Document unclear — please re-upload')
        setKycVersion((v) => v + 1)
        toast.warning('Document rejected', 'Rider will be notified to re-upload.')
        if (previewDoc?.id === docId) {
          const fresh = getEntityKYC('rider', id!)?.documents.find((d) => d.id === docId)
          if (fresh) setPreviewDoc(toPreviewFromKyc(fresh))
        }
      } catch (e) {
        toast.error('Reject failed', e instanceof Error ? e.message : 'Try again.')
      }
    },
    [id, previewDoc],
  )

  // ← NEW: approve all pending KYC + activate rider (for nin_pending)
  const handleActivateRider = useCallback(async () => {
    if (!rider || !id) return
    setActivating(true)
    try {
      const pending = getEntityKYC('rider', id)?.documents.filter((d) => d.status === 'pending') ?? []
      for (const d of pending) {
        await approveKycDoc(d.id, 'Admin')
      }
      await reinstate.mutateAsync(rider.id)
      setKycVersion((v) => v + 1)
      setDecision(null)
      toast.success(`${rider.name} activated`, 'KYC approved and rider is now live.')
    } catch (e) {
      toast.error('Activation failed', e instanceof Error ? e.message : 'Try again.')
    } finally {
      setActivating(false)
    }
  }, [rider, id, reinstate])

  const handleCopySummary = useCallback(async () => {
    if (!rider || !risk) return
    const text = [
      `Rider: ${rider.name}`,
      `Status: ${STATUS_MAP[rider.status].label}`,
      `Phone: ${rider.phone}`,
      `Email: ${rider.email}`,
      `City: ${rider.city}`,
      `NIN: ${rider.nin ?? '—'}`,
      `Wallet: ${formatNaira(rider.walletBalance)}`,
      `Rides: ${rider.totalRides}`,
      `Rating: ${rider.rating.toFixed(1)} ★`,
      `Joined: ${rider.joinedAt}`,
      `Risk: ${risk.tier.toUpperCase()} (${risk.score}/100)`,
      `KYC: ${kyc?.kycStatus ?? 'not_started'} (${approvedKyc}/${kycDocs.length})`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [rider, risk, kyc, approvedKyc, kycDocs.length])

  const handleExportJSON = useCallback(() => {
    if (!rider) return
    const payload = {
      generatedAt: new Date().toISOString(),
      rider,
      risk,
      verification: verificationChecks,
      kyc: kyc
        ? {
            kycStatus: kyc.kycStatus,
            progressPct: kyc.progressPct,
            documents: kyc.documents,
            missingTypes: kyc.missingTypes,
          }
        : null,
      trips,
      walletTxns,
      tickets: effectiveTickets,
      notes,
      summary: {
        totalTrips: trips.length,
        completedTrips: trips.filter((t) => t.status === 'completed').length,
        totalSpent: trips.filter((t) => t.status === 'completed').reduce((s, t) => s + t.fare, 0),
        openTickets,
        totalCredits: walletTxns.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
        totalDebits: walletTxns.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0),
      },
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadFile(
      JSON.stringify(payload, null, 2),
      `rider-${rider.id}-${ts}.json`,
      'application/json',
    )
    toast.success('Export ready', 'Rider data downloaded as JSON.')
  }, [rider, risk, verificationChecks, kyc, trips, walletTxns, effectiveTickets, notes, openTickets])

  const handleAddNote = useCallback(() => {
    if (!id || !noteDraft.trim()) return
    const note: AdminNote = {
      id: uid(),
      body: noteDraft.trim(),
      createdAt: Date.now(),
      author: 'Admin',
    }
    const next = [note, ...notes].slice(0, MAX_NOTES)
    setNotes(next)
    persistNotes(id, next)
    setNoteDraft('')
    toast.success('Note saved')
  }, [id, noteDraft, notes])

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      if (!id) return
      const next = notes.filter((n) => n.id !== noteId)
      setNotes(next)
      persistNotes(id, next)
    },
    [id, notes],
  )

  /* ---------------------------- loading -------------------------- */

  if (isLoading) {
    return (
      <AppShell title="Rider Detail">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 rounded-xl bg-surface border border-border p-6 space-y-3">
            <div className="flex items-center gap-3 mb-4">
              <Skeleton variant="circle" className="w-14 h-14" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
          <div className="lg:col-span-2 rounded-xl bg-surface border border-border p-6">
            <Skeleton className="h-4 w-40 mb-4" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      </AppShell>
    )
  }

  if (isError || !rider) {
    return (
      <AppShell title="Rider Detail">
        <div className="rounded-xl bg-surface border border-border">
          {isError ? (
            <ErrorState
              title="Could not load rider"
              description={error instanceof Error ? error.message : 'Please try again.'}
              onRetry={() => refetch()}
            />
          ) : (
            <EmptyState
              icon={UserX}
              title="Rider not found"
              description={`No rider matches ID: ${id}`}
              action={
                <button
                  type="button"
                  onClick={() => navigate('/riders')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-dark transition-colors"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to riders
                </button>
              }
            />
          )}
        </div>
      </AppShell>
    )
  }

  const cfg = STATUS_MAP[rider.status]
  const isSuspended = rider.status === 'suspended'
  const isNinPending = rider.status === 'nin_pending'
  const canReinstate = isSuspended
  const canActivate = isNinPending && pendingKyc === 0 // all docs reviewed
  const canSuspend = rider.status === 'active'

  /* ---------------------------- render --------------------------- */

  return (
    <AppShell title="Rider Detail">
      <style>{ANIMATIONS}</style>

      {/* -------------------- Top bar -------------------- */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate('/riders')}
          className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to riders
        </button>

        <div className="flex flex-wrap items-center gap-1.5 rd-fade-up">
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
            title="Export (Ctrl/Cmd + E)"
            className="rd-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            Export
          </button>

          {/* ← UPDATED: nin_pending now offers "Approve & Activate" */}
          {isSuspended ? (
            <button
              type="button"
              onClick={() => setDecision('reinstate')}
              disabled={reinstate.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50"
            >
              <RotateCcw size={12} aria-hidden="true" />
              Reinstate
            </button>
          ) : isNinPending ? (
            <button
              type="button"
              onClick={() => setDecision('activate')}
              disabled={pendingKyc > 0}
              title={pendingKyc > 0 ? `Review ${pendingKyc} pending document${pendingKyc === 1 ? '' : 's'} first` : 'Approve KYC and activate rider'}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck size={12} aria-hidden="true" />
              Verify & Activate
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDecision('suspend')}
              disabled={suspend.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <Ban size={12} aria-hidden="true" />
              Suspend
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* -------------------- Left sidebar -------------------- */}
        <div className="lg:col-span-1 space-y-4">
          {/* Identity card */}
          <div className="rounded-xl bg-surface border border-border p-6 rd-fade-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-emerald text-white flex items-center justify-center text-lg font-bold">
                {rider.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink truncate">
                  {rider.name}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
                  {risk ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rd-pop ${
                        risk.tier === 'high'
                          ? 'bg-red-50 text-danger'
                          : risk.tier === 'medium'
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-light text-emerald-dark'
                      }`}
                      title={risk.reasons.join(' · ') || 'No risk factors'}
                    >
                      <ShieldAlert size={9} aria-hidden="true" />
                      {risk.tier} risk
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            <dl className="space-y-3 text-sm">
              <SidebarField
                label="Phone"
                value={rider.phone}
                copyable
                icon={<Phone size={11} />}
              />
              <SidebarField
                label="Email"
                value={rider.email}
                copyable
                icon={<Mail size={11} />}
              />
              <SidebarField label="City" value={rider.city} />
              <SidebarField
                label="NIN"
                value={rider.nin ?? '—'}
                mono
                icon={
                  rider.nin ? (
                    <ShieldCheck size={11} className="text-emerald" />
                  ) : (
                    <AlertTriangle size={11} className="text-amber-500" />
                  )
                }
              />
              <SidebarField label="Joined" value={rider.joinedAt} />
            </dl>
          </div>

          {/* KPI snapshot */}
          <div className="rounded-xl bg-surface border border-border p-5 space-y-3 rd-fade-up">
            <KpiRow label="Wallet" value={formatNaira(rider.walletBalance)} />
            <KpiRow label="Total rides" value={String(rider.totalRides)} />
            <KpiRow
              label="Rating"
              value={
                <span className="inline-flex items-center gap-1">
                  <Star size={14} className="text-amber-500 fill-amber-500" aria-hidden="true" />
                  {rider.rating.toFixed(1)}
                </span>
              }
            />
            <KpiRow label="Open tickets" value={String(openTickets)} />
          </div>

          {/* ← NEW: KYC progress card */}
          {kyc ? (
            <div className="rounded-xl bg-surface border border-border p-5 rd-fade-up">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={13} className="text-ink-muted" aria-hidden="true" />
                  <h3 className="text-xs font-semibold text-ink">KYC progress</h3>
                </div>
                <span className="text-[11px] font-bold text-ink tabular-nums">
                  {kyc.progressPct}%
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-alt mb-3">
                <div
                  className={`rd-pop absolute inset-y-0 left-0 rounded-full ${
                    verifiedKyc
                      ? 'bg-emerald'
                      : rejectedKyc > 0
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${kyc.progressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-emerald-light/40 px-1 py-1.5">
                  <div className="text-sm font-bold text-emerald-dark">{approvedKyc}</div>
                  <div className="text-[9px] uppercase tracking-wide text-emerald-dark/70">Approved</div>
                </div>
                <div className="rounded-md bg-amber-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-amber-700">{pendingKyc}</div>
                  <div className="text-[9px] uppercase tracking-wide text-amber-700/70">Pending</div>
                </div>
                <div className="rounded-md bg-red-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-danger">{rejectedKyc}</div>
                  <div className="text-[9px] uppercase tracking-wide text-danger/70">Rejected</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTab('documents')}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
              >
                <FileCheck size={11} aria-hidden="true" />
                Review documents
              </button>
            </div>
          ) : null}

          {/* Risk breakdown */}
          {risk ? (
            <div className="rounded-xl bg-surface border border-border p-5 rd-fade-up">
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
                  className={`rd-pop absolute inset-y-0 left-0 rounded-full ${
                    risk.tier === 'high'
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
                  {risk.reasons.slice(0, 4).map((r) => (
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
          ) : null}

          {/* Verification checklist */}
          <div className="rounded-xl bg-surface border border-border p-5 rd-fade-up">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={13} className="text-ink-muted" aria-hidden="true" />
              <h3 className="text-xs font-semibold text-ink">Verification</h3>
            </div>
            <ul className="space-y-1.5">
              {verificationChecks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-[11px]">
                  {c.ok ? (
                    <CheckCircle2 size={12} className="text-emerald shrink-0" aria-hidden="true" />
                  ) : (
                    <AlertCircle size={12} className="text-amber-500 shrink-0" aria-hidden="true" />
                  )}
                  <span className={c.ok ? 'text-ink-secondary' : 'text-ink'}>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* ← NEW: Decision card — unifies reinstate / activate / suspend */}
          <div className="rounded-xl bg-surface border border-border p-5 rd-fade-up">
            <div className="text-sm font-medium text-ink mb-1">
              {isSuspended
                ? 'Reinstatement'
                : isNinPending
                  ? 'Activation'
                  : 'Account status'}
            </div>
            <div className="text-xs text-ink-secondary mb-3">
              {isSuspended
                ? 'Rider was suspended. Reinstate to restore access.'
                : isNinPending
                  ? pendingKyc > 0
                    ? `${pendingKyc} document${pendingKyc === 1 ? '' : 's'} still pending review.`
                    : 'All documents reviewed. Activate to allow bookings.'
                  : 'Rider is active and can book rides.'}
            </div>

            {isSuspended ? (
              <button
                type="button"
                onClick={() => setDecision('reinstate')}
                disabled={reinstate.isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reinstate rider
              </button>
            ) : isNinPending ? (
              <button
                type="button"
                onClick={() => setDecision('activate')}
                disabled={pendingKyc > 0 || activating}
                title={
                  pendingKyc > 0
                    ? `Approve ${pendingKyc} pending document${pendingKyc === 1 ? '' : 's'} first`
                    : 'Approve KYC and activate rider'
                }
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {activating ? (
                  <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ShieldCheck size={14} aria-hidden="true" />
                )}
                Approve KYC & activate
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setDecision('suspend')}
                disabled={suspend.isPending}
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-500 px-3 py-2 text-xs font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <Ban size={14} aria-hidden="true" />
                Suspend rider
              </button>
            )}
          </div>
        </div>

        {/* -------------------- Right tabbed content -------------------- */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-surface border border-border overflow-hidden rd-fade-up">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />

            <div className="p-6">
              {tab === 'profile' ? (
                <ProfileTab
                  rider={rider}
                  trips={trips}
                  risk={risk}
                  tickets={effectiveTickets}
                />
              ) : null}

              {tab === 'rides' ? <RidesTab trips={trips} /> : null}

              {tab === 'wallet' ? (
                <WalletTab
                  transactions={walletTxns}
                  balance={rider.walletBalance}
                />
              ) : null}

              {tab === 'support' ? (
                <SupportTab
                  tickets={effectiveTickets}
                  onStatusChange={handleTicketStatus}
                />
              ) : null}

              {/* ← NEW: Documents tab */}
              {tab === 'documents' ? (
                <DocumentsTab
                  kyc={kyc}
                  onPreview={(doc) => setPreviewDoc(doc)}
                  onApprove={handleKycApprove}
                  onReject={handleKycReject}
                  riderStatus={rider.status}
                  onActivate={() => setDecision('activate')}
                  pendingKyc={pendingKyc}
                />
              ) : null}

              {tab === 'activity' ? (
                <ActivityTab
                  trips={trips}
                  walletTxns={walletTxns}
                  tickets={effectiveTickets}
                  notes={notes}
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
            </div>
          </div>
        </div>
      </div>

      {/* -------------------- ← NEW: Document preview modal -------------------- */}
      {previewDoc ? (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onApprove={() => handleKycApprove(previewDoc.id)}
          onReject={() => handleKycReject(previewDoc.id)}
        />
      ) : null}

      {/* -------------------- ← NEW: Decision confirm modal -------------------- */}
      <ConfirmModal
        open={decision !== null}
        title={
          decision === 'reinstate'
            ? `Reinstate ${rider.name}?`
            : decision === 'activate'
              ? `Approve KYC & activate ${rider.name}?`
              : decision === 'suspend'
                ? `Suspend ${rider.name}?`
                : ''
        }
        description={
          decision === 'reinstate'
            ? `${rider.name} will regain full access to book rides on ${BRAND.name}.`
            : decision === 'activate'
              ? pendingKyc > 0
                ? `Approve ${pendingKyc} pending KYC document${pendingKyc === 1 ? '' : 's'} and activate rider. Continue?`
                : `${rider.name} will be activated and can start booking rides on ${BRAND.name}.`
              : 'Rider will not be able to book rides until reinstated. They will be notified.'
        }
        confirmLabel={
          decision === 'reinstate'
            ? 'Reinstate'
            : decision === 'activate'
              ? 'Approve & activate'
              : 'Suspend'
        }
        variant={decision === 'suspend' ? 'danger' : 'primary'}
        loading={
          decision === 'reinstate'
            ? reinstate.isPending
            : decision === 'activate'
              ? activating
              : suspend.isPending
        }
        onConfirm={async () => {
          if (decision === 'reinstate') {
            await handleReinstate()
            setDecision(null)
          } else if (decision === 'activate') {
            await handleActivateRider()
          } else if (decision === 'suspend') {
            await handleSuspend()
            setDecision(null)
          }
        }}
        onClose={() => {
          if (activating || reinstate.isPending || suspend.isPending) return
          setDecision(null)
        }}
      />
    </AppShell>
  )
}

/* ==========================================================================
   ← NEW: DocumentPreviewModal (same pattern as Driver)
   ========================================================================== */

function DocumentPreviewModal({
  doc,
  onClose,
  onApprove,
  onReject,
}: {
  doc: PreviewDoc
  onClose: () => void
  onApprove: () => void
  onReject: () => void
}) {
  const isImage = doc.mimeType.startsWith('image/')
  const isPdf = doc.mimeType === 'application/pdf'
  const canReview = doc.status === 'pending'
  const [imgError, setImgError] = useState(false)

  const sizeLabel = doc.sizeBytes != null ? formatBytes(doc.sizeBytes) : null
  const expiryDays = doc.expiresAt ? daysUntil(doc.expiresAt) : null

  return (
    <div
      className="rd-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={onClose}
    >
      <div
        className="rd-pop flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id="doc-preview-title" className="truncate text-sm font-bold text-ink">
                {doc.title}
              </h2>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  doc.statusTone === 'success'
                    ? 'bg-emerald-light text-emerald-dark'
                    : doc.statusTone === 'danger'
                      ? 'bg-red-50 text-danger'
                      : doc.statusTone === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-surface-alt text-ink-secondary'
                }`}
              >
                {doc.statusLabel}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              {doc.fileName}
              {sizeLabel ? ` · ${sizeLabel}` : ''}
              {' · uploaded '}
              {formatRelativeTime(doc.uploadedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
            aria-label="Close preview"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto bg-surface-alt/40 p-4">
          <div className="flex min-h-[360px] items-center justify-center rounded-lg border border-dashed border-border bg-surface overflow-hidden">
            {isImage && doc.fileUrl && !imgError ? (
              <img
                src={doc.fileUrl}
                alt={doc.title}
                className="max-h-[60vh] w-auto max-w-full object-contain"
                onError={() => setImgError(true)}
              />
            ) : isPdf && doc.fileUrl ? (
              <object
                data={doc.fileUrl}
                type="application/pdf"
                className="h-[60vh] w-full"
                aria-label={doc.title}
              >
                <div className="flex flex-col items-center justify-center gap-2 p-6 text-center">
                  <FileText size={48} className="text-ink-muted/60" />
                  <p className="text-xs text-ink-secondary">
                    PDF preview not available in this browser.
                  </p>
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald hover:text-emerald-dark"
                  >
                    <ExternalLink size={11} />
                    Open PDF in new tab
                  </a>
                </div>
              </object>
            ) : (
              <div className="p-8 text-center">
                {isImage ? (
                  <ImageIcon size={48} className="mx-auto mb-3 text-ink-muted/60" />
                ) : (
                  <FileText size={48} className="mx-auto mb-3 text-ink-muted/60" />
                )}
                <p className="text-sm font-medium text-ink">
                  {doc.fileUrl ? 'Preview unavailable' : 'No file attached'}
                </p>
                <p className="mt-1 max-w-md text-xs text-ink-muted">
                  {doc.fileUrl
                    ? 'The file could not be loaded inline. Try opening it directly.'
                    : 'This document does not have a viewable file yet. Ask the rider to re-upload it.'}
                </p>
                {doc.fileUrl ? (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex items-center gap-1 rounded-md bg-emerald px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors"
                  >
                    <ExternalLink size={11} />
                    Open original
                  </a>
                ) : null}
              </div>
            )}
          </div>

          {/* Metadata strip */}
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-border bg-surface p-3 text-[11px] sm:grid-cols-2">
            {doc.documentNumber ? (
              <div>
                <span className="font-semibold text-ink-muted">Number: </span>
                <span className="font-mono text-ink">{doc.documentNumber}</span>
              </div>
            ) : null}
            {doc.expiresAt ? (
              <div>
                <span className="font-semibold text-ink-muted">Expires: </span>
                <span
                  className={
                    expiryDays != null && expiryDays < 0
                      ? 'font-semibold text-danger'
                      : expiryDays != null && expiryDays <= 30
                        ? 'font-semibold text-amber-700'
                        : 'text-ink'
                  }
                >
                  {formatDate(doc.expiresAt)}
                  {expiryDays != null
                    ? ` (${expiryDays < 0 ? 'expired' : `${expiryDays}d left`})`
                    : ''}
                </span>
              </div>
            ) : null}
            {doc.reviewNote ? (
              <div className="sm:col-span-2">
                <span className="font-semibold text-ink-muted">Review note: </span>
                <span className="text-ink-secondary">{doc.reviewNote}</span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <div className="flex items-center gap-1.5">
            {doc.fileUrl ? (
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
              >
                <ExternalLink size={11} aria-hidden="true" />
                Open
              </a>
            ) : null}
            {doc.fileUrl ? (
              <a
                href={doc.fileUrl}
                download={doc.fileName}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
              >
                <Download size={11} aria-hidden="true" />
                Download
              </a>
            ) : null}
          </div>

          {canReview ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onReject}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-red-100 transition-colors"
              >
                <X size={11} aria-hidden="true" />
                Reject
              </button>
              <button
                type="button"
                onClick={onApprove}
                className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors"
              >
                <Check size={11} aria-hidden="true" />
                Approve
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:text-ink transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   ← NEW: DocumentsTab
   ========================================================================== */

function DocumentsTab({
  kyc,
  onPreview,
  onApprove,
  onReject,
  riderStatus,
  onActivate,
  pendingKyc,
}: {
  kyc: ReturnType<typeof getEntityKYC>
  onPreview: (doc: PreviewDoc) => void
  onApprove: (docId: string) => Promise<void>
  onReject: (docId: string) => Promise<void>
  riderStatus: RiderStatus
  onActivate: () => void
  pendingKyc: number
}) {
  if (!kyc || kyc.documents.length === 0) {
    return (
      <EmptyState
        icon={FileCheck}
        title="No KYC documents on file"
        description="This rider hasn't submitted any verification documents yet."
      />
    )
  }

  const canActivate = riderStatus === 'nin_pending' && pendingKyc === 0

  return (
    <div className="space-y-4">
      {/* Status header */}
      <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
              <ShieldCheck size={14} className="text-emerald" aria-hidden="true" />
              KYC Documents ({kyc.documents.length})
            </h3>
            <p className="mt-0.5 text-xs text-ink-secondary">
              {kyc.approvedCount}/{kyc.documents.length} approved · {kyc.progressPct}% complete
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              kyc.kycStatus === 'verified'
                ? 'bg-emerald-light text-emerald-dark'
                : kyc.kycStatus === 'rejected' || kyc.kycStatus === 'expired'
                  ? 'bg-red-50 text-danger'
                  : 'bg-amber-50 text-amber-700'
            }`}
          >
            {kyc.kycStatus.replace('_', ' ')}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface">
          <div
            className={`h-full rounded-full transition-all ${
              kyc.kycStatus === 'verified'
                ? 'bg-emerald'
                : kyc.kycStatus === 'rejected' || kyc.kycStatus === 'expired'
                  ? 'bg-red-500'
                  : 'bg-amber-500'
            }`}
            style={{ width: `${kyc.progressPct}%` }}
          />
        </div>
      </div>

      {/* Missing types */}
      {kyc.missingTypes.length > 0 ? (
        <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
          <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-semibold">Missing: </span>
            {kyc.missingTypes.map((t) => KYC_TYPE_META[t].shortLabel).join(', ')}
          </span>
        </div>
      ) : null}

      {/* Document list — every row clickable */}
      <div className="space-y-2">
        {kyc.documents.map((d) => {
          const cfg = KYC_STATUS_META[d.status]
          const expiring = isExpiringSoon(d)
          return (
            <div
              key={d.id}
              role="button"
              tabIndex={0}
              onClick={() => onPreview(toPreviewFromKyc(d))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onPreview(toPreviewFromKyc(d))
                }
              }}
              className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-emerald/60 hover:bg-surface-alt/40 transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  d.status === 'approved'
                    ? 'bg-emerald-light text-emerald'
                    : d.status === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-danger'
                }`}
              >
                {d.status === 'pending' ? (
                  <FileWarning size={16} aria-hidden="true" />
                ) : (
                  <FileText size={16} aria-hidden="true" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-ink truncate">
                  {KYC_TYPE_META[d.type].label}
                </div>
                <div className="text-[11px] text-ink-secondary truncate">
                  {formatBytes(d.sizeBytes)}
                  {d.documentNumber ? ` · #${d.documentNumber}` : ''}
                  {d.expiresAt ? ` · exp ${formatDate(d.expiresAt)}` : ''}
                </div>
              </div>
              {expiring ? (
                <span
                  title={`Expiring in ${daysUntil(d.expiresAt)} days`}
                  className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700"
                >
                  <Clock size={9} aria-hidden="true" />
                  Soon
                </span>
              ) : null}
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  cfg.tone === 'success'
                    ? 'bg-emerald-light text-emerald-dark'
                    : cfg.tone === 'danger'
                      ? 'bg-red-50 text-danger'
                      : cfg.tone === 'warning'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-surface-alt text-ink-secondary'
                }`}
              >
                {cfg.label}
              </span>

              {/* Inline actions — stopPropagation so clicking them doesn't open preview */}
              {d.status === 'pending' ? (
                <div
                  className="flex items-center gap-1 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onApprove(d.id)}
                    className="p-1.5 rounded-lg hover:bg-emerald-light text-emerald transition-colors"
                    aria-label={`Approve ${KYC_TYPE_META[d.type].label}`}
                    title="Approve"
                  >
                    <Check size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onReject(d.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-danger transition-colors"
                    aria-label={`Reject ${KYC_TYPE_META[d.type].label}`}
                    title="Reject"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ) : null}

              <Eye size={13} className="shrink-0 text-ink-muted" aria-hidden="true" />
            </div>
          )
        })}
      </div>

      {/* Activate action */}
      {riderStatus === 'nin_pending' ? (
        <div className="rounded-lg border border-emerald/30 bg-emerald-light/40 p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-dark" aria-hidden="true" />
            <div className="flex-1">
              <div className="text-xs font-semibold text-emerald-dark">
                {canActivate ? 'Ready to activate' : `${pendingKyc} pending review`}
              </div>
              <p className="mt-0.5 text-[11px] text-emerald-dark/80">
                {canActivate
                  ? 'All KYC documents reviewed. Activate the rider to allow bookings.'
                  : 'Approve all pending documents to enable activation.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onActivate}
              disabled={!canActivate}
              className="shrink-0 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Activate
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ==========================================================================
   SUBCOMPONENTS — Sidebar (unchanged)
   ========================================================================== */

function SidebarField({
  label,
  value,
  copyable,
  mono,
  icon,
}: {
  label: string
  value: string
  copyable?: boolean
  mono?: boolean
  icon?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      /* no-op */
    }
  }
  return (
    <div>
      <dt className="flex items-center gap-1 text-[10px] text-ink-muted uppercase tracking-wide">
        {icon}
        {label}
      </dt>
      <dd
        className={`flex items-center gap-1 text-ink font-medium ${mono ? 'font-mono' : ''}`}
      >
        <span className="truncate">{value}</span>
        {copyable && value && value !== '—' ? (
          <button
            type="button"
            onClick={copy}
            aria-label={`Copy ${label}`}
            className="ml-auto rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
          >
            {copied ? (
              <Check size={11} className="text-emerald" aria-hidden="true" />
            ) : (
              <ClipboardCopy size={11} aria-hidden="true" />
            )}
          </button>
        ) : null}
      </dd>
    </div>
  )
}

function KpiRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-secondary uppercase tracking-wide">{label}</span>
      <span className="text-sm font-bold text-ink">{value}</span>
    </div>
  )
}

/* ==========================================================================
   TABS — Profile / Rides / Wallet / Support / Activity / Notes (unchanged)
   ========================================================================== */

function ProfileTab({
  rider,
  trips,
  risk,
  tickets,
}: {
  rider: Rider
  trips: RiderTrip[]
  risk: ReturnType<typeof computeRisk> | null
  tickets: SupportTicket[]
}) {
  const completed = trips.filter((t) => t.status === 'completed')
  const totalSpent = completed.reduce((s, t) => s + t.fare, 0)
  const avgFare = completed.length > 0 ? Math.round(totalSpent / completed.length) : 0
  const cancelled = trips.filter((t) => t.status === 'cancelled').length
  const cancelRate = trips.length > 0 ? cancelled / trips.length : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rd-stagger">
        <Stat label="Trips shown" value={completed.length.toString()} />
        <Stat label="Total spent" value={`₦${totalSpent.toLocaleString()}`} />
        <Stat label="Avg fare" value={`₦${avgFare.toLocaleString()}`} />
        <Stat
          label="Cancel rate"
          value={`${Math.round(cancelRate * 100)}%`}
          tone={cancelRate >= 0.3 ? 'warning' : 'default'}
        />
      </div>

      <div className="rounded-lg bg-surface-alt p-4 text-xs text-ink-secondary">
        <div className="font-semibold text-ink mb-1 flex items-center gap-1.5">
          <Sparkles size={12} aria-hidden="true" />
          Summary
        </div>
        <p className="leading-relaxed">
          {rider.name} joined on {rider.joinedAt} from {rider.city}. Lifetime
          rating {rider.rating.toFixed(1)} across {rider.totalRides} rides.
          Wallet balance ₦{rider.walletBalance.toLocaleString()}.
          {risk && risk.score > 0 ? ` Risk tier: ${risk.tier.toUpperCase()}.` : ''}
          {tickets.length > 0
            ? ` ${tickets.length} support ${tickets.length === 1 ? 'ticket' : 'tickets'} on record.`
            : ''}
        </p>
      </div>
    </div>
  )
}

function RidesTab({ trips }: { trips: RiderTrip[] }) {
  const [statusFilter, setStatusFilter] = useState<TripStatusFilter>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<'date' | 'fare'>('date')

  const counts = useMemo(
    () => ({
      all: trips.length,
      completed: trips.filter((t) => t.status === 'completed').length,
      cancelled: trips.filter((t) => t.status === 'cancelled').length,
      in_progress: trips.filter((t) => t.status === 'in_progress').length,
    }),
    [trips],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return trips
      .filter((t) => {
        if (statusFilter !== 'all' && t.status !== statusFilter) return false
        if (q) {
          const haystack = [t.rideId, t.driverName, t.pickup, t.destination]
            .join(' ')
            .toLowerCase()
          if (!haystack.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'fare') return b.fare - a.fare
        return Date.parse(b.completedAt) - Date.parse(a.completedAt)
      })
  }, [trips, statusFilter, search, sort])

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="No rides yet"
        description="This rider hasn't taken any trips."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by ride, driver, pickup…"
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'date' | 'fare')}
          aria-label="Sort rides"
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
        >
          <option value="date">Newest first</option>
          <option value="fare">Highest fare</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'completed', 'cancelled', 'in_progress'] as TripStatusFilter[]).map(
          (key) => {
            const active = statusFilter === key
            const labels: Record<TripStatusFilter, string> = {
              all: 'All',
              completed: 'Completed',
              cancelled: 'Cancelled',
              in_progress: 'In progress',
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatusFilter(key)}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                  active
                    ? 'border-emerald bg-emerald text-white'
                    : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                ].join(' ')}
              >
                {labels[key]}
                {counts[key] > 0 ? (
                  <span
                    className={`text-[10px] font-bold ${active ? 'text-white/80' : 'text-ink-muted'}`}
                  >
                    {counts[key]}
                  </span>
                ) : null}
              </button>
            )
          },
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">
          No rides match the current filter.
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((trip) => (
            <div
              key={trip.id}
              className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-strong transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-ink font-medium">
                    #{trip.rideId.replace('rd_', '')}
                  </span>
                  <StatusBadge
                    status={
                      trip.status === 'completed'
                        ? 'success'
                        : trip.status === 'cancelled'
                          ? 'neutral'
                          : 'info'
                    }
                  >
                    {trip.status.replace('_', ' ')}
                  </StatusBadge>
                  {trip.rating !== null ? (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-500">
                      <Star size={10} className="fill-amber-500" aria-hidden="true" />
                      {trip.rating}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-ink-secondary truncate">
                  with {trip.driverName} · {trip.pickup} → {trip.destination}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-ink">
                  ₦{trip.fare.toLocaleString()}
                </div>
                <div className="text-[10px] text-ink-muted">
                  {new Date(trip.completedAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WalletTab({
  transactions,
  balance,
}: {
  transactions: WalletTransaction[]
  balance: number
}) {
  const [filter, setFilter] = useState<WalletFilter>('all')

  const credits = transactions
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0)
  const debits = transactions
    .filter((t) => t.type === 'debit')
    .reduce((s, t) => s + t.amount, 0)

  const filtered =
    filter === 'all' ? transactions : transactions.filter((t) => t.type === filter)

  const spark = useMemo(() => {
    const sorted = [...transactions].sort(
      (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
    )
    const points = sorted.map((t) => t.balanceAfter)
    if (points.length === 0) return []
    const max = Math.max(...points)
    const min = Math.min(...points)
    const range = Math.max(1, max - min)
    const step = Math.max(1, Math.floor(points.length / 12))
    const sampled: number[] = []
    for (let i = 0; i < points.length; i += step) sampled.push(points[i])
    if (sampled[sampled.length - 1] !== points[points.length - 1]) {
      sampled.push(points[points.length - 1])
    }
    return sampled.map((p) => ({ x: (p - min) / range, y: p }))
  }, [transactions])

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3 rd-stagger">
        <Stat label="Balance" value={`₦${balance.toLocaleString()}`} />
        <Stat
          label="Money in"
          value={`+₦${credits.toLocaleString()}`}
          tone="success"
        />
        <Stat
          label="Money out"
          value={`-₦${debits.toLocaleString()}`}
          tone="warning"
        />
      </div>

      {spark.length >= 2 ? (
        <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Balance trend
            </span>
            <span className="text-[10px] text-ink-muted">{spark.length} points</span>
          </div>
          <svg
            viewBox="0 0 100 24"
            preserveAspectRatio="none"
            className="h-16 w-full"
            aria-hidden="true"
          >
            <polyline
              fill="none"
              stroke="#10b981"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={spark
                .map((p, i) => {
                  const x = (i / (spark.length - 1)) * 100
                  const y = 22 - p.x * 20
                  return `${x},${y}`
                })
                .join(' ')}
            />
          </svg>
        </div>
      ) : null}

      <div className="flex items-center gap-1.5">
        {(['all', 'credit', 'debit'] as WalletFilter[]).map((key) => {
          const active = filter === key
          const labels: Record<WalletFilter, string> = {
            all: 'All',
            credit: 'Credits',
            debit: 'Debits',
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={active}
              className={[
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-emerald bg-emerald text-white'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
              ].join(' ')}
            >
              {labels[key]}
            </button>
          )
        })}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">
          Transaction history
        </h3>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-muted">
            No transactions in this view.
          </p>
        ) : (
          <div className="space-y-2">
            {filtered.map((t) => {
              const isCredit = t.type === 'credit'
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-strong transition-colors"
                >
                  <div
                    className={
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ' +
                      (isCredit
                        ? 'bg-emerald-light text-emerald'
                        : 'bg-surface-alt text-ink-secondary')
                    }
                  >
                    {isCredit ? (
                      <TrendingUp size={16} aria-hidden="true" />
                    ) : (
                      <TrendingDown size={16} aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">
                      {t.description}
                    </div>
                    <div className="text-[11px] text-ink-secondary">
                      {new Date(t.createdAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div
                      className={
                        'text-sm font-semibold ' +
                        (isCredit ? 'text-emerald' : 'text-ink')
                      }
                    >
                      {isCredit ? '+' : '-'}₦{t.amount.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-ink-muted">
                      → ₦{t.balanceAfter.toLocaleString()}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function SupportTab({
  tickets,
  onStatusChange,
}: {
  tickets: SupportTicket[]
  onStatusChange: (id: string, status: SupportTicket['status']) => void
}) {
  const [filter, setFilter] = useState<'all' | SupportTicket['status']>('all')

  const counts = useMemo(() => {
    return {
      all: tickets.length,
      open: tickets.filter((t) => t.status === 'open').length,
      in_progress: tickets.filter((t) => t.status === 'in_progress').length,
      resolved: tickets.filter((t) => t.status === 'resolved').length,
      closed: tickets.filter((t) => t.status === 'closed').length,
    }
  }, [tickets])

  const filtered =
    filter === 'all' ? tickets : tickets.filter((t) => t.status === filter)

  if (tickets.length === 0) {
    return (
      <EmptyState
        icon={LifeBuoy}
        title="No support tickets"
        description="This rider hasn't filed any complaints."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((key) => {
          const active = filter === key
          const labels: Record<typeof key, string> = {
            all: 'All',
            open: 'Open',
            in_progress: 'In progress',
            resolved: 'Resolved',
            closed: 'Closed',
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={active}
              className={[
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-emerald bg-emerald text-white'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
              ].join(' ')}
            >
              {labels[key]}
              {counts[key] > 0 ? (
                <span
                  className={`text-[10px] font-bold ${active ? 'text-white/80' : 'text-ink-muted'}`}
                >
                  {counts[key]}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">
          No tickets match this filter.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((t) => {
            const statusCfg = TICKET_STATUS_MAP[t.status]
            const priCfg = PRIORITY_MAP[t.priority]
            const hoursOpen =
              (Date.now() - Date.parse(t.createdAt)) / (60 * 60 * 1000)
            const slaBreach =
              (t.status === 'open' || t.status === 'in_progress') &&
              hoursOpen > SLA_HOURS
            return (
              <div key={t.id} className="rounded-lg border border-border p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="text-sm font-semibold text-ink truncate">
                        {t.subject}
                      </div>
                      {slaBreach ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-danger rd-pop">
                          <AlertTriangle size={8} aria-hidden="true" />
                          SLA
                        </span>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <StatusBadge status={statusCfg.tone}>
                        {statusCfg.label}
                      </StatusBadge>
                      <StatusBadge status={priCfg.tone}>
                        {priCfg.label}
                      </StatusBadge>
                      <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
                        <Clock size={10} aria-hidden="true" />
                        {formatRelativeTime(t.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-ink-secondary leading-relaxed mb-3">
                  {t.lastMessage}
                </p>

                <div className="flex items-center gap-2 pt-3 border-t border-border">
                  {t.status === 'open' ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(t.id, 'in_progress')}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-info hover:text-info transition-colors"
                    >
                      <AlertCircle size={11} aria-hidden="true" />
                      Start
                    </button>
                  ) : null}
                  {t.status === 'in_progress' ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(t.id, 'resolved')}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald bg-emerald-light px-2.5 py-1 text-[11px] font-semibold text-emerald hover:bg-emerald/20 transition-colors"
                    >
                      <CheckCircle2 size={11} aria-hidden="true" />
                      Mark resolved
                    </button>
                  ) : null}
                  {t.status !== 'closed' ? (
                    <button
                      type="button"
                      onClick={() => onStatusChange(t.id, 'closed')}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors"
                    >
                      Close
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

type ActivityItem = {
  id: string
  at: number
  kind: 'trip' | 'wallet' | 'ticket' | 'note'
  title: string
  meta?: string
  tone: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

function ActivityTab({
  trips,
  walletTxns,
  tickets,
  notes,
}: {
  trips: RiderTrip[]
  walletTxns: WalletTransaction[]
  tickets: SupportTicket[]
  notes: AdminNote[]
}) {
  const [kindFilter, setKindFilter] = useState<'all' | ActivityItem['kind']>('all')

  const items = useMemo<ActivityItem[]>(() => {
    const out: ActivityItem[] = []
    for (const t of trips) {
      out.push({
        id: `trip-${t.id}`,
        at: Date.parse(t.completedAt),
        kind: 'trip',
        title: `Ride #${t.rideId.replace('rd_', '')} · ${t.status.replace('_', ' ')}`,
        meta: `with ${t.driverName} · ₦${t.fare.toLocaleString()}`,
        tone: t.status === 'completed' ? 'success' : t.status === 'cancelled' ? 'default' : 'info',
      })
    }
    for (const w of walletTxns) {
      out.push({
        id: `w-${w.id}`,
        at: Date.parse(w.createdAt),
        kind: 'wallet',
        title: `${w.type === 'credit' ? '+' : '-'}₦${w.amount.toLocaleString()} · ${w.description}`,
        meta: `Balance ₦${w.balanceAfter.toLocaleString()}`,
        tone: w.type === 'credit' ? 'success' : 'warning',
      })
    }
    for (const t of tickets) {
      out.push({
        id: `t-${t.id}`,
        at: Date.parse(t.createdAt),
        kind: 'ticket',
        title: `Ticket: ${t.subject}`,
        meta: `${TICKET_STATUS_MAP[t.status].label} · ${PRIORITY_MAP[t.priority].label}`,
        tone: t.status === 'resolved' ? 'success' : t.status === 'closed' ? 'default' : 'danger',
      })
    }
    for (const n of notes) {
      out.push({
        id: `n-${n.id}`,
        at: n.createdAt,
        kind: 'note',
        title: `Admin note`,
        meta: n.body.slice(0, 80),
        tone: 'info',
      })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [trips, walletTxns, tickets, notes])

  const filtered =
    kindFilter === 'all' ? items : items.filter((i) => i.kind === kindFilter)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Nothing has happened for this rider yet."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'trip', 'wallet', 'ticket', 'note'] as const).map((key) => {
          const active = kindFilter === key
          const labels: Record<typeof key, string> = {
            all: 'All',
            trip: 'Trips',
            wallet: 'Wallet',
            ticket: 'Support',
            note: 'Notes',
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => setKindFilter(key)}
              aria-pressed={active}
              className={[
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-emerald bg-emerald text-white'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
              ].join(' ')}
            >
              {labels[key]}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">
          No activity of this kind.
        </p>
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span
            aria-hidden="true"
            className="absolute left-1.5 top-1 bottom-1 w-px bg-border"
          />
          {filtered.map((item) => (
            <li key={item.id} className="relative">
              <span
                className={`absolute -left-[13px] top-1.5 flex h-3 w-3 items-center justify-center rounded-full ring-2 ring-surface ${
                  item.tone === 'success'
                    ? 'bg-emerald'
                    : item.tone === 'danger'
                      ? 'bg-red-500'
                      : item.tone === 'warning'
                        ? 'bg-amber-500'
                        : item.tone === 'info'
                          ? 'bg-sky-500'
                          : 'bg-ink-muted'
                }`}
                aria-hidden="true"
              />
              <div className="text-xs font-semibold text-ink">{item.title}</div>
              {item.meta ? (
                <div className="text-[11px] text-ink-secondary mt-0.5">{item.meta}</div>
              ) : null}
              <div className="text-[10px] text-ink-muted mt-0.5">
                {formatRelativeTime(item.at)}
              </div>
            </li>
          ))}
        </ol>
      )}
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
          htmlFor="admin-note"
          className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
        >
          Add a private admin note
        </label>
        <textarea
          id="admin-note"
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
                    <span>{formatRelativeTime(n.createdAt)}</span>
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
      <div className={'text-lg font-bold ' + color}>{value}</div>
    </div>
  )
}