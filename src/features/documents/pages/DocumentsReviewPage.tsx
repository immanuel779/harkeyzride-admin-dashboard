import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpDown,
  Ban,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  XCircle,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import { useAuth } from '../../../store/AuthContext'

import {
  DOCUMENT_STATUS_META,
  DOCUMENT_TYPE_META,
  REJECTION_REASONS,
  type Document,
  type EntityType,
  computeDocumentStats,
  fetchDocuments,
  filterDocuments,
  formatBytes,
  formatDate,
  formatRelativeTime,
  daysUntil,
  isExpiringSoon,
  groupByEntity,
  approveDocument,
  rejectDocument,
  bulkApprove,
  bulkReject,
} from '../data/mockDocuments'

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

const ANIMATIONS = `
  @keyframes dr-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dr-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes dr-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes dr-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  .dr-fade-up { animation: dr-fade-up .3s cubic-bezier(.22,1,.36,1) both; }
  .dr-fade-in { animation: dr-fade-in .2s ease both; }
  .dr-slide-in { animation: dr-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .dr-pop { animation: dr-pop .3s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .dr-fade-up, .dr-fade-in, .dr-slide-in, .dr-pop { animation: none !important; }
  }
`

/* ==========================================================================
   TYPES
   ========================================================================== */

type TabKey = 'pending' | 'approved' | 'rejected' | 'expiring' | 'all'
type SortKey = 'newest' | 'oldest' | 'entity'

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'pending', label: 'Pending review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'expiring', label: 'Expiring soon' },
  { key: 'all', label: 'All documents' },
]

/* ==========================================================================
   PAGE
   ========================================================================== */

export function DocumentsReviewPage() {
  const { user } = useAuth()
  const adminName = user ? `${user.firstName} ${user.lastName}` : 'Admin'

  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const [tab, setTab] = useState<TabKey>('pending')
  const [entityFilter, setEntityFilter] = useState<EntityType | 'all'>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('newest')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null)
  const [rejectTarget, setRejectTarget] = useState<Document | string[] | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [rejectNote, setRejectNote] = useState('')
  const [bulkWorking, setBulkWorking] = useState(false)

  const previewRef = useRef<HTMLDivElement | null>(null)

  /* ------------------------- data loading ------------------------- */

  const load = useCallback(async (force = false) => {
    setLoading(!docs.length)
    setError(null)
    try {
      const data = await fetchDocuments({ force, ttlMs: force ? 0 : 30_000 })
      setDocs(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [docs.length])

  useEffect(() => {
    load(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await load(true)
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [load])

  /* ------------------------- derived ------------------------- */

  const stats = useMemo(() => computeDocumentStats(docs), [docs])

  const tabFiltered = useMemo(() => {
    switch (tab) {
      case 'pending':
        return docs.filter((d) => d.status === 'pending')
      case 'approved':
        return docs.filter((d) => d.status === 'approved')
      case 'rejected':
        return docs.filter((d) => d.status === 'rejected')
      case 'expiring':
        return docs.filter((d) => isExpiringSoon(d) || d.status === 'expired')
      default:
        return docs
    }
  }, [docs, tab])

  const filtered = useMemo(() => {
    const list = filterDocuments(tabFiltered, {
      entityType: entityFilter,
      search,
    })
    switch (sort) {
      case 'oldest':
        return [...list].sort((a, b) => a.submittedAt.localeCompare(b.submittedAt))
      case 'entity':
        return [...list].sort((a, b) => a.entityName.localeCompare(b.entityName))
      case 'newest':
      default:
        return [...list].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    }
  }, [tabFiltered, entityFilter, search, sort])

  const grouped = useMemo(() => groupByEntity(filtered), [filtered])

  const selectedList = useMemo(
    () => filtered.filter((d) => selectedIds.has(d.id)),
    [filtered, selectedIds],
  )

  const allVisibleSelected =
    filtered.length > 0 && filtered.every((d) => selectedIds.has(d.id))

  /* ------------------------- selection ------------------------- */

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) {
        for (const d of filtered) next.delete(d.id)
      } else {
        for (const d of filtered) next.add(d.id)
      }
      return next
    })
  }, [allVisibleSelected, filtered])

  const clearSelection = useCallback(() => setSelectedIds(new Set()), [])

  /* ------------------------- actions ------------------------- */

  const handleApprove = useCallback(
    async (doc: Document) => {
      try {
        await approveDocument(doc.id, adminName)
        toast.success(
          `${DOCUMENT_TYPE_META[doc.type].shortLabel} approved`,
          `${doc.entityName}'s document is now verified.`,
        )
        await load(true)
        setPreviewDoc(null)
      } catch (e) {
        toast.error('Approve failed', e instanceof Error ? e.message : 'Try again.')
      }
    },
    [adminName, load],
  )

  const handleReject = useCallback(async () => {
    if (!rejectTarget) return
    if (!rejectReason.trim()) {
      toast.error('Reason required', 'Select or type a rejection reason.')
      return
    }

    setBulkWorking(true)
    try {
      if (Array.isArray(rejectTarget)) {
        const result = await bulkReject(rejectTarget, adminName, rejectReason)
        toast.success(
          `${result.succeeded.length} rejected`,
          result.failed.length > 0
            ? `${result.failed.length} failed — retry manually.`
            : 'Riders and drivers have been notified.',
        )
      } else {
        await rejectDocument(rejectTarget.id, adminName, rejectReason, rejectNote || undefined)
        toast.success(
          `${DOCUMENT_TYPE_META[rejectTarget.type].shortLabel} rejected`,
          `${rejectTarget.entityName} will be notified to re-upload.`,
        )
      }
      setRejectTarget(null)
      setRejectReason('')
      setRejectNote('')
      setPreviewDoc(null)
      clearSelection()
      await load(true)
    } catch (e) {
      toast.error('Reject failed', e instanceof Error ? e.message : 'Try again.')
    } finally {
      setBulkWorking(false)
    }
  }, [rejectTarget, rejectReason, rejectNote, adminName, clearSelection, load])

  const handleBulkApprove = useCallback(async () => {
    const ids = selectedList.filter((d) => d.status === 'pending').map((d) => d.id)
    if (ids.length === 0) {
      toast.error('Nothing to approve', 'No pending documents in the selection.')
      return
    }
    setBulkWorking(true)
    try {
      const result = await bulkApprove(ids, adminName)
      toast.success(
        `${result.succeeded.length} approved`,
        result.failed.length > 0
          ? `${result.failed.length} failed — retry manually.`
          : 'All documents verified.',
      )
      clearSelection()
      await load(true)
    } finally {
      setBulkWorking(false)
    }
  }, [selectedList, adminName, clearSelection, load])

  const handleBulkReject = useCallback(() => {
    const ids = selectedList.filter((d) => d.status === 'pending').map((d) => d.id)
    if (ids.length === 0) {
      toast.error('Nothing to reject', 'No pending documents in the selection.')
      return
    }
    setRejectTarget(ids)
  }, [selectedList])

  /* ------------------------- keyboard ------------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
        if (e.key === 'Escape') {
          setRejectTarget(null)
          setPreviewDoc(null)
        }
        return
      }
      if (e.key === 'Escape') {
        if (rejectTarget) {
          setRejectTarget(null)
        } else if (previewDoc) {
          setPreviewDoc(null)
        } else if (selectedIds.size > 0) {
          clearSelection()
        }
        return
      }
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() === 'a') {
        e.preventDefault()
        toggleAll()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewDoc, rejectTarget, selectedIds.size, clearSelection, toggleAll])

  /* ------------------------- render ------------------------- */

  return (
    <AppShell title="Document Review">
      <style>{ANIMATIONS}</style>

      {/* KPI row */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi
          icon={<Clock size={14} />}
          tone="amber"
          label="Pending review"
          value={String(stats.pending)}
          hint={`${stats.pendingRiders} riders · ${stats.pendingDrivers} drivers`}
        />
        <Kpi
          icon={<CheckCircle2 size={14} />}
          tone="emerald"
          label="Approved"
          value={String(stats.approved)}
          hint={`${stats.fullyVerified} fully verified`}
        />
        <Kpi
          icon={<XCircle size={14} />}
          tone="red"
          label="Rejected"
          value={String(stats.rejected)}
          hint="Awaiting re-upload"
        />
        <Kpi
          icon={<AlertTriangle size={14} />}
          tone="amber"
          label="Expiring soon"
          value={String(stats.expiringSoon)}
          hint="Within 30 days"
        />
        <Kpi
          icon={<ShieldCheck size={14} />}
          tone="sky"
          label="Avg review time"
          value={`${stats.avgReviewHours}h`}
          hint={`Across ${stats.total} documents`}
        />
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {TABS.map(({ key, label }) => {
            const active = tab === key
            const count =
              key === 'pending' ? stats.pending
              : key === 'approved' ? stats.approved
              : key === 'rejected' ? stats.rejected
              : key === 'expiring' ? stats.expiringSoon
              : stats.total
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={active}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                    : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald'
                }`}
              >
                {label}
                {count > 0 ? (
                  <span
                    className={`inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px] ${
                      active ? 'bg-white/25 text-white' : 'bg-surface-alt text-ink-muted'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value as EntityType | 'all')}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none"
          >
            <option value="all">All entities</option>
            <option value="rider">Riders only</option>
            <option value="driver">Drivers only</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink focus:border-emerald focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="entity">By name</option>
          </select>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : undefined} />
            Refresh
          </button>
        </div>
      </div>

      {/* Search + bulk bar */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, ID, document number…"
            className="w-full rounded-lg border border-border bg-surface py-2 pl-8 pr-3 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
          />
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <div className="dr-fade-up mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald/30 bg-emerald-light px-4 py-2.5">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1 font-semibold text-emerald-dark hover:text-emerald"
            >
              <Check size={12} />
              {selectedIds.size} selected
              <X size={10} className="opacity-60" />
            </button>
            <button
              type="button"
              onClick={toggleAll}
              className="inline-flex items-center gap-1 font-medium text-emerald-dark/80 hover:text-emerald-dark"
            >
              {allVisibleSelected ? 'Deselect all' : `Select all ${filtered.length}`}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleBulkApprove}
              disabled={bulkWorking}
              className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={11} />
              Approve {selectedList.filter((d) => d.status === 'pending').length}
            </button>
            <button
              type="button"
              onClick={handleBulkReject}
              disabled={bulkWorking}
              className="inline-flex items-center gap-1 rounded-md bg-red-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              <Ban size={11} />
              Reject {selectedList.filter((d) => d.status === 'pending').length}
            </button>
          </div>
        </div>
      ) : null}

      {/* Table */}
      {error ? (
        <div className="rounded-xl border border-border bg-surface">
          <ErrorState title="Could not load documents" description={error} onRetry={() => load(true)} />
        </div>
      ) : loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface p-4">
              <Skeleton className="h-3 w-32 mb-2" />
              <Skeleton className="h-3 w-48" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface">
          <EmptyState
            icon={FileText}
            title="No documents in this view"
            description="Try a different tab or clear filters."
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-alt/60">
              <tr className="text-left text-[10px] uppercase tracking-wide text-ink-muted">
                <th className="w-10 py-2.5 px-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAll}
                    className="h-3.5 w-3.5 rounded border-border accent-emerald"
                    aria-label="Select all"
                  />
                </th>
                <th className="py-2.5 px-3">Entity</th>
                <th className="py-2.5 px-3">Document</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Submitted</th>
                <th className="py-2.5 px-3">Expires</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((entity) =>
                entity.documents.map((d, i) => (
                  <tr
                    key={d.id}
                    className="border-b border-border/60 last:border-b-0 hover:bg-surface-alt/40 transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggle(d.id)}
                        className="h-3.5 w-3.5 rounded border-border accent-emerald"
                        aria-label={`Select ${d.entityName} ${d.type}`}
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      {i === 0 ? (
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold ${
                              d.entityType === 'driver'
                                ? 'bg-navy text-white'
                                : 'bg-emerald text-white'
                            }`}
                          >
                            {d.entityName.split(' ').map((n) => n[0]).join('')}
                          </div>
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium text-ink">
                              {d.entityName}
                            </div>
                            <div className="text-[10px] text-ink-muted capitalize">
                              {d.entityType} · {d.entityId}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-ink-muted pl-9">↳</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5 text-xs text-ink">
                        {d.mimeType === 'application/pdf' ? (
                          <FileText size={12} className="text-danger" />
                        ) : (
                          <ImageIcon size={12} className="text-sky-500" />
                        )}
                        {DOCUMENT_TYPE_META[d.type].label}
                      </div>
                      <div className="text-[10px] text-ink-muted">
                        {formatBytes(d.sizeBytes)}
                        {d.documentNumber ? ` · ${d.documentNumber}` : ''}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <StatusBadge status={DOCUMENT_STATUS_META[d.status].tone}>
                        {DOCUMENT_STATUS_META[d.status].label}
                      </StatusBadge>
                      {d.status === 'rejected' && d.rejectionReason ? (
                        <div className="mt-0.5 text-[10px] text-danger truncate max-w-[160px]">
                          {d.rejectionReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-3 text-xs text-ink-secondary">
                      {formatRelativeTime(d.submittedAt)}
                    </td>
                    <td className="py-2.5 px-3 text-xs">
                      {d.expiresAt ? (
                        <span
                          className={
                            daysUntil(d.expiresAt) != null && daysUntil(d.expiresAt)! < 0
                              ? 'text-danger'
                              : isExpiringSoon(d)
                                ? 'text-amber-600'
                                : 'text-ink-secondary'
                          }
                        >
                          {formatDate(d.expiresAt)}
                        </span>
                      ) : (
                        <span className="text-ink-muted/60">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(d)}
                          className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                          aria-label="Preview"
                          title="Preview"
                        >
                          <Eye size={13} />
                        </button>
                        {d.status === 'pending' ? (
                          <>
                            <button
                              type="button"
                              onClick={() => handleApprove(d)}
                              className="rounded p-1 text-emerald hover:bg-emerald-light transition-colors"
                              aria-label="Approve"
                              title="Approve"
                            >
                              <Check size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRejectTarget(d)}
                              className="rounded p-1 text-danger hover:bg-red-50 transition-colors"
                              aria-label="Reject"
                              title="Reject"
                            >
                              <X size={13} />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Preview modal */}
      {previewDoc ? (
        <div
          className="dr-fade-in fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewDoc(null)}
        >
          <div
            ref={previewRef}
            className="dr-pop flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
              <div>
                <h3 className="text-sm font-bold text-ink">
                  {DOCUMENT_TYPE_META[previewDoc.type].label} — {previewDoc.entityName}
                </h3>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Submitted {formatRelativeTime(previewDoc.submittedAt)} ·{' '}
                  {formatBytes(previewDoc.sizeBytes)}
                  {previewDoc.documentNumber ? ` · #${previewDoc.documentNumber}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="rounded p-1 text-ink-muted hover:bg-surface-alt hover:text-ink"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-surface-alt/40 p-4">
              <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-surface">
                <div className="text-center">
                  {previewDoc.mimeType === 'application/pdf' ? (
                    <FileText size={48} className="mx-auto mb-2 text-ink-muted" />
                  ) : (
                    <ImageIcon size={48} className="mx-auto mb-2 text-ink-muted" />
                  )}
                  <p className="text-xs text-ink-muted">
                    Document preview
                  </p>
                  <p className="mt-1 text-[10px] text-ink-muted/70">
                    {previewDoc.fileUrl}
                  </p>
                  <a
                    href={previewDoc.fileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald hover:text-emerald-dark"
                  >
                    <ExternalLink size={11} />
                    Open original in new tab
                  </a>
                </div>
              </div>

              {previewDoc.notes ? (
                <div className="mt-3 rounded-lg border border-border bg-surface p-3 text-[11px] text-ink-secondary">
                  <span className="font-semibold text-ink">Notes: </span>
                  {previewDoc.notes}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
              <span className="text-[10px] text-ink-muted">
                {previewDoc.status === 'approved' && previewDoc.reviewedBy
                  ? `Approved by ${previewDoc.reviewedBy}`
                  : previewDoc.status === 'rejected' && previewDoc.reviewedBy
                    ? `Rejected by ${previewDoc.reviewedBy} — ${previewDoc.rejectionReason}`
                    : 'Awaiting review'}
              </span>
              {previewDoc.status === 'pending' ? (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setRejectTarget(previewDoc)}
                    className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-danger hover:bg-red-50"
                  >
                    <Ban size={11} />
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(previewDoc)}
                    className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-dark"
                  >
                    <CheckCircle2 size={11} />
                    Approve
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* Reject modal */}
      {rejectTarget ? (
        <div
          className="dr-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => !bulkWorking && setRejectTarget(null)}
        >
          <div
            className="dr-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-bold text-ink">
              {Array.isArray(rejectTarget)
                ? `Reject ${rejectTarget.length} document${rejectTarget.length === 1 ? '' : 's'}?`
                : `Reject ${DOCUMENT_TYPE_META[rejectTarget.type].label}?`}
            </h3>
            <p className="mt-1 text-[11px] text-ink-muted">
              {Array.isArray(rejectTarget)
                ? 'Each rider/driver will be notified to re-upload.'
                : `${rejectTarget.entityName} will be notified to re-upload.`}
            </p>

            <div className="mt-3">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-ink-secondary">
                Rejection reason (required)
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {REJECTION_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectReason(r)}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      rejectReason === r
                        ? 'border-danger bg-red-50 text-danger'
                        : 'border-border bg-surface text-ink-secondary hover:border-danger/40 hover:text-danger'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                rows={2}
                placeholder="Optional admin note (visible only to admins)…"
                className="w-full rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 resize-none"
              />
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                disabled={bulkWorking}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReject}
                disabled={bulkWorking || !rejectReason.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
              >
                {bulkWorking ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Ban size={12} />
                )}
                Confirm reject
              </button>
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

function Kpi({
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
  const toneClass = {
    emerald: 'bg-emerald-light text-emerald-dark',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-danger',
    sky: 'bg-sky-50 text-sky-700',
  }[tone]

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </div>
          <div className="text-base font-bold text-ink tabular-nums truncate">{value}</div>
        </div>
      </div>
      <div className="mt-1.5 text-[10px] text-ink-muted truncate">{hint}</div>
    </div>
  )
}