import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ClipboardCopy,
  Clock,
  Download,
  Eye,
  FileCheck,
  FileJson,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserCheck,
  UserX,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { ErrorState } from '../../../components/shared/ErrorState'
import {
  DataTable,
  type BulkAction,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { BRAND } from '../../../config/brand'
import { toast } from '../../../lib/toast'
import {
  useApproveDriver,
  useDrivers,
  useRejectDriver,
} from '../../../hooks/queries/useDrivers'
import type { Driver, DriverStatus } from '../data/mockDrivers'

import {
  DOCUMENT_STATUS_META,
  DOCUMENT_TYPE_META,
  daysUntil,
  formatBytes,
  formatDate,
  formatRelativeTime,
  getEntityKYC,
  isExpiringSoon,
  type Document,
  type EntityKYC,
} from '../../documents/data/mockDocuments'

/* ==========================================================================
   CONFIG (original STATUS_MAP preserved)
   ========================================================================== */

const STATUS_MAP: Record<DriverStatus, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

const EXPIRY_WARNING_DAYS = 30
const STALE_SUBMISSION_DAYS = 7

type PendingAction =
  | { type: 'approve'; driver: Driver }
  | { type: 'reject'; driver: Driver }
  | null

type TabKey = 'all' | 'pending' | 'approved' | 'rejected' | 'attention' | 'docs_ready'

const TABS: Array<{ key: TabKey; label: string; icon: typeof UserCheck }> = [
  { key: 'all', label: 'All drivers', icon: UserCheck },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'rejected', label: 'Rejected', icon: UserX },
  { key: 'attention', label: 'Needs attention', icon: AlertTriangle },
  { key: 'docs_ready', label: 'KYC verified', icon: ShieldCheck },
]

const ANIMATIONS = `
  @keyframes dv-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dv-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes dv-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes dv-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes dv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes dv-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .dv-fade-up { animation: dv-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .dv-fade-in { animation: dv-fade-in .2s ease both; }
  .dv-slide-in { animation: dv-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .dv-pop { animation: dv-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .dv-pulse { animation: dv-pulse 1.5s ease-in-out infinite; }
  .dv-shimmer { position: relative; overflow: hidden; }
  .dv-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .dv-shimmer:hover::after { animation: dv-shimmer 1s ease; }
  .dv-stagger > * { animation: dv-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .dv-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .dv-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .dv-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .dv-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .dv-stagger > *:nth-child(5) { animation-delay: 240ms; }
  @media (prefers-reduced-motion: reduce) {
    .dv-fade-up, .dv-fade-in, .dv-slide-in, .dv-pop, .dv-pulse,
    .dv-stagger > *, .dv-shimmer:hover::after { animation: none !important; }
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

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
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
  return `drivers-${stamp}.${ext}`
}

type DriverKYC = {
  kyc: EntityKYC | null
  rejected: number
  expired: number
  expiring: number
  pending: number
  approved: number
  total: number
  hasIssue: boolean
}

function computeKyc(id: string): DriverKYC {
  const kyc = getEntityKYC('driver', id)
  if (!kyc) {
    return { kyc: null, rejected: 0, expired: 0, expiring: 0, pending: 0, approved: 0, total: 0, hasIssue: false }
  }
  const rejected = kyc.documents.filter((d) => d.status === 'rejected').length
  const expired = kyc.documents.filter(
    (d) => d.status === 'expired' || (d.expiresAt && (daysUntil(d.expiresAt) ?? 1) < 0),
  ).length
  const expiring = kyc.documents.filter((d) => isExpiringSoon(d)).length
  return {
    kyc,
    rejected,
    expired,
    expiring,
    pending: kyc.pendingCount,
    approved: kyc.approvedCount,
    total: kyc.documents.length,
    hasIssue: rejected > 0 || expired > 0 || expiring > 0,
  }
}

function buildDriverSummary(d: Driver, kyc: DriverKYC): string {
  const parts = [
    `Driver: ${d.name}`,
    `Phone: ${d.phone}`,
    `City: ${d.city}`,
    `Vehicle: ${d.vehicle}`,
    `Plate: ${d.plate}`,
    `Status: ${d.status}`,
    `Submitted: ${d.submittedAt}`,
  ]
  if (kyc.kyc) {
    parts.push(`KYC: ${kyc.kyc.kycStatus} (${kyc.approved}/${kyc.total} approved)`)
  }
  return parts.join('\n')
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function DriversPage() {
  const navigate = useNavigate()
  const { data: drivers = [], isLoading, isError, error, refetch } = useDrivers()
  const approve = useApproveDriver()
  const reject = useRejectDriver()

  /* ---------------------------- state ---------------------------- */

  const [pending, setPending] = useState<PendingAction>(null)
  const [tab, setTab] = useState<TabKey>('pending')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now())
  const [kycVersion, setKycVersion] = useState(0)

  const copiedTimerRef = useRef<number | null>(null)
  const isWorking = approve.isPending || reject.isPending

  /* ---------------------------- derived -------------------------- */

  // Recompute KYC when drivers list or a mutation occurs
  const kycByDriver = useMemo(() => {
    const map = new Map<string, DriverKYC>()
    for (const d of drivers) map.set(d.id, computeKyc(d.id))
    return map
    // kycVersion forces refresh after document mutations
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drivers, kycVersion])

  const counts = useMemo(() => {
    let pendingCount = 0
    let approvedCount = 0
    let rejectedCount = 0
    let attentionCount = 0
    let docsReadyCount = 0

    for (const d of drivers) {
      if (d.status === 'pending') pendingCount += 1
      else if (d.status === 'approved') approvedCount += 1
      else if (d.status === 'rejected') rejectedCount += 1
      const kyc = kycByDriver.get(d.id)
      if (kyc?.hasIssue) attentionCount += 1
      if (kyc?.kyc?.kycStatus === 'verified') docsReadyCount += 1
    }

    return {
      all: drivers.length,
      pending: pendingCount,
      approved: approvedCount,
      rejected: rejectedCount,
      attention: attentionCount,
      docs_ready: docsReadyCount,
    }
  }, [drivers, kycByDriver])

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'pending':
        return drivers.filter((d) => d.status === 'pending')
      case 'approved':
        return drivers.filter((d) => d.status === 'approved')
      case 'rejected':
        return drivers.filter((d) => d.status === 'rejected')
      case 'attention':
        return drivers.filter((d) => kycByDriver.get(d.id)?.hasIssue)
      case 'docs_ready':
        return drivers.filter((d) => kycByDriver.get(d.id)?.kyc?.kycStatus === 'verified')
      default:
        return drivers
    }
  }, [drivers, tab, kycByDriver])

  const stats = useMemo(() => {
    let staleCount = 0
    let pendingDocsTotal = 0
    let expiringTotal = 0

    for (const d of drivers) {
      if (d.status === 'pending') {
        const days = daysSince(d.submittedAt)
        if (days != null && days >= STALE_SUBMISSION_DAYS) staleCount += 1
      }
      const kyc = kycByDriver.get(d.id)
      if (kyc) {
        pendingDocsTotal += kyc.pending
        expiringTotal += kyc.expiring
      }
    }

    return {
      total: drivers.length,
      pending: counts.pending,
      approved: counts.approved,
      rejected: counts.rejected,
      attention: counts.attention,
      staleCount,
      pendingDocsTotal,
      expiringTotal,
    }
  }, [drivers, kycByDriver, counts])

  const detail = useMemo(
    () => (detailId ? drivers.find((d) => d.id === detailId) ?? null : null),
    [drivers, detailId],
  )

  const detailKyc = useMemo(
    () => (detail ? kycByDriver.get(detail.id) ?? null : null),
    [detail, kycByDriver],
  )

  /* --------------------------- effects --------------------------- */

  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

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
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, pending, isWorking, tabFiltered, tab])

  /* --------------------------- handlers -------------------------- */

  const handleConfirm = async () => {
    if (!pending) return

    try {
      if (pending.type === 'approve') {
        await approve.mutateAsync(pending.driver.id)
        toast.success(`${pending.driver.name} approved`, 'Driver can now accept rides.')
      } else {
        await reject.mutateAsync(pending.driver.id)
        toast.warning(`${pending.driver.name} rejected`, 'Driver has been notified.')
      }
      setPending(null)
      setKycVersion((v) => v + 1)
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Please try again.')
    }
  }

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setKycVersion((v) => v + 1)
      setLastUpdated(Date.now())
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleExportCSV = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No drivers match the current view.')
      return
    }
    const headers = [
      'id', 'name', 'phone', 'city', 'vehicle', 'plate',
      'submittedAt', 'status',
      'kycStatus', 'docsApproved', 'docsPending', 'docsRejected', 'docsExpiring',
    ]
    const lines = [headers.join(',')]
    for (const d of rows) {
      const kyc = kycByDriver.get(d.id)
      lines.push(
        [
          d.id, d.name, d.phone, d.city, d.vehicle, d.plate,
          d.submittedAt, d.status,
          kyc?.kyc?.kycStatus ?? 'not_started',
          String(kyc?.approved ?? 0),
          String(kyc?.pending ?? 0),
          String(kyc?.rejected ?? 0),
          String(kyc?.expiring ?? 0),
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success('CSV exported', `${rows.length} ${rows.length === 1 ? 'driver' : 'drivers'} downloaded.`)
  }, [tabFiltered, kycByDriver])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No drivers match the current view.')
      return
    }
    const payload = {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      stats,
      drivers: rows.map((d) => {
        const kyc = kycByDriver.get(d.id)
        return {
          ...d,
          kyc: kyc?.kyc
            ? {
                kycStatus: kyc.kyc.kycStatus,
                progressPct: kyc.kyc.progressPct,
                approved: kyc.approved,
                pending: kyc.pending,
                rejected: kyc.rejected,
                expired: kyc.expired,
                expiring: kyc.expiring,
                missingTypes: kyc.kyc.missingTypes,
              }
            : null,
        }
      }),
    }
    downloadFile(JSON.stringify(payload, null, 2), isoFilename('json'), 'application/json')
    toast.success('JSON exported', `${rows.length} ${rows.length === 1 ? 'driver' : 'drivers'} downloaded.`)
  }, [tabFiltered, tab, stats, kycByDriver])

  const handleCopy = useCallback(async (d: Driver) => {
    const kyc = kycByDriver.get(d.id) ?? computeKyc(d.id)
    try {
      await navigator.clipboard.writeText(buildDriverSummary(d, kyc))
      setCopied(d.id)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [kycByDriver])

  /* --------------------------- columns --------------------------- */

  const columns: DataTableColumn<Driver>[] = [
    {
      key: 'name',
      header: 'Driver',
      accessor: (r) => r.name,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-semibold">
            {r.name.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ink truncate">{r.name}</div>
            <div className="text-xs text-ink-secondary truncate">{r.phone}</div>
          </div>
        </div>
      ),
    },
    { key: 'city', header: 'City', accessor: (r) => r.city, sortable: true },
    {
      key: 'vehicle',
      header: 'Vehicle',
      accessor: (r) => r.vehicle,
      render: (r) => (
        <div>
          <div className="text-ink">{r.vehicle}</div>
          <div className="text-xs text-ink-secondary font-mono">{r.plate}</div>
        </div>
      ),
    },
    {
      key: 'kyc',
      header: 'KYC',
      render: (r) => {
        const kyc = kycByDriver.get(r.id)
        if (!kyc || !kyc.kyc) {
          return (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-alt px-1.5 py-0.5 text-[10px] font-medium text-ink-muted">
              <FileText size={9} aria-hidden="true" />
              No docs
            </span>
          )
        }
        const { kycStatus, progressPct } = kyc.kyc
        const tone =
          kycStatus === 'verified'
            ? 'bg-emerald-light text-emerald-dark'
            : kycStatus === 'rejected' || kycStatus === 'expired'
              ? 'bg-red-50 text-danger'
              : kycStatus === 'in_review'
                ? 'bg-amber-50 text-amber-700'
                : 'bg-surface-alt text-ink-secondary'
        return (
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
              title={`KYC ${kycStatus} · ${kyc.approved}/${kyc.total} approved`}
            >
              {kycStatus === 'verified' ? (
                <ShieldCheck size={9} aria-hidden="true" />
              ) : kycStatus === 'rejected' || kycStatus === 'expired' ? (
                <ShieldAlert size={9} aria-hidden="true" />
              ) : (
                <FileCheck size={9} aria-hidden="true" />
              )}
              {progressPct}%
            </span>
            {kyc.rejected > 0 ? (
              <span
                title={`${kyc.rejected} rejected document${kyc.rejected === 1 ? '' : 's'}`}
                className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-1 text-[9px] font-bold text-danger"
              >
                <X size={8} aria-hidden="true" />
                {kyc.rejected}
              </span>
            ) : null}
            {kyc.expiring > 0 ? (
              <span
                title={`${kyc.expiring} document${kyc.expiring === 1 ? '' : 's'} expiring within 30 days`}
                className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-700"
              >
                <Clock size={8} aria-hidden="true" />
                {kyc.expiring}
              </span>
            ) : null}
          </div>
        )
      },
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      accessor: (r) => r.submittedAt,
      sortable: true,
      render: (r) => {
        const days = daysSince(r.submittedAt)
        const stale = r.status === 'pending' && days != null && days >= STALE_SUBMISSION_DAYS
        return (
          <div>
            <div className="text-ink-secondary text-xs">{r.submittedAt}</div>
            {stale ? (
              <div className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-600">
                <AlertTriangle size={9} aria-hidden="true" />
                {days}d waiting
              </div>
            ) : days != null && days < 1 ? (
              <div className="text-[10px] text-emerald">Today</div>
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
      render: (r) => (
        <StatusBadge status={STATUS_MAP[r.status]}>
          {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
        </StatusBadge>
      ),
    },
  ]

  /* --------------------------- filters --------------------------- */

  const filters: DataTableFilter<Driver>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'pending', label: 'Pending' },
        { value: 'approved', label: 'Approved' },
        { value: 'rejected', label: 'Rejected' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'city',
      label: 'City',
      options: [
        { value: 'Ibadan', label: 'Ibadan' },
        { value: 'Lagos', label: 'Lagos' },
        { value: 'Abuja', label: 'Abuja' },
      ],
      apply: (row, value) => row.city === value,
    },
    {
      key: 'kyc',
      label: 'KYC',
      options: [
        { value: 'verified', label: 'Verified' },
        { value: 'issues', label: 'Has issues' },
        { value: 'incomplete', label: 'Incomplete' },
      ],
      apply: (row, value) => {
        const kyc = kycByDriver.get(row.id)
        if (value === 'verified') return kyc?.kyc?.kycStatus === 'verified'
        if (value === 'issues') return !!kyc?.hasIssue
        if (value === 'incomplete') return !kyc?.kyc || kyc.kyc.kycStatus !== 'verified'
        return true
      },
    },
  ]

  /* ----------------------- bulk actions -------------------------- */

  const bulkActions: BulkAction<Driver>[] = [
    {
      key: 'export',
      label: 'Export selected',
      onRun: (rows) => {
        if (rows.length === 0) return
        const headers = [
          'id', 'name', 'phone', 'city', 'vehicle', 'plate', 'submittedAt', 'status',
        ]
        const lines = [headers.join(',')]
        for (const d of rows) {
          lines.push(
            [d.id, d.name, d.phone, d.city, d.vehicle, d.plate, d.submittedAt, d.status]
              .map((v) => escapeCSV(String(v ?? '')))
              .join(','),
          )
        }
        downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
        toast.success(`${rows.length} drivers exported`)
      },
    },
    {
      key: 'approve',
      label: 'Approve selected',
      tone: 'primary',
      onRun: async (rows) => {
        // 🟡 BACKEND REQUIRED — bulk endpoint once available
        // For now: sequential calls to /admin/drivers/:id/approve
        let ok = 0
        let failed = 0
        for (const d of rows) {
          try {
            await approve.mutateAsync(d.id)
            ok++
          } catch {
            failed++
          }
        }
        setKycVersion((v) => v + 1)
        if (failed === 0) {
          toast.success(`${ok} drivers approved`, 'All selected drivers are now live.')
        } else {
          toast.warning(
            `${ok} approved · ${failed} failed`,
            'Some drivers could not be processed.',
          )
        }
      },
    },
    {
      key: 'reject',
      label: 'Reject selected',
      tone: 'danger',
      onRun: async (rows) => {
        let ok = 0
        let failed = 0
        for (const d of rows) {
          try {
            await reject.mutateAsync(d.id)
            ok++
          } catch {
            failed++
          }
        }
        setKycVersion((v) => v + 1)
        if (failed === 0) {
          toast.warning(`${ok} drivers rejected`, 'Drivers have been notified.')
        } else {
          toast.warning(
            `${ok} rejected · ${failed} failed`,
            'Some drivers could not be processed.',
          )
        }
      },
    },
  ]

  /* ------------------------ error state -------------------------- */

  if (isError) {
    return (
      <AppShell title="Driver Clearance Queue">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load drivers"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render --------------------------- */

  return (
    <AppShell title="Driver Clearance Queue">
      <style>{ANIMATIONS}</style>

      {/* -------------------- KPI cards -------------------- */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 dv-stagger">
        <KpiCard
          icon={<Clock size={14} aria-hidden="true" />}
          tone="amber"
          label="Pending review"
          value={String(stats.pending)}
          hint={
            stats.staleCount > 0
              ? `${stats.staleCount} waiting ${STALE_SUBMISSION_DAYS}+ days`
              : 'All fresh'
          }
        />
        <KpiCard
          icon={<CheckCircle2 size={14} aria-hidden="true" />}
          tone="emerald"
          label="Approved"
          value={String(stats.approved)}
          hint={`${counts.docs_ready} KYC verified`}
        />
        <KpiCard
          icon={<UserX size={14} aria-hidden="true" />}
          tone="red"
          label="Rejected"
          value={String(stats.rejected)}
          hint="Driver blocked"
        />
        <KpiCard
          icon={<FileCheck size={14} aria-hidden="true" />}
          tone="sky"
          label="Docs pending"
          value={String(stats.pendingDocsTotal)}
          hint="Across all drivers"
        />
        <KpiCard
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone="amber"
          label="Needs attention"
          value={String(stats.attention)}
          hint={
            stats.expiringTotal > 0
              ? `${stats.expiringTotal} expiring soon`
              : 'No flags'
          }
        />
      </div>

      {/* -------------------- Tabs + actions -------------------- */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 dv-fade-up">
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
                      'dv-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'attention'
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
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald dv-pulse" aria-hidden="true" />
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
            onClick={() => navigate('/documents')}
            title="Open KYC review queue"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <ShieldCheck size={12} aria-hidden="true" />
            <span className="hidden sm:inline">KYC queue</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export CSV (Ctrl/Cmd + E)"
            className="dv-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
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

      {/* -------------------- Table -------------------- */}
      <DataTable
        data={tabFiltered}
        columns={columns}
        rowKey={(r) => r.id}
        filters={filters}
        searchable
        searchPlaceholder="Search by name, phone, plate…"
        searchFn={(r, q) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.plate.toLowerCase().includes(q)
        }
        pageSize={5}
        loading={isLoading}
        title="Pending Driver Clearance"
        selectable
        bulkActions={bulkActions}
        isRowSelectable={(r) => r.status === 'pending'}
        viewKey="drivers"
        exportFileName="drivers"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setDetailId(r.id)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View driver"
              title="View driver"
            >
              <Eye size={15} aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleCopy(r)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="Copy driver summary"
              title={copied === r.id ? 'Copied' : 'Copy summary'}
            >
              {copied === r.id ? (
                <Check size={15} className="text-emerald" aria-hidden="true" />
              ) : (
                <ClipboardCopy size={15} aria-hidden="true" />
              )}
            </button>

            {r.status === 'pending' ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPending({ type: 'approve', driver: r })
                  }}
                  className="p-1.5 rounded-lg hover:bg-emerald-light text-emerald transition-colors"
                  aria-label="Approve driver"
                  title="Approve"
                >
                  <Check size={15} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPending({ type: 'reject', driver: r })
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-danger transition-colors"
                  aria-label="Reject driver"
                  title="Reject"
                >
                  <X size={15} aria-hidden="true" />
                </button>
              </>
            ) : null}
          </div>
        )}
      />

      {/* -------------------- Confirm modal (preserved) -------------------- */}
      <ConfirmModal
        open={pending !== null}
        title={
          pending?.type === 'approve'
            ? `Approve ${pending.driver.name}?`
            : pending?.type === 'reject'
              ? `Reject ${pending.driver.name}?`
              : ''
        }
        description={
          pending?.type === 'approve'
            ? `This driver will be cleared to accept rides on ${BRAND.name}.`
            : 'This driver will be blocked from accepting rides. They will be notified.'
        }
        confirmLabel={pending?.type === 'approve' ? 'Approve' : 'Reject'}
        variant={pending?.type === 'reject' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />

      {/* -------------------- Detail drawer -------------------- */}
      {detail ? (
        <div
          className="dv-fade-in fixed inset-0 z-40 flex justify-end bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-label="Driver details"
          onClick={() => setDetailId(null)}
        >
          <div
            className="dv-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-semibold text-white">
                  {initials(detail.name)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-bold text-ink truncate">{detail.name}</h2>
                    <StatusBadge status={STATUS_MAP[detail.status]}>
                      {detail.status.charAt(0).toUpperCase() + detail.status.slice(1)}
                    </StatusBadge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    Submitted {formatRelativeTime(detail.submittedAt)}
                  </p>
                </div>
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
              {/* Contact */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Contact
                </div>
                <a
                  href={`tel:${detail.phone.replace(/\s/g, '')}`}
                  className="flex items-center gap-2 text-xs text-ink hover:text-emerald transition-colors"
                >
                  <Phone size={12} className="text-ink-muted" aria-hidden="true" />
                  {detail.phone}
                </a>
                <div className="flex items-center gap-2 text-xs text-ink-secondary">
                  <MapPin size={12} className="text-ink-muted" aria-hidden="true" />
                  {detail.city}
                </div>
              </div>

              {/* Vehicle */}
              <div className="rounded-lg border border-border bg-surface-alt/40 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  <Car size={11} aria-hidden="true" />
                  Vehicle
                </div>
                <div className="text-sm font-semibold text-ink">{detail.vehicle}</div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="rounded bg-navy px-1.5 py-0.5 font-mono text-[11px] font-bold text-white">
                    {detail.plate}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(detail.plate)
                      toast.success('Plate copied')
                    }}
                    className="rounded p-0.5 text-ink-muted hover:text-emerald"
                    aria-label="Copy plate"
                  >
                    <ClipboardCopy size={10} aria-hidden="true" />
                  </button>
                </div>
              </div>

              {/* KYC section */}
              {detailKyc && detailKyc.kyc ? (
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                      <ShieldCheck size={11} aria-hidden="true" />
                      KYC documents
                    </div>
                    <span className="text-[11px] font-semibold text-ink tabular-nums">
                      {detailKyc.approved}/{detailKyc.total} · {detailKyc.kyc.progressPct}%
                    </span>
                  </div>

                  <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className={`dv-pop h-full rounded-full transition-all ${
                        detailKyc.kyc.kycStatus === 'verified'
                          ? 'bg-emerald'
                          : detailKyc.kyc.kycStatus === 'rejected' ||
                              detailKyc.kyc.kycStatus === 'expired'
                            ? 'bg-red-500'
                            : 'bg-amber-500'
                      }`}
                      style={{ width: `${detailKyc.kyc.progressPct}%` }}
                    />
                  </div>

                  <ul className="space-y-1.5">
                    {detailKyc.kyc.documents.map((d) => (
                      <KycDocRow key={d.id} doc={d} />
                    ))}
                  </ul>

                  {detailKyc.kyc.missingTypes.length > 0 ? (
                    <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-700">
                      <span className="font-semibold">Missing: </span>
                      {detailKyc.kyc.missingTypes
                        .map((t) => DOCUMENT_TYPE_META[t].shortLabel)
                        .join(', ')}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => {
                      setDetailId(null)
                      navigate('/documents')
                    }}
                    className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                  >
                    <ShieldCheck size={11} aria-hidden="true" />
                    Open KYC review queue
                  </button>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-[11px] text-ink-muted">
                  No KYC documents on file.
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
              <button
                type="button"
                onClick={() => handleCopy(detail)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                {copied === detail.id ? (
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

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => navigate(`/drivers/${detail.id}`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
                >
                  <Eye size={12} aria-hidden="true" />
                  Profile
                </button>
                {detail.status === 'pending' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setPending({ type: 'reject', driver: detail })
                        setDetailId(null)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 transition-colors"
                    >
                      <X size={12} aria-hidden="true" />
                      Reject
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPending({ type: 'approve', driver: detail })
                        setDetailId(null)
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
                    >
                      <Check size={12} aria-hidden="true" />
                      Approve
                    </button>
                  </>
                ) : null}
              </div>
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
  tone: 'emerald' | 'amber' | 'red' | 'sky'
  label: string
  value: string
  hint: string
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-emerald-light text-emerald-dark',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-danger',
    sky: 'bg-sky-50 text-sky-700',
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
          <div className="text-base font-bold text-ink tabular-nums truncate">{value}</div>
        </div>
      </div>
      <div className="mt-1.5 truncate text-[10px] text-ink-muted">{hint}</div>
    </div>
  )
}

function KycDocRow({ doc }: { doc: Document }) {
  const cfg = DOCUMENT_STATUS_META[doc.status]
  const expiring = isExpiringSoon(doc)
  return (
    <li className="flex items-center gap-2 rounded-md border border-border bg-surface px-2.5 py-1.5">
      <FileText size={11} className="shrink-0 text-ink-muted" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] font-medium text-ink">
          {DOCUMENT_TYPE_META[doc.type].label}
        </div>
        <div className="truncate text-[10px] text-ink-muted">
          {formatBytes(doc.sizeBytes)}
          {doc.expiresAt ? ` · exp ${formatDate(doc.expiresAt)}` : ''}
        </div>
      </div>
      {expiring ? (
        <span
          title="Expiring soon"
          className="inline-flex items-center rounded-full bg-amber-100 px-1 text-[9px] font-bold text-amber-700"
        >
          <Clock size={8} aria-hidden="true" />
        </span>
      ) : null}
      <span
        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
          doc.status === 'approved'
            ? 'bg-emerald-light text-emerald-dark'
            : doc.status === 'rejected' || doc.status === 'expired'
              ? 'bg-red-50 text-danger'
              : 'bg-amber-50 text-amber-700'
        }`}
      >
        {cfg.label.split(' ')[0]}
      </span>
    </li>
  )
}