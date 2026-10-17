import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Calendar,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  ExternalLink,
  Eye, // ← NEW
  FileCheck,
  FileJson,
  FileText,
  FileWarning,
  Image as ImageIcon, // ← NEW
  Mail,
  MapPin,
  Maximize2, // ← NEW
  Phone,
  Plus,
  RefreshCw,
  RotateCcw, // ← NEW
  Route as RouteIcon,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Trash2,
  TrendingUp,
  User,
  UserX,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { Tabs, type TabItem } from '../../../components/shared/Tabs'
import { BRAND } from '../../../config/brand'
import { toast } from '../../../lib/toast'
import {
  useApproveDriver,
  useDriver,
  useRejectDriver,
} from '../../../hooks/queries/useDrivers'
import {
  getDriverDocuments,
  getDriverEarnings,
  getDriverPayouts,
  getDriverTrips,
  reviewDocumentApi,
  reviewPayoutApi,
  type Driver,
  type DriverDocument,
  type DriverEarningEntry,
  type DriverPayout,
  type DriverStatus,
  type DriverTrip,
} from '../data/mockDrivers'

import {
  DOCUMENT_STATUS_META as KYC_STATUS_META,
  DOCUMENT_TYPE_META as KYC_TYPE_META,
  daysUntil,
  formatBytes,
  formatDate,
  formatRelativeTime,
  getEntityKYC,
  isExpiringSoon,
  type Document as KycDocument, // ← NEW
} from '../../documents/data/mockDocuments'

/* ==========================================================================
   CONFIG (unchanged)
   ========================================================================== */

const STATUS_MAP: Record<DriverStatus, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

const DOC_STATUS_MAP: Record<
  DriverDocument['status'],
  'success' | 'warning' | 'danger'
> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

const PAYOUT_STATUS_MAP: Record<
  DriverPayout['status'],
  { label: string; tone: 'success' | 'warning' | 'danger' | 'info' }
> = {
  paid: { label: 'Paid', tone: 'success' },
  approved: { label: 'Approved', tone: 'info' },
  pending: { label: 'Pending', tone: 'warning' },
  rejected: { label: 'Rejected', tone: 'danger' },
}

type TabId =
  | 'profile'
  | 'verification'
  | 'trips'
  | 'earnings'
  | 'payouts'
  | 'activity'
  | 'notes'

type TripFilter = 'all' | 'completed' | 'cancelled' | 'in_progress'
type PayoutFilter = 'all' | 'pending' | 'approved' | 'paid' | 'rejected'

type AdminNote = {
  id: string
  body: string
  createdAt: number
  author: string
}

const NOTES_KEY_PREFIX = 'hr.driver.notes.'
const EXPIRY_WARNING_DAYS = 30
const LOW_RATING_THRESHOLD = 4.0

const ANIMATIONS = `
  @keyframes dd-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes dd-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dd-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes dd-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes dd-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .dd-fade-in { animation: dd-fade-in .2s ease both; }
  .dd-fade-up { animation: dd-fade-up .3s cubic-bezier(.22,1,.36,1) both; }
  .dd-pop { animation: dd-pop .3s cubic-bezier(.22,1,.36,1) both; }
  .dd-pulse { animation: dd-pulse 1.5s ease-in-out infinite; }
  .dd-bar { transform-origin: left center; animation: dd-bar-grow .6s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .dd-fade-in, .dd-fade-up, .dd-pop, .dd-pulse, .dd-bar { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function daysSince(iso: string): number | null {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000))
}

function readNotes(driverId: string): AdminNote[] {
  try {
    const raw = window.localStorage.getItem(NOTES_KEY_PREFIX + driverId)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeNotes(driverId: string, notes: AdminNote[]): void {
  try {
    window.localStorage.setItem(NOTES_KEY_PREFIX + driverId, JSON.stringify(notes))
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

function inferMimeType(fileName?: string): string {
  if (!fileName) return 'application/octet-stream'
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'pdf') return 'application/pdf'
  return 'application/octet-stream'
}

type RiskAssessment = {
  score: number
  tier: 'low' | 'medium' | 'high'
  reasons: string[]
}

function computeRisk(
  driver: Driver,
  docs: DriverDocument[],
  payouts: DriverPayout[],
  kycExpired: number,
  kycExpiring: number,
): RiskAssessment {
  let score = 0
  const reasons: string[] = []

  if (driver.status === 'rejected') {
    score += 40
    reasons.push('Currently rejected')
  } else if (driver.status === 'pending') {
    const days = daysSince(driver.submittedAt)
    if (days != null && days >= 7) {
      score += 15
      reasons.push(`Pending ${days} days`)
    }
  }

  const rejected = docs.filter((d) => d.status === 'rejected').length
  if (rejected > 0) {
    score += rejected * 10
    reasons.push(`${rejected} rejected doc${rejected === 1 ? '' : 's'}`)
  }
  if (kycExpired > 0) {
    score += kycExpired * 15
    reasons.push(`${kycExpired} expired document${kycExpired === 1 ? '' : 's'}`)
  }
  if (kycExpiring > 0) {
    score += 5
    reasons.push(`${kycExpiring} expiring soon`)
  }
  const pendingPayouts = payouts.filter((p) => p.status === 'pending').length
  if (pendingPayouts > 0) {
    score += 5
    reasons.push(`${pendingPayouts} pending payout${pendingPayouts === 1 ? '' : 's'}`)
  }

  score = Math.min(100, score)
  const tier: RiskAssessment['tier'] = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low'
  return { score, tier, reasons }
}

type Lifecycle = {
  stage: 'new' | 'active' | 'veteran'
  daysOnPlatform: number
  label: string
}

function computeLifecycle(driver: Driver): Lifecycle {
  const days = daysSince(driver.submittedAt) ?? 0
  const stage: Lifecycle['stage'] = days >= 90 ? 'veteran' : days >= 30 ? 'active' : 'new'
  return {
    stage,
    daysOnPlatform: days,
    label: stage === 'veteran' ? 'Veteran' : stage === 'active' ? 'Active' : 'New',
  }
}

/* ==========================================================================
   // ← NEW: Unified preview model for both document types
   ========================================================================== */

type PreviewDoc = {
  id: string
  title: string
  fileName: string
  fileUrl: string | null
  mimeType: string
  sizeBytes: number | null
  uploadedAt: string
  status: 'approved' | 'pending' | 'rejected' | 'expired'
  statusLabel: string
  statusTone: 'success' | 'warning' | 'danger' | 'info' | 'neutral'
  reviewNote: string | null
  documentNumber: string | null
  expiresAt: string | null
  sourceKind: 'driver_doc' | 'kyc_doc'
  sourceId: string
}

function toPreviewFromLegacy(doc: DriverDocument): PreviewDoc {
  const raw = doc as DriverDocument & {
    fileUrl?: string
    mimeType?: string
    sizeBytes?: number
    documentNumber?: string | null
    expiresAt?: string | null
  }
  const status = doc.status as PreviewDoc['status']
  return {
    id: doc.id,
    title: doc.label,
    fileName: doc.fileName,
    fileUrl: raw.fileUrl ?? null,
    mimeType: raw.mimeType ?? inferMimeType(doc.fileName),
    sizeBytes: raw.sizeBytes ?? null,
    uploadedAt: doc.uploadedAt,
    status,
    statusLabel: doc.status.charAt(0).toUpperCase() + doc.status.slice(1),
    statusTone: DOC_STATUS_MAP[doc.status],
    reviewNote: doc.reviewNote ?? null,
    documentNumber: raw.documentNumber ?? null,
    expiresAt: raw.expiresAt ?? null,
    sourceKind: 'driver_doc',
    sourceId: doc.id,
  }
}

function toPreviewFromKyc(doc: KycDocument): PreviewDoc {
  return {
    id: doc.id,
    title: KYC_TYPE_META[doc.type]?.label ?? doc.type,
    fileName: doc.fileUrl.split('/').pop() ?? `${doc.type}`,
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
    sourceKind: 'kyc_doc',
    sourceId: doc.id,
  }
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function DriverDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const { data: driver, isLoading, isError, error, refetch } = useDriver(id)
  const approve = useApproveDriver()
  const reject = useRejectDriver()

  const [tab, setTab] = useState<TabId>('profile')
  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const isWorking = approve.isPending || reject.isPending

  // Local mutable copies (preserved)
  const [docs, setDocs] = useState<DriverDocument[] | null>(null)
  const [payouts, setPayouts] = useState<DriverPayout[] | null>(null)

  // Existing state
  const [notes, setNotes] = useState<AdminNote[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [copied, setCopied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [kycVersion, setKycVersion] = useState(0)

  // ← NEW: preview state
  const [previewDoc, setPreviewDoc] = useState<PreviewDoc | null>(null)

  const copiedTimerRef = useRef<number | null>(null)

  // Derived data
  const effectiveDocs = docs ?? (id ? getDriverDocuments(id) : [])
  const effectivePayouts = payouts ?? (id ? getDriverPayouts(id) : [])
  const trips = useMemo(() => (id ? getDriverTrips(id) : []), [id])
  const earnings = useMemo(() => (id ? getDriverEarnings(id) : []), [id])

  const kyc = useMemo(
    () => (id ? getEntityKYC('driver', id) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, kycVersion],
  )

  const kycExpired = kyc?.documents.filter(
    (d) => d.status === 'expired' || (d.expiresAt && (daysUntil(d.expiresAt) ?? 1) < 0),
  ).length ?? 0
  const kycExpiring = kyc?.documents.filter((d) => isExpiringSoon(d)).length ?? 0

  const pendingDocs = effectiveDocs.filter((d) => d.status === 'pending').length
  const pendingPayouts = effectivePayouts.filter((p) => p.status === 'pending').length

  const risk = useMemo(
    () => (driver ? computeRisk(driver, effectiveDocs, effectivePayouts, kycExpired, kycExpiring) : null),
    [driver, effectiveDocs, effectivePayouts, kycExpired, kycExpiring],
  )

  const lifecycle = useMemo(
    () => (driver ? computeLifecycle(driver) : null),
    [driver],
  )

  const verificationChecks = useMemo(() => {
    if (!driver) return []
    return [
      { label: 'NIN verified', ok: !!driver.nin && driver.nin.length === 11 },
      { label: 'Approved status', ok: driver.status === 'approved' },
      { label: 'Contact verified', ok: !!driver.phone && !!driver.email },
      { label: 'KYC documents verified', ok: kyc?.kycStatus === 'verified' },
      { label: 'No rejected docs', ok: effectiveDocs.every((d) => d.status !== 'rejected') },
    ]
  }, [driver, kyc, effectiveDocs])

  const earningsTotals = useMemo(() => {
    const gross = earnings.reduce((s, e) => s + e.gross, 0)
    const commission = earnings.reduce((s, e) => s + e.commission, 0)
    const subscription = earnings.reduce((s, e) => s + e.subscription, 0)
    const net = earnings.reduce((s, e) => s + e.net, 0)
    const tripCount = earnings.reduce((s, e) => s + e.trips, 0)
    return {
      gross,
      commission,
      subscription,
      net,
      tripCount,
      avgPerTrip: tripCount > 0 ? Math.round(net / tripCount) : 0,
    }
  }, [earnings])

  // ← NEW: rejected docs count (for re-approval hint)
  const rejectedDocsCount = effectiveDocs.filter((d) => d.status === 'rejected').length

  // ← NEW: drivers can be (re-)approved from pending OR rejected
  const canDecide = driver?.status === 'pending' || driver?.status === 'rejected'
  const isRejected = driver?.status === 'rejected'

  const tabs: TabItem<TabId>[] = [
    { id: 'profile', label: 'Profile', icon: User },
    {
      id: 'verification',
      label: 'Verification',
      icon: FileCheck,
      badge: pendingDocs + (kyc?.pendingCount ?? 0),
    },
    { id: 'trips', label: 'Trips', icon: RouteIcon, badge: trips.length || undefined },
    { id: 'earnings', label: 'Earnings', icon: TrendingUp },
    {
      id: 'payouts',
      label: 'Payouts',
      icon: Wallet,
      badge: pendingPayouts,
    },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'notes', label: 'Notes', icon: StickyNote, badge: notes.length || undefined },
  ]

  /* ---------------------------- effects -------------------------- */

  useEffect(() => {
    if (!id) return
    setNotes(readNotes(id))
  }, [id])

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // ← NEW: Esc closes preview first, then confirm modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (e.key === 'Escape') {
        if (previewDoc) {
          setPreviewDoc(null)
          return
        }
        if (pending && !isWorking) setPending(null)
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
  }, [pending, isWorking, previewDoc])

  /* --------------------------- handlers -------------------------- */

  const handleConfirm = async () => {
    if (!driver || !pending) return
    const wasRejected = driver.status === 'rejected'
    try {
      if (pending === 'approve') {
        await approve.mutateAsync(driver.id)
        toast.success(
          wasRejected ? `${driver.name} re-approved` : `${driver.name} approved`,
          'Driver can now accept rides.',
        )
      } else {
        await reject.mutateAsync(driver.id)
        toast.warning(`${driver.name} rejected`, 'Driver has been notified.')
      }
      setPending(null)
      setKycVersion((v) => v + 1)
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleDocReview = async (
    docId: string,
    status: 'approved' | 'rejected',
    note = '',
  ) => {
    try {
      await reviewDocumentApi(docId, status, note)
      const next = effectiveDocs.map((d) =>
        d.id === docId ? { ...d, status, reviewNote: note || null } : d,
      )
      setDocs(next)
      setKycVersion((v) => v + 1)
      toast.success(
        `Document ${status}`,
        `${next.find((d) => d.id === docId)?.label} marked as ${status}.`,
      )
      // ← NEW: reflect update in open preview
      if (previewDoc && previewDoc.sourceKind === 'driver_doc' && previewDoc.sourceId === docId) {
        const refreshed = next.find((d) => d.id === docId)
        if (refreshed) setPreviewDoc(toPreviewFromLegacy(refreshed))
      }
    } catch (e) {
      toast.error('Could not review document', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handlePayoutReview = async (
    payoutId: string,
    status: 'approved' | 'rejected' | 'paid',
  ) => {
    try {
      await reviewPayoutApi(payoutId, status, '')
      const next = effectivePayouts.map((p) =>
        p.id === payoutId
          ? { ...p, status, reviewedAt: new Date().toISOString() }
          : p,
      )
      setPayouts(next)
      toast.success(`Payout ${status}`, `Withdrawal marked as ${status}.`)
    } catch (e) {
      toast.error('Could not update payout', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setKycVersion((v) => v + 1)
      if (id) setNotes(readNotes(id))
      setLastUpdated(Date.now())
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [refetch, id])

  const handleCopySummary = useCallback(async () => {
    if (!driver || !risk) return
    const text = [
      `Driver: ${driver.name}`,
      `Phone: ${driver.phone}`,
      `Email: ${driver.email}`,
      `City: ${driver.city}`,
      `Vehicle: ${driver.vehicle} · ${driver.plate}`,
      `NIN: ${driver.nin}`,
      `Status: ${driver.status}`,
      `Risk: ${risk.tier.toUpperCase()} (${risk.score}/100)`,
      `KYC: ${kyc?.kycStatus ?? 'not_started'} (${kyc?.approvedCount ?? 0}/${kyc?.documents.length ?? 0})`,
      `Pending docs: ${pendingDocs}`,
      `Pending payouts: ${pendingPayouts}`,
      `Net earnings: ₦${earningsTotals.net.toLocaleString()}`,
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [driver, risk, kyc, pendingDocs, pendingPayouts, earningsTotals])

  const handleExportJSON = useCallback(() => {
    if (!driver) return
    const payload = {
      generatedAt: new Date().toISOString(),
      driver,
      risk,
      lifecycle,
      verificationChecks,
      kyc: kyc
        ? {
            kycStatus: kyc.kycStatus,
            progressPct: kyc.progressPct,
            documents: kyc.documents,
            missingTypes: kyc.missingTypes,
          }
        : null,
      driverDocuments: effectiveDocs,
      trips,
      earnings,
      earningsTotals,
      payouts: effectivePayouts,
      notes,
    }
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    downloadFile(
      JSON.stringify(payload, null, 2),
      `driver-${driver.id}-${ts}.json`,
      'application/json',
    )
    toast.success('Export ready', 'Driver data downloaded.')
  }, [driver, risk, lifecycle, verificationChecks, kyc, effectiveDocs, trips, earnings, earningsTotals, effectivePayouts, notes])

  const handleAddNote = useCallback(() => {
    if (!id || !noteDraft.trim()) return
    const note: AdminNote = {
      id: Math.random().toString(36).slice(2, 10),
      body: noteDraft.trim(),
      createdAt: Date.now(),
      author: 'Admin',
    }
    const next = [note, ...notes]
    setNotes(next)
    writeNotes(id, next)
    setNoteDraft('')
    toast.success('Note saved')
  }, [id, noteDraft, notes])

  const handleDeleteNote = useCallback(
    (noteId: string) => {
      if (!id) return
      const next = notes.filter((n) => n.id !== noteId)
      setNotes(next)
      writeNotes(id, next)
    },
    [id, notes],
  )

  /* ---------------------------- loading -------------------------- */

  if (isLoading) {
    return (
      <AppShell title="Driver Detail">
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

  if (isError || !driver) {
    return (
      <AppShell title="Driver Detail">
        <div className="rounded-xl bg-surface border border-border">
          {isError ? (
            <ErrorState
              title="Could not load driver"
              description={error instanceof Error ? error.message : 'Please try again.'}
              onRetry={() => refetch()}
            />
          ) : (
            <EmptyState
              icon={UserX}
              title="Driver not found"
              description={`No driver matches ID: ${id}`}
              action={
                <button
                  type="button"
                  onClick={() => navigate('/drivers')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-dark transition-colors"
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Back to drivers
                </button>
              }
            />
          )}
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render --------------------------- */

  return (
    <AppShell title="Driver Detail">
      <style>{ANIMATIONS}</style>

      {/* -------------------- Top bar -------------------- */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={() => navigate('/drivers')}
          className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink transition-colors"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to drivers
        </button>

        <div className="flex flex-wrap items-center gap-1.5 dd-fade-up">
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-muted sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald dd-pulse" aria-hidden="true" />
            Live · {formatRelativeTime(new Date(lastUpdated).toISOString())}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            title="Refresh"
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
            title="Export JSON (Ctrl/Cmd + E)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            Export
          </button>

          {/* ← UPDATED: re-approval allowed for rejected drivers too */}
          {canDecide ? (
            <>
              {driver.status === 'pending' ? (
                <button
                  type="button"
                  onClick={() => setPending('reject')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                >
                  <X size={12} aria-hidden="true" />
                  Reject
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setPending('approve')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
              >
                {isRejected ? (
                  <>
                    <RotateCcw size={12} aria-hidden="true" />
                    Re-approve
                  </>
                ) : (
                  <>
                    <Check size={12} aria-hidden="true" />
                    Approve
                  </>
                )}
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* -------------------- Left sidebar -------------------- */}
        <div className="lg:col-span-1 space-y-4">
          {/* Identity card */}
          <div className="rounded-xl bg-surface border border-border p-6 dd-fade-up">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center text-lg font-bold">
                {driver.name.split(' ').map((n) => n[0]).join('')}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-ink truncate">{driver.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={STATUS_MAP[driver.status]}>
                    {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                  </StatusBadge>
                  {lifecycle ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dd-pop ${
                        lifecycle.stage === 'veteran'
                          ? 'bg-violet-100 text-violet-700'
                          : lifecycle.stage === 'active'
                            ? 'bg-sky-100 text-sky-700'
                            : 'bg-surface-alt text-ink-secondary'
                      }`}
                      title={`${lifecycle.daysOnPlatform} days on platform`}
                    >
                      <Star size={9} aria-hidden="true" />
                      {lifecycle.label}
                    </span>
                  ) : null}
                  {risk ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide dd-pop ${
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
                value={driver.phone}
                icon={<Phone size={11} />}
                copyable
                href={`tel:${driver.phone.replace(/\s/g, '')}`}
              />
              <SidebarField
                label="Email"
                value={driver.email}
                icon={<Mail size={11} />}
                copyable
                href={`mailto:${driver.email}`}
              />
              <SidebarField
                label="NIN"
                value={driver.nin}
                icon={
                  driver.nin.length === 11 ? (
                    <ShieldCheck size={11} className="text-emerald" />
                  ) : (
                    <AlertTriangle size={11} className="text-amber-500" />
                  )
                }
                mono
              />
              <SidebarField
                label="City"
                value={driver.city}
                icon={<MapPin size={11} />}
              />
              <SidebarField
                label="Vehicle"
                value={`${driver.vehicle} · ${driver.vehicleColor}`}
                icon={<FileText size={11} />}
              />
              <SidebarField
                label="Plate"
                value={driver.plate}
                icon={<FileText size={11} />}
                copyable
                mono
              />
            </dl>
          </div>

          {/* KYC progress */}
          {kyc ? (
            <div className="rounded-xl bg-surface border border-border p-5 dd-fade-up">
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
                  className={`dd-bar absolute inset-y-0 left-0 rounded-full ${
                    kyc.kycStatus === 'verified'
                      ? 'bg-emerald'
                      : kyc.kycStatus === 'rejected' || kyc.kycStatus === 'expired'
                        ? 'bg-red-500'
                        : 'bg-amber-500'
                  }`}
                  style={{ width: `${kyc.progressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-emerald-light/40 px-1 py-1.5">
                  <div className="text-sm font-bold text-emerald-dark">{kyc.approvedCount}</div>
                  <div className="text-[9px] uppercase tracking-wide text-emerald-dark/70">Approved</div>
                </div>
                <div className="rounded-md bg-amber-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-amber-700">{kyc.pendingCount}</div>
                  <div className="text-[9px] uppercase tracking-wide text-amber-700/70">Pending</div>
                </div>
                <div className="rounded-md bg-red-50 px-1 py-1.5">
                  <div className="text-sm font-bold text-danger">{kyc.rejectedCount}</div>
                  <div className="text-[9px] uppercase tracking-wide text-danger/70">Rejected</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/documents')}
                className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
              >
                <ShieldCheck size={11} aria-hidden="true" />
                Open KYC queue
              </button>
            </div>
          ) : null}

          {/* Verification checklist */}
          <div className="rounded-xl bg-surface border border-border p-5 dd-fade-up">
            <div className="mb-3 flex items-center gap-2">
              <CheckCircle2 size={13} className="text-ink-muted" aria-hidden="true" />
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
                  <span className={c.ok ? 'text-ink-secondary' : 'text-ink'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Decision card — UPDATED: re-approval allowed for rejected */}
          {canDecide ? (
            <div className="rounded-xl bg-surface border border-border p-5 dd-fade-up">
              <div className="text-sm font-medium text-ink mb-1">
                {isRejected ? 'Re-approval' : 'Decision'}
              </div>
              <div className="text-xs text-ink-secondary mb-3">
                {isRejected
                  ? 'Driver was rejected. Approve after corrections.'
                  : 'Approve or reject this driver'}
              </div>

              {isRejected && rejectedDocsCount > 0 ? (
                <div className="mb-3 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="font-semibold">{rejectedDocsCount} document{rejectedDocsCount === 1 ? '' : 's'}</span>{' '}
                    still rejected. Approve anyway?
                  </span>
                </div>
              ) : null}

              {isRejected ? (
                <button
                  type="button"
                  onClick={() => setPending('approve')}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
                >
                  <RotateCcw size={14} aria-hidden="true" />
                  Re-approve driver
                </button>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPending('reject')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-danger hover:bg-red-100 transition-colors"
                  >
                    <X size={14} aria-hidden="true" />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => setPending('approve')}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
                  >
                    <Check size={14} aria-hidden="true" />
                    Approve
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl bg-surface border border-border p-5 dd-fade-up">
              <div className="text-sm font-medium text-ink mb-1">Decision recorded</div>
              <div className="text-xs text-ink-secondary">This driver was already {driver.status}.</div>
            </div>
          )}
        </div>

        {/* -------------------- Right tabbed content -------------------- */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-surface border border-border overflow-hidden dd-fade-up">
            <Tabs tabs={tabs} value={tab} onChange={setTab} />

            <div className="p-6">
              {tab === 'profile' ? (
                <ProfileTab driver={driver} trips={trips} earnings={earnings} earningsTotals={earningsTotals} lifecycle={lifecycle} risk={risk} kyc={kyc} />
              ) : null}

              {tab === 'verification' ? (
                <VerificationTab
                  documents={effectiveDocs}
                  driverStatus={driver.status}
                  onReview={handleDocReview}
                  kyc={kyc}
                  onOpenKycQueue={() => navigate('/documents')}
                  onPreview={(doc) => setPreviewDoc(doc)} // ← NEW
                />
              ) : null}

              {tab === 'trips' ? <TripsTab trips={trips} /> : null}

              {tab === 'earnings' ? (
                <EarningsTab earnings={earnings} totals={earningsTotals} />
              ) : null}

              {tab === 'payouts' ? (
                <PayoutsTab payouts={effectivePayouts} onReview={handlePayoutReview} />
              ) : null}

              {tab === 'activity' ? (
                <ActivityTab
                  trips={trips}
                  earnings={earnings}
                  payouts={effectivePayouts}
                  docs={effectiveDocs}
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

      {/* -------------------- Confirm modal — UPDATED for re-approval -------------------- */}
      <ConfirmModal
        open={pending !== null}
        title={
          pending === 'approve'
            ? isRejected
              ? `Re-approve ${driver.name}?`
              : `Approve ${driver.name}?`
            : pending === 'reject'
              ? `Reject ${driver.name}?`
              : ''
        }
        description={
          pending === 'approve'
            ? isRejected
              ? `This driver will be re-approved and can accept rides on ${BRAND.name}. Make sure corrections have been verified.`
              : `This driver will be cleared to accept rides on ${BRAND.name}.`
            : 'This driver will be blocked from accepting rides. They will be notified.'
        }
        confirmLabel={
          pending === 'approve'
            ? isRejected
              ? 'Re-approve'
              : 'Approve'
            : 'Reject'
        }
        variant={pending === 'reject' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />

      {/* -------------------- ← NEW: Document preview modal -------------------- */}
      {previewDoc ? (
        <DocumentPreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          onApprove={() => {
            if (previewDoc.sourceKind === 'driver_doc') {
              handleDocReview(previewDoc.sourceId, 'approved', 'Verified by admin')
            } else {
              toast.error('KYC documents', 'Review them from the KYC queue.')
              navigate('/documents')
            }
          }}
          onReject={() => {
            if (previewDoc.sourceKind === 'driver_doc') {
              handleDocReview(previewDoc.sourceId, 'rejected', 'Document unclear')
            } else {
              toast.error('KYC documents', 'Review them from the KYC queue.')
              navigate('/documents')
            }
          }}
        />
      ) : null}
    </AppShell>
  )
}

/* ==========================================================================
   // ← NEW: Document preview modal
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
      className="dd-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      onClick={onClose}
    >
      <div
        className="dd-pop flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
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

        {/* Body — preview area */}
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
                  {doc.fileUrl ? 'Preview unavailable' : 'Preview not available'}
                </p>
                <p className="mt-1 max-w-md text-xs text-ink-muted">
                  {doc.fileUrl
                    ? 'The file could not be loaded inline. Try opening it directly.'
                    : 'This document does not have a viewable file yet. Ask the driver to re-upload it.'}
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
                      : expiryDays != null && expiryDays <= EXPIRY_WARNING_DAYS
                        ? 'font-semibold text-amber-700'
                        : 'text-ink'
                  }
                >
                  {formatDate(doc.expiresAt)}
                  {expiryDays != null ? ` (${expiryDays < 0 ? 'expired' : `${expiryDays}d left`})` : ''}
                </span>
              </div>
            ) : null}
            {doc.reviewNote ? (
              <div className="sm:col-span-2">
                <span className="font-semibold text-ink-muted">Review note: </span>
                <span className="text-ink-secondary">{doc.reviewNote}</span>
              </div>
            ) : null}
            <div className="sm:col-span-2">
              <span className="font-semibold text-ink-muted">Source: </span>
              <span className="text-ink-secondary">
                {doc.sourceKind === 'driver_doc' ? 'Driver submission' : 'KYC document'}
              </span>
            </div>
          </div>
        </div>

        {/* Footer actions */}
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
                Open in new tab
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
                onClick={() => {
                  onReject()
                  onClose()
                }}
                className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-red-100 transition-colors"
              >
                <X size={11} aria-hidden="true" />
                Reject
              </button>
              <button
                type="button"
                onClick={() => {
                  onApprove()
                  onClose()
                }}
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
   SIDEBAR FIELD (unchanged)
   ========================================================================== */

function SidebarField({
  label,
  value,
  icon,
  copyable,
  mono,
  href,
}: {
  label: string
  value: string
  icon?: React.ReactNode
  copyable?: boolean
  mono?: boolean
  href?: string
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
      <dd className={`flex items-center gap-1 text-ink font-medium ${mono ? 'font-mono' : ''}`}>
        {href ? (
          <a href={href} className="truncate hover:text-emerald transition-colors">
            {value}
          </a>
        ) : (
          <span className="truncate">{value}</span>
        )}
        {copyable && value ? (
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

/* -------------------- PROFILE TAB (unchanged) -------------------- */

function ProfileTab({
  driver,
  trips,
  earnings,
  earningsTotals,
  lifecycle,
  risk,
  kyc,
}: {
  driver: Driver
  trips: DriverTrip[]
  earnings: DriverEarningEntry[]
  earningsTotals: { gross: number; commission: number; subscription: number; net: number; tripCount: number; avgPerTrip: number }
  lifecycle: Lifecycle | null
  risk: RiskAssessment | null
  kyc: ReturnType<typeof getEntityKYC>
}) {
  const last7 = earnings.slice(-7)
  const maxNet = Math.max(...last7.map((e) => e.net), 1)
  const completed = trips.filter((t) => t.status === 'completed').length
  const cancelled = trips.filter((t) => t.status === 'cancelled').length
  const completionRate = trips.length > 0 ? completed / trips.length : 0
  const cancelRate = trips.length > 0 ? cancelled / trips.length : 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Trips (7d)" value={String(trips.length)} />
        <Stat label="Net (7d)" value={`₦${earningsTotals.net.toLocaleString()}`} />
        <Stat label="Avg per trip" value={`₦${earningsTotals.avgPerTrip.toLocaleString()}`} />
        <Stat
          label="Completion"
          value={`${Math.round(completionRate * 100)}%`}
          tone={cancelRate >= 0.3 ? 'warning' : 'success'}
        />
      </div>

      <div>
        <h3 className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-3">
          Last 7 days — net earnings
        </h3>
        <div className="flex items-end gap-2 h-32">
          {last7.map((e) => (
            <div key={e.date} className="flex-1 flex flex-col items-center gap-1.5">
              <div
                className="w-full bg-emerald-light rounded-t-md transition-all"
                style={{ height: `${Math.max((e.net / maxNet) * 100, 4)}%`, backgroundColor: 'rgb(209 250 229)' }}
                title={`₦${e.net.toLocaleString()}`}
              />
              <span className="text-[10px] text-ink-muted">{e.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MiniCard
          label="Lifecycle"
          value={lifecycle?.label ?? '—'}
          hint={lifecycle ? `${lifecycle.daysOnPlatform} days on platform` : undefined}
          tone="sky"
        />
        <MiniCard
          label="Risk score"
          value={risk ? `${risk.score}/100` : '—'}
          hint={risk?.tier ? `${risk.tier.toUpperCase()} tier` : undefined}
          tone={risk?.tier === 'high' ? 'red' : risk?.tier === 'medium' ? 'amber' : 'emerald'}
        />
        <MiniCard
          label="KYC"
          value={kyc ? `${kyc.progressPct}%` : '—'}
          hint={kyc ? `${kyc.approvedCount}/${kyc.documents.length} approved` : undefined}
          tone={kyc?.kycStatus === 'verified' ? 'emerald' : 'amber'}
        />
      </div>

      <div className="rounded-lg bg-surface-alt p-4 text-xs text-ink-secondary">
        <div className="font-semibold text-ink mb-1">Bio</div>
        <p>
          {driver.name} joined {driver.city} fleet on {driver.submittedAt}. Assigned {driver.vehicle} ({driver.plate}). All profile data verified.
          {risk && risk.reasons.length > 0 ? ` Flagged for: ${risk.reasons.join(', ')}.` : ''}
        </p>
      </div>
    </div>
  )
}

/* -------------------- VERIFICATION TAB — UPDATED for preview -------------------- */

function VerificationTab({
  documents,
  driverStatus,
  onReview,
  kyc,
  onOpenKycQueue,
  onPreview,
}: {
  documents: DriverDocument[]
  driverStatus: DriverStatus
  onReview: (id: string, status: 'approved' | 'rejected', note?: string) => void
  kyc: ReturnType<typeof getEntityKYC>
  onOpenKycQueue: () => void
  onPreview: (doc: PreviewDoc) => void // ← NEW
}) {
  return (
    <div className="space-y-6">
      {/* Selfie vs NIN side-by-side (preserved) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Selfie vs NIN Document</h3>
            <p className="text-xs text-ink-secondary mt-0.5">Side-by-side manual validation</p>
          </div>
          <StatusBadge status={STATUS_MAP[driverStatus]}>
            {driverStatus === 'pending' ? 'Awaiting Review' : 'Reviewed'}
          </StatusBadge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">
              <User size={14} aria-hidden="true" /> Selfie
            </div>
            <div className="aspect-[3/4] rounded-lg bg-surface-alt border border-dashed border-border-strong flex items-center justify-center text-sm text-ink-muted">
              <div className="text-center">
                <User size={32} className="mx-auto mb-2 opacity-40" />
                <div>Live selfie captured</div>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">
              <FileText size={14} aria-hidden="true" /> NIN Document
            </div>
            <div className="aspect-[3/4] rounded-lg bg-surface-alt border border-dashed border-border-strong flex items-center justify-center text-sm text-ink-muted">
              <div className="text-center">
                <FileText size={32} className="mx-auto mb-2 opacity-40" />
                <div>NIN slip uploaded</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KYC documents from mockDocuments (preserved, now clickable) */}
      {kyc ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald" aria-hidden="true" />
                KYC Documents ({kyc.documents.length})
              </h3>
              <p className="text-xs text-ink-secondary mt-0.5">
                {kyc.approvedCount}/{kyc.documents.length} approved · {kyc.progressPct}% complete
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenKycQueue}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
            >
              <ShieldCheck size={11} aria-hidden="true" />
              Full review
            </button>
          </div>

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
                    <FileText size={16} aria-hidden="true" />
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
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${cfg.tone === 'success' ? 'bg-emerald-light text-emerald-dark' : cfg.tone === 'danger' ? 'bg-red-50 text-danger' : cfg.tone === 'warning' ? 'bg-amber-50 text-amber-700' : 'bg-surface-alt text-ink-secondary'}`}
                  >
                    {cfg.label}
                  </span>
                  <Eye size={13} className="shrink-0 text-ink-muted" aria-hidden="true" />
                </div>
              )
            })}
          </div>

          {kyc.missingTypes.length > 0 ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-semibold">Missing: </span>
                {kyc.missingTypes.map((t) => KYC_TYPE_META[t].shortLabel).join(', ')}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Legacy DriverDocument list (preserved, now clickable) */}
      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">
          Pending Reviews ({documents.length})
        </h3>
        <div className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-xs text-ink-muted py-4 text-center">No documents on file.</p>
          ) : (
            documents.map((doc) => {
              const tone = DOC_STATUS_MAP[doc.status]
              return (
                <div
                  key={doc.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onPreview(toPreviewFromLegacy(doc))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onPreview(toPreviewFromLegacy(doc))
                    }
                  }}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:border-emerald/60 hover:bg-surface-alt/40 transition-colors"
                >
                  <div
                    className={
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ' +
                      (doc.status === 'approved'
                        ? 'bg-emerald-light text-emerald'
                        : doc.status === 'pending'
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-red-50 text-danger')
                    }
                  >
                    {doc.status === 'pending' ? (
                      <FileWarning size={16} aria-hidden="true" />
                    ) : (
                      <FileText size={16} aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink truncate">{doc.label}</div>
                    <div className="text-[11px] text-ink-secondary truncate">
                      {doc.fileName} · uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                    </div>
                    {doc.reviewNote ? (
                      <div className="text-[10px] text-emerald mt-0.5 truncate">Note: {doc.reviewNote}</div>
                    ) : null}
                  </div>
                  <StatusBadge status={tone}>
                    {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                  </StatusBadge>
                  {doc.status === 'pending' ? (
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReview(doc.id, 'approved', 'Verified by admin')
                        }}
                        className="p-1.5 rounded-lg hover:bg-emerald-light text-emerald transition-colors"
                        aria-label={`Approve ${doc.label}`}
                        title="Approve"
                      >
                        <Check size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onReview(doc.id, 'rejected', 'Document unclear')
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-danger transition-colors"
                        aria-label={`Reject ${doc.label}`}
                        title="Reject"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  ) : null}
                  <Eye size={13} className="shrink-0 text-ink-muted" aria-hidden="true" />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}

/* -------------------- TRIPS TAB (unchanged) -------------------- */

function TripsTab({ trips }: { trips: DriverTrip[] }) {
  const [filter, setFilter] = useState<TripFilter>('all')
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
        if (filter !== 'all' && t.status !== filter) return false
        if (q) {
          const hay = [t.rideId, t.riderName, t.pickup, t.destination].join(' ').toLowerCase()
          if (!hay.includes(q)) return false
        }
        return true
      })
      .sort((a, b) => {
        if (sort === 'fare') return b.fare - a.fare
        return Date.parse(b.completedAt) - Date.parse(a.completedAt)
      })
  }, [trips, filter, search, sort])

  if (trips.length === 0) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="No trips yet"
        description="This driver hasn't completed any rides."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Total" value={String(counts.all)} />
        <Stat label="Completed" value={String(counts.completed)} tone="success" />
        <Stat label="Cancelled" value={String(counts.cancelled)} tone="warning" />
        <Stat label="In progress" value={String(counts.in_progress)} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={12} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by rider, ride ID, route…"
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as 'date' | 'fare')}
          aria-label="Sort trips"
          className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none"
        >
          <option value="date">Newest first</option>
          <option value="fare">Highest fare</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'completed', 'cancelled', 'in_progress'] as TripFilter[]).map((key) => {
          const active = filter === key
          const labels: Record<TripFilter, string> = {
            all: 'All',
            completed: 'Completed',
            cancelled: 'Cancelled',
            in_progress: 'In progress',
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
                <span className={`text-[10px] font-bold ${active ? 'text-white/80' : 'text-ink-muted'}`}>
                  {counts[key]}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">No trips match the current filter.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((trip) => (
            <div key={trip.id} className="flex items-center gap-3 rounded-lg border border-border p-3 hover:border-border-strong transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs text-ink font-medium">#{trip.rideId.replace('rd_', '')}</span>
                  <StatusBadge status={trip.status === 'completed' ? 'success' : trip.status === 'cancelled' ? 'neutral' : 'info'}>
                    {trip.status.replace('_', ' ')}
                  </StatusBadge>
                </div>
                <div className="text-xs text-ink-secondary truncate">
                  {trip.riderName} · {trip.pickup} → {trip.destination}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-sm font-semibold text-ink">₦{trip.fare.toLocaleString()}</div>
                <div className="text-[10px] text-ink-muted">
                  {new Date(trip.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* -------------------- EARNINGS TAB (unchanged) -------------------- */

function EarningsTab({
  earnings,
  totals,
}: {
  earnings: DriverEarningEntry[]
  totals: { gross: number; commission: number; subscription: number; net: number; tripCount: number; avgPerTrip: number }
}) {
  const [period, setPeriod] = useState<7 | 30 | 0>(7)
  const visible = period === 0 ? earnings : earnings.slice(-period)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-1.5">
        {([{ v: 7 as const, l: '7 days' }, { v: 30 as const, l: '30 days' }, { v: 0 as const, l: 'All' }]).map((p) => {
          const active = period === p.v
          return (
            <button
              key={p.v}
              type="button"
              onClick={() => setPeriod(p.v)}
              aria-pressed={active}
              className={[
                'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors',
                active
                  ? 'border-emerald bg-emerald text-white'
                  : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
              ].join(' ')}
            >
              {p.l}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Gross" value={`₦${totals.gross.toLocaleString()}`} />
        <Stat label="Commission" value={`-₦${totals.commission.toLocaleString()}`} tone="warning" />
        <Stat label="Subscriptions" value={`-₦${totals.subscription.toLocaleString()}`} tone="warning" />
        <Stat label="Net" value={`₦${totals.net.toLocaleString()}`} tone="success" />
      </div>

      <div>
        <h3 className="text-sm font-semibold text-ink mb-3">Daily breakdown</h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-alt/40">
              <tr className="border-b border-border">
                <th className="text-left font-semibold text-ink-secondary text-[11px] uppercase tracking-wider px-3 py-2">Date</th>
                <th className="text-right font-semibold text-ink-secondary text-[11px] uppercase tracking-wider px-3 py-2">Trips</th>
                <th className="text-right font-semibold text-ink-secondary text-[11px] uppercase tracking-wider px-3 py-2">Gross</th>
                <th className="text-right font-semibold text-ink-secondary text-[11px] uppercase tracking-wider px-3 py-2">Commission</th>
                <th className="text-right font-semibold text-ink-secondary text-[11px] uppercase tracking-wider px-3 py-2">Sub</th>
                <th className="text-right font-semibold text-ink-secondary text-[11px] uppercase tracking-wider px-3 py-2">Net</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <tr key={e.date} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2 text-xs text-ink">
                    {new Date(e.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-3 py-2 text-right text-xs text-ink-secondary">{e.trips}</td>
                  <td className="px-3 py-2 text-right text-xs text-ink font-medium">₦{e.gross.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-xs text-warning">-₦{e.commission.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-xs text-warning">-₦{e.subscription.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-xs font-semibold text-emerald">₦{e.net.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

/* -------------------- PAYOUTS TAB (unchanged) -------------------- */

function PayoutsTab({
  payouts,
  onReview,
}: {
  payouts: DriverPayout[]
  onReview: (id: string, status: 'approved' | 'rejected' | 'paid') => void
}) {
  const [filter, setFilter] = useState<PayoutFilter>('all')

  const counts = useMemo(
    () => ({
      all: payouts.length,
      pending: payouts.filter((p) => p.status === 'pending').length,
      approved: payouts.filter((p) => p.status === 'approved').length,
      paid: payouts.filter((p) => p.status === 'paid').length,
      rejected: payouts.filter((p) => p.status === 'rejected').length,
    }),
    [payouts],
  )

  const filtered = filter === 'all' ? payouts : payouts.filter((p) => p.status === filter)

  if (payouts.length === 0) {
    return (
      <EmptyState
        icon={Wallet}
        title="No payouts yet"
        description="This driver hasn't requested any withdrawals."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'pending', 'approved', 'paid', 'rejected'] as PayoutFilter[]).map((key) => {
          const active = filter === key
          const labels: Record<PayoutFilter, string> = {
            all: 'All',
            pending: 'Pending',
            approved: 'Approved',
            paid: 'Paid',
            rejected: 'Rejected',
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
                <span className={`text-[10px] font-bold ${active ? 'text-white/80' : 'text-ink-muted'}`}>{counts[key]}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <p className="py-6 text-center text-xs text-ink-muted">No payouts match this filter.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const cfg = PAYOUT_STATUS_MAP[p.status]
            return (
              <div key={p.id} className="rounded-lg border border-border p-4 flex items-center gap-4 hover:border-border-strong transition-colors">
                <div className="w-10 h-10 rounded-lg bg-navy text-white flex items-center justify-center flex-shrink-0">
                  <Wallet size={16} aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-ink">₦{p.amount.toLocaleString()}</span>
                    <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
                  </div>
                  <div className="text-[11px] text-ink-secondary truncate">
                    {p.bank} · requested {new Date(p.requestedAt).toLocaleDateString()}
                  </div>
                  {p.adminNote ? (
                    <div className="text-[10px] text-info mt-0.5">Note: {p.adminNote}</div>
                  ) : null}
                </div>
                {p.status === 'pending' ? (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onReview(p.id, 'approved')}
                      className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onReview(p.id, 'rejected')}
                      className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-danger hover:bg-red-100 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                ) : p.status === 'approved' ? (
                  <button
                    type="button"
                    onClick={() => onReview(p.id, 'paid')}
                    className="rounded-md border border-emerald bg-emerald-light px-2.5 py-1 text-[11px] font-semibold text-emerald hover:bg-emerald/20 transition-colors"
                  >
                    Mark paid
                  </button>
                ) : (
                  <Clock size={14} className="text-ink-muted" aria-hidden="true" />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* -------------------- ACTIVITY TAB (unchanged) -------------------- */

type ActivityItem = {
  id: string
  at: number
  kind: 'trip' | 'earning' | 'payout' | 'doc' | 'note'
  title: string
  meta?: string
  tone: 'success' | 'danger' | 'warning' | 'info' | 'default'
}

function ActivityTab({
  trips,
  earnings,
  payouts,
  docs,
  notes,
}: {
  trips: DriverTrip[]
  earnings: DriverEarningEntry[]
  payouts: DriverPayout[]
  docs: DriverDocument[]
  notes: AdminNote[]
}) {
  const [kind, setKind] = useState<'all' | ActivityItem['kind']>('all')

  const items = useMemo<ActivityItem[]>(() => {
    const out: ActivityItem[] = []
    for (const t of trips) {
      out.push({
        id: `trip-${t.id}`,
        at: Date.parse(t.completedAt),
        kind: 'trip',
        title: `Ride #${t.rideId.replace('rd_', '')} · ${t.status.replace('_', ' ')}`,
        meta: `${t.riderName} · ${t.pickup} → ${t.destination} · ₦${t.fare.toLocaleString()}`,
        tone: t.status === 'completed' ? 'success' : t.status === 'cancelled' ? 'default' : 'info',
      })
    }
    for (const e of earnings) {
      out.push({
        id: `earn-${e.date}`,
        at: Date.parse(e.date),
        kind: 'earning',
        title: `Earnings · ₦${e.net.toLocaleString()} net`,
        meta: `${e.trips} trips · ₦${e.gross.toLocaleString()} gross`,
        tone: 'success',
      })
    }
    for (const p of payouts) {
      out.push({
        id: `pay-${p.id}`,
        at: Date.parse(p.requestedAt),
        kind: 'payout',
        title: `Payout request · ₦${p.amount.toLocaleString()}`,
        meta: `${p.bank} · ${p.status}`,
        tone: p.status === 'paid' ? 'success' : p.status === 'rejected' ? 'danger' : 'warning',
      })
    }
    for (const d of docs) {
      out.push({
        id: `doc-${d.id}`,
        at: Date.parse(d.uploadedAt),
        kind: 'doc',
        title: `Document · ${d.label}`,
        meta: `${d.status} · ${d.fileName}`,
        tone: d.status === 'approved' ? 'success' : d.status === 'rejected' ? 'danger' : 'warning',
      })
    }
    for (const n of notes) {
      out.push({
        id: `note-${n.id}`,
        at: n.createdAt,
        kind: 'note',
        title: 'Admin note',
        meta: n.body.slice(0, 80),
        tone: 'info',
      })
    }
    return out.sort((a, b) => b.at - a.at)
  }, [trips, earnings, payouts, docs, notes])

  const filtered = kind === 'all' ? items : items.filter((i) => i.kind === kind)

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No activity yet"
        description="Nothing has happened for this driver yet."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', 'trip', 'earning', 'payout', 'doc', 'note'] as const).map((key) => {
          const active = kind === key
          const labels: Record<typeof key, string> = {
            all: 'All',
            trip: 'Trips',
            earning: 'Earnings',
            payout: 'Payouts',
            doc: 'Documents',
            note: 'Notes',
          }
          return (
            <button
              key={key}
              type="button"
              onClick={() => setKind(key)}
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
        <p className="py-6 text-center text-xs text-ink-muted">No activity of this kind.</p>
      ) : (
        <ol className="relative space-y-3 pl-5">
          <span aria-hidden="true" className="absolute left-1.5 top-1 bottom-1 w-px bg-border" />
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
                {formatRelativeTime(new Date(item.at).toISOString())}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/* -------------------- NOTES TAB (unchanged) -------------------- */

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
        <p className="py-6 text-center text-xs text-ink-muted">No notes yet. Add one above.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-border bg-surface p-3 hover:border-border-strong transition-colors">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="whitespace-pre-wrap text-xs text-ink leading-relaxed">{n.body}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[10px] text-ink-muted">
                    <span>{n.author}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatRelativeTime(new Date(n.createdAt).toISOString())}</span>
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

/* -------------------- SHARED SUBCOMPONENTS (unchanged) -------------------- */

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
    tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-emerald' : 'text-ink'
  return (
    <div className="rounded-lg border border-border p-3">
      <div className="text-[10px] uppercase tracking-wide text-ink-muted mb-1">{label}</div>
      <div className={'text-lg font-bold ' + color}>{value}</div>
    </div>
  )
}

function MiniCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone: 'emerald' | 'amber' | 'red' | 'sky'
}) {
  const toneClass = {
    emerald: 'bg-emerald-light/40 text-emerald-dark',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-danger',
    sky: 'bg-sky-50 text-sky-700',
  }[tone]
  return (
    <div className={`rounded-lg border border-border p-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-80 mb-1">
        {label}
      </div>
      <div className="text-base font-bold">{value}</div>
      {hint ? <div className="text-[10px] opacity-70 mt-0.5">{hint}</div> : null}
    </div>
  )
}