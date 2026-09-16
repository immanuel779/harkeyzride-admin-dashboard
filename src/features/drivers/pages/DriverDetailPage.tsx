import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Check, X, FileText, User, UserX } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import {
  useApproveDriver,
  useDriver,
  useRejectDriver,
} from '../../../hooks/queries/useDrivers'
import type { DriverStatus } from '../data/mockDrivers'

const STATUS_MAP: Record<DriverStatus, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

export function DriverDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()

  const { data: driver, isLoading, isError, error, refetch } = useDriver(id)
  const approve = useApproveDriver()
  const reject = useRejectDriver()

  const [pending, setPending] = useState<'approve' | 'reject' | null>(null)
  const isWorking = approve.isPending || reject.isPending

  const handleConfirm = async () => {
    if (!driver || !pending) return
    try {
      if (pending === 'approve') {
        await approve.mutateAsync(driver.id)
        toast.success(`${driver.name} approved`, 'Driver can now accept rides.')
      } else {
        await reject.mutateAsync(driver.id)
        toast.warning(`${driver.name} rejected`, 'Driver has been notified.')
      }
      setPending(null)
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

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
                  <ArrowLeft size={16} />
                  Back to drivers
                </button>
              }
            />
          )}
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Driver Detail">
      <button
        type="button"
        onClick={() => navigate('/drivers')}
        className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink mb-4 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to drivers
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl bg-surface border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-navy text-white flex items-center justify-center text-lg font-bold">
              {driver.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink truncate">
                {driver.name}
              </h2>
              <div className="mt-1">
                <StatusBadge status={STATUS_MAP[driver.status]}>
                  {driver.status.charAt(0).toUpperCase() + driver.status.slice(1)}
                </StatusBadge>
              </div>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Phone</dt>
              <dd className="text-ink font-medium">{driver.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Email</dt>
              <dd className="text-ink font-medium truncate">{driver.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">NIN</dt>
              <dd className="text-ink font-mono">{driver.nin}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">City</dt>
              <dd className="text-ink font-medium">{driver.city}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Submitted</dt>
              <dd className="text-ink font-medium">{driver.submittedAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Vehicle</dt>
              <dd className="text-ink font-medium">
                {driver.vehicle} · {driver.vehicleColor}
              </dd>
              <dd className="text-ink-secondary font-mono text-xs mt-1">
                {driver.plate}
              </dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-xl bg-surface border border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  Selfie vs NIN Document
                </h3>
                <p className="text-xs text-ink-secondary mt-0.5">
                  Side-by-side manual validation
                </p>
              </div>
              <StatusBadge status={STATUS_MAP[driver.status]}>
                {driver.status === 'pending'
                  ? 'Awaiting Review'
                  : driver.status === 'approved'
                    ? 'Approved'
                    : 'Rejected'}
              </StatusBadge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">
                  <User size={14} /> Selfie
                </div>
                <div className="aspect-[3/4] rounded-lg bg-surface-alt border border-dashed border-border-strong flex items-center justify-center text-sm text-ink-muted">
                  No selfie uploaded
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">
                  <FileText size={14} /> NIN Document
                </div>
                <div className="aspect-[3/4] rounded-lg bg-surface-alt border border-dashed border-border-strong flex items-center justify-center text-sm text-ink-muted">
                  No document uploaded
                </div>
              </div>
            </div>
          </div>

          {driver.status === 'pending' ? (
            <div className="rounded-xl bg-surface border border-border p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-ink">Decision</div>
                <div className="text-xs text-ink-secondary">
                  Approve or reject this driver
                </div>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setPending('reject')}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-danger hover:bg-red-100 transition-colors"
                >
                  <X size={16} />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => setPending('approve')}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald text-sm font-semibold text-white hover:bg-emerald-dark transition-colors"
                >
                  <Check size={16} />
                  Approve
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-surface border border-border p-6">
              <div className="text-sm font-medium text-ink mb-1">
                Decision recorded
              </div>
              <div className="text-xs text-ink-secondary">
                This driver was already {driver.status}.
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={pending !== null}
        title={
          pending === 'approve'
            ? `Approve ${driver.name}?`
            : pending === 'reject'
              ? `Reject ${driver.name}?`
              : ''
        }
        description={
          pending === 'approve'
            ? 'This driver will be cleared to accept rides on SwitchRide.'
            : 'This driver will be blocked from accepting rides. They will be notified.'
        }
        confirmLabel={pending === 'approve' ? 'Approve' : 'Reject'}
        variant={pending === 'reject' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />
    </AppShell>
  )
}