import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, Check, X } from 'lucide-react'

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
  useApproveDriver,
  useDrivers,
  useRejectDriver,
} from '../../../hooks/queries/useDrivers'
import type { Driver, DriverStatus } from '../data/mockDrivers'

const STATUS_MAP: Record<DriverStatus, 'success' | 'warning' | 'danger'> = {
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
}

type PendingAction =
  | { type: 'approve'; driver: Driver }
  | { type: 'reject'; driver: Driver }
  | null

export function DriversPage() {
  const navigate = useNavigate()
  const { data: drivers = [], isLoading, isError, error, refetch } = useDrivers()
  const approve = useApproveDriver()
  const reject = useRejectDriver()

  const [pending, setPending] = useState<PendingAction>(null)

  const isWorking = approve.isPending || reject.isPending

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
    } catch (e) {
      toast.error('Action failed', e instanceof Error ? e.message : 'Please try again.')
    }
  }

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
      key: 'submittedAt',
      header: 'Submitted',
      accessor: (r) => r.submittedAt,
      sortable: true,
      render: (r) => (
        <span className="text-ink-secondary text-xs">{r.submittedAt}</span>
      ),
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
  ]

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

  return (
    <AppShell title="Driver Clearance Queue">
      <DataTable
        data={drivers}
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
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/drivers/${r.id}`)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View driver"
              title="View driver"
            >
              <Eye size={15} />
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
                  <Check size={15} />
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
                  <X size={15} />
                </button>
              </>
            ) : null}
          </div>
        )}
      />

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
            ? 'This driver will be cleared to accept rides on SwitchRide.'
            : 'This driver will be blocked from accepting rides. They will be notified.'
        }
        confirmLabel={pending?.type === 'approve' ? 'Approve' : 'Reject'}
        variant={pending?.type === 'reject' ? 'danger' : 'primary'}
        loading={isWorking}
        onConfirm={handleConfirm}
        onClose={() => (isWorking ? null : setPending(null))}
      />
    </AppShell>
  )
}