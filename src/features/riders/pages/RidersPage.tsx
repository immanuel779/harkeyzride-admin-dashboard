import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Ban, CheckCircle2 } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { ErrorState } from '../../../components/shared/ErrorState'
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { toast } from '../../../lib/toast'
import {
  useReinstateRider,
  useRiders,
  useSuspendRider,
} from '../../../hooks/queries/useRiders'
import type { Rider, RiderStatus } from '../data/mockRiders'

const STATUS_MAP: Record<RiderStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  active: { label: 'Active', tone: 'success' },
  suspended: { label: 'Suspended', tone: 'danger' },
  nin_pending: { label: 'NIN Pending', tone: 'warning' },
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

type PendingAction =
  | { type: 'suspend'; rider: Rider }
  | { type: 'reinstate'; rider: Rider }
  | null

export function RidersPage() {
  const navigate = useNavigate()
  const { data: riders = [], isLoading, isError, error, refetch } = useRiders()
  const suspend = useSuspendRider()
  const reinstate = useReinstateRider()

  const [pending, setPending] = useState<PendingAction>(null)
  const isWorking = suspend.isPending || reinstate.isPending

  const handleConfirm = async () => {
    if (!pending) return
    try {
      if (pending.type === 'suspend') {
        await suspend.mutateAsync(pending.rider.id)
        toast.error(
          `${pending.rider.name} suspended`,
          'Rider cannot book rides until reinstated.',
        )
      } else {
        await reinstate.mutateAsync(pending.rider.id)
        toast.success(`${pending.rider.name} reinstated`, 'Full access restored.')
      }
      setPending(null)
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const columns: DataTableColumn<Rider>[] = [
    {
      key: 'name',
      header: 'Rider',
      accessor: (r) => r.name,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-emerald text-white flex items-center justify-center text-xs font-semibold">
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
      key: 'walletBalance',
      header: 'Wallet',
      accessor: (r) => r.walletBalance,
      sortable: true,
      render: (r) => (
        <span className="font-medium text-ink">{formatNaira(r.walletBalance)}</span>
      ),
    },
    {
      key: 'totalRides',
      header: 'Rides',
      accessor: (r) => r.totalRides,
      sortable: true,
      render: (r) => <span className="text-ink-secondary">{r.totalRides}</span>,
    },
    {
      key: 'rating',
      header: 'Rating',
      accessor: (r) => r.rating,
      sortable: true,
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-ink">
          <span className="text-amber-500">★</span>
          {r.rating.toFixed(1)}
        </span>
      ),
    },
    {
      key: 'joinedAt',
      header: 'Joined',
      accessor: (r) => r.joinedAt,
      sortable: true,
      render: (r) => <span className="text-ink-secondary text-xs">{r.joinedAt}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      accessor: (r) => r.status,
      sortable: true,
      render: (r) => {
        const cfg = STATUS_MAP[r.status]
        return <StatusBadge status={cfg.tone}>{cfg.label}</StatusBadge>
      },
    },
  ]

  const filters: DataTableFilter<Rider>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'suspended', label: 'Suspended' },
        { value: 'nin_pending', label: 'NIN Pending' },
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
  ]

  if (isError) {
    return (
      <AppShell title="Riders">
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load riders"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Riders">
      <DataTable
        data={riders}
        columns={columns}
        rowKey={(r) => r.id}
        filters={filters}
        searchable
        searchPlaceholder="Search by name, phone, email…"
        searchFn={(r, q) =>
          r.name.toLowerCase().includes(q) ||
          r.phone.toLowerCase().includes(q) ||
          r.email.toLowerCase().includes(q)
        }
        pageSize={6}
        loading={isLoading}
        title="All Riders"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/riders/${r.id}`)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View rider"
              title="View rider"
            >
              <Eye size={15} />
            </button>
            {r.status === 'active' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPending({ type: 'suspend', rider: r })
                }}
                className="p-1.5 rounded-lg hover:bg-red-50 text-danger transition-colors"
                aria-label="Suspend rider"
                title="Suspend"
              >
                <Ban size={15} />
              </button>
            ) : r.status === 'suspended' ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setPending({ type: 'reinstate', rider: r })
                }}
                className="p-1.5 rounded-lg hover:bg-emerald-light text-emerald transition-colors"
                aria-label="Reinstate rider"
                title="Reinstate"
              >
                <CheckCircle2 size={15} />
              </button>
            ) : null}
          </div>
        )}
      />

      <ConfirmModal
        open={pending !== null}
        title={
          pending?.type === 'suspend'
            ? `Suspend ${pending.rider.name}?`
            : pending?.type === 'reinstate'
              ? `Reinstate ${pending.rider.name}?`
              : ''
        }
        description={
          pending?.type === 'suspend'
            ? 'This rider will not be able to book rides until reinstated.'
            : 'This rider will regain full access to book rides.'
        }
        confirmLabel={pending?.type === 'suspend' ? 'Suspend' : 'Reinstate'}
        variant={pending?.type === 'suspend' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />
    </AppShell>
  )
}