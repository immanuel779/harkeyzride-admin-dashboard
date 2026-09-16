import { useNavigate } from 'react-router-dom'
import { Eye, AlertTriangle } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { MOCK_RIDES, type Ride, type RideStatus } from '../data/mockRides'

const STATUS_MAP: Record<RideStatus, { label: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }> = {
  in_progress: { label: 'In Progress', tone: 'info' },
  completed: { label: 'Completed', tone: 'success' },
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  sos: { label: 'SOS', tone: 'danger' },
}

export function RidesPage() {
  const navigate = useNavigate()

  const columns: DataTableColumn<Ride>[] = [
    {
      key: 'id',
      header: 'Ride',
      accessor: (r) => r.id,
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs text-ink font-medium">#{r.id.replace('rd_', '')}</span>
      ),
    },
    {
      key: 'rider',
      header: 'Rider',
      accessor: (r) => r.rider,
      sortable: true,
      render: (r) => <span className="text-ink font-medium">{r.rider}</span>,
    },
    {
      key: 'driver',
      header: 'Driver',
      accessor: (r) => r.driver,
      sortable: true,
      render: (r) => <span className="text-ink-secondary">{r.driver}</span>,
    },
    {
      key: 'route',
      header: 'Route',
      render: (r) => (
        <div className="text-xs">
          <div className="text-ink truncate max-w-[220px]">{r.pickup}</div>
          <div className="text-ink-secondary truncate max-w-[220px]">→ {r.destination}</div>
        </div>
      ),
    },
    {
      key: 'fare',
      header: 'Fare',
      accessor: (r) => r.fare,
      sortable: true,
      render: (r) => <span className="font-medium text-ink">₦{r.fare.toLocaleString()}</span>,
    },
    {
      key: 'paymentMethod',
      header: 'Payment',
      accessor: (r) => r.paymentMethod,
      render: (r) => (
        <span className="text-xs text-ink-secondary capitalize">{r.paymentMethod}</span>
      ),
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

  const filters: DataTableFilter<Ride>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'in_progress', label: 'In Progress' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'sos', label: 'SOS' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'paymentMethod',
      label: 'Payment',
      options: [
        { value: 'wallet', label: 'Wallet' },
        { value: 'cash', label: 'Cash' },
      ],
      apply: (row, value) => row.paymentMethod === value,
    },
  ]

  return (
    <AppShell title="Rides">
      <DataTable
        data={MOCK_RIDES}
        columns={columns}
        rowKey={(r) => r.id}
        filters={filters}
        searchable
        searchPlaceholder="Search by ride ID, rider, driver…"
        searchFn={(r, q) =>
          r.id.toLowerCase().includes(q) ||
          r.rider.toLowerCase().includes(q) ||
          r.driver.toLowerCase().includes(q)
        }
        pageSize={8}
        title="Live & Recent Rides"
        actions={(r) => (
          <div className="flex items-center justify-end gap-1">
            {r.status === 'sos' ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-danger text-[10px] font-bold uppercase animate-pulse">
                <AlertTriangle size={12} /> SOS
              </span>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/rides/${r.id}`)
              }}
              className="p-1.5 rounded-lg hover:bg-surface-alt text-ink-secondary hover:text-ink transition-colors"
              aria-label="View ride"
              title="View ride"
            >
              <Eye size={15} />
            </button>
          </div>
        )}
      />
    </AppShell>
  )
}