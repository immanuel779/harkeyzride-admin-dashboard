import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileQuestion } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { getRideById, type RideStatus } from '../data/mockRides'

const STATUS_MAP: Record<RideStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  in_progress: { label: 'In Progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  sos: { label: 'SOS', tone: 'danger' },
}

export function RideDetailPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const ride = getRideById(id)

  if (!ride) {
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
                <ArrowLeft size={16} />
                Back to rides
              </button>
            }
          />
        </div>
      </AppShell>
    )
  }

  const cfg = STATUS_MAP[ride.status]

  return (
    <AppShell title="Ride Detail">
      <button
        type="button"
        onClick={() => navigate('/rides')}
        className="inline-flex items-center gap-2 text-sm text-ink-secondary hover:text-ink mb-4"
      >
        <ArrowLeft size={16} /> Back to rides
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl bg-surface border border-border p-6">
          <div className="font-mono text-sm text-ink-muted mb-1">#{ride.id.replace('rd_', '')}</div>
          <h2 className="text-xl font-bold text-ink mb-3">₦{ride.fare.toLocaleString()}</h2>
          <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>

          <dl className="space-y-3 text-sm mt-5">
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Rider</dt>
              <dd className="text-ink font-medium">{ride.rider}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Driver</dt>
              <dd className="text-ink font-medium">{ride.driver}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Payment</dt>
              <dd className="text-ink font-medium capitalize">{ride.paymentMethod}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Started</dt>
              <dd className="text-ink font-medium">{ride.startedAt}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted uppercase tracking-wide">Duration</dt>
              <dd className="text-ink font-medium">{ride.durationMin} min</dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-2 rounded-xl bg-surface border border-border p-6">
          <h3 className="text-sm font-semibold text-ink mb-4">Route</h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald mt-1.5" />
              <div>
                <div className="text-xs text-ink-muted uppercase tracking-wide">Pickup</div>
                <div className="text-ink font-medium">{ride.pickup}</div>
              </div>
            </div>
            <div className="ml-1.5 w-0.5 h-6 bg-border" />
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-full bg-navy mt-1.5" />
              <div>
                <div className="text-xs text-ink-muted uppercase tracking-wide">Destination</div>
                <div className="text-ink font-medium">{ride.destination}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}