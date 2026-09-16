import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Wallet, Star, Car, UserX } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { getRiderById, type RiderStatus } from '../data/mockRiders'

const STATUS_MAP: Record<RiderStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  nin_pending: { label: 'NIN Pending', tone: 'warning' },
}

export function RiderDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const rider = getRiderById(id)

  if (!rider) {
    return (
      <AppShell title="Rider Detail">
        <div className="rounded-xl bg-surface border border-border">
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
                <ArrowLeft size={16} />
                Back to riders
              </button>
            }
          />
        </div>
      </AppShell>
    )
  }

  const cfg = STATUS_MAP[rider.status]

  return (
    <AppShell title="Rider Detail">
      <button
        type="button"
        onClick={() => navigate('/riders')}
        className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink mb-4"
      >
        <ArrowLeft size={16} /> Back to riders
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl bg-surface border border-border p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-14 h-14 rounded-full bg-emerald text-white flex items-center justify-center text-lg font-bold">
              {rider.name.split(' ').map((n) => n[0]).join('')}
            </div>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-ink truncate">{rider.name}</h2>
              <div className="mt-1">
                <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
              </div>
            </div>
          </div>

          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Phone</dt>
              <dd className="text-ink font-medium">{rider.phone}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Email</dt>
              <dd className="text-ink font-medium truncate">{rider.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">City</dt>
              <dd className="text-ink font-medium">{rider.city}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">NIN</dt>
              <dd className="text-ink font-mono">{rider.nin ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Joined</dt>
              <dd className="text-ink font-medium">{rider.joinedAt}</dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl bg-surface border border-border p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-2">
                <Wallet size={14} /> Wallet
              </div>
              <div className="text-2xl font-bold text-ink">
                ₦{rider.walletBalance.toLocaleString()}
              </div>
            </div>
            <div className="rounded-xl bg-surface border border-border p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-2">
                <Car size={14} /> Total rides
              </div>
              <div className="text-2xl font-bold text-ink">{rider.totalRides}</div>
            </div>
            <div className="rounded-xl bg-surface border border-border p-5">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-2">
                <Star size={14} /> Rating
              </div>
              <div className="text-2xl font-bold text-ink">{rider.rating.toFixed(1)}</div>
            </div>
          </div>

          <div className="rounded-xl bg-surface border border-border p-6">
            <h3 className="text-sm font-semibold text-ink mb-3">Recent rides</h3>
            <p className="text-sm text-ink-secondary">
              Ride history for this rider coming in Phase 3B.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  )
}