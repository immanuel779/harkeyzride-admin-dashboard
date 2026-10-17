import { Users, Wallet, AlertCircle, Lock } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import {
  useSubscriptionLedger,
  useSubscriptionSnapshot,
} from '../../../hooks/queries/useSubscriptions'
import type {
  SubscriptionEntry,
  SubscriptionStatus,
} from '../data/mockSubscriptions'
import { SnapshotCard } from '../components/SnapshotCard'

const STATUS_MAP: Record<
  SubscriptionStatus,
  { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }
> = {
  success: { label: 'Success', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
  insufficient_balance: { label: 'Low Balance', tone: 'danger' },
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export function SubscriptionPage() {
    const {
    data: snapshot,
    isLoading: snapshotLoading,
  } = useSubscriptionSnapshot()

  const {
    data: ledger = [],
    isLoading: ledgerLoading,
    isError: ledgerError,
    error: ledgerErr,
    refetch: refetchLedger,
  } = useSubscriptionLedger()

  const columns: DataTableColumn<SubscriptionEntry>[] = [
    {
      key: 'reference',
      header: 'Reference',
      accessor: (r) => r.reference,
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs text-ink font-medium">
          {r.reference.split('-').slice(-1)[0]}
        </span>
      ),
    },
    {
      key: 'driverName',
      header: 'Driver',
      accessor: (r) => r.driverName,
      sortable: true,
      render: (r) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-navy text-white flex items-center justify-center text-xs font-semibold">
            {r.driverName.split(' ').map((n) => n[0]).join('')}
          </div>
          <div className="min-w-0">
            <div className="font-medium text-ink truncate">{r.driverName}</div>
            <div className="text-xs text-ink-secondary">
              Balance: {formatNaira(r.balanceAfter)}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (r) => r.amount,
      sortable: true,
      render: (r) => (
        <span className="font-medium text-ink">{formatNaira(r.amount)}</span>
      ),
    },
    {
      key: 'method',
      header: 'Method',
      accessor: (r) => r.method,
      render: (r) => (
        <span className="text-xs text-ink-secondary capitalize">
          {r.method === 'wallet' ? 'Wallet' : 'Bank Transfer'}
        </span>
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
    {
      key: 'createdAt',
      header: 'When',
      accessor: (r) => r.createdAt,
      sortable: true,
      render: (r) => (
        <span className="text-ink-secondary text-xs">{timeAgo(r.createdAt)}</span>
      ),
    },
  ]

  const filters: DataTableFilter<SubscriptionEntry>[] = [
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'success', label: 'Success' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' },
        { value: 'insufficient_balance', label: 'Low Balance' },
      ],
      apply: (row, value) => row.status === value,
    },
    {
      key: 'method',
      label: 'Method',
      options: [
        { value: 'wallet', label: 'Wallet' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
      ],
      apply: (row, value) => row.method === value,
    },
  ]

  return (
    <AppShell title="Subscription Tracker">
      {/* Snapshot cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {snapshotLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="w-9 h-9" />
              </div>
              <Skeleton className="h-7 w-24 mb-2" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))
        ) : snapshot ? (
          <>
            <SnapshotCard
              icon={Users}
              label="Active Subscriptions"
              value={snapshot.activeSubscriptions.toString()}
              hint="Drivers on flat daily plan"
            />
            <SnapshotCard
              icon={Wallet}
              label="Today's Collections"
              value={`${snapshot.currency}${snapshot.todayCollections.toLocaleString()}`}
              hint="₦2,000 × active drivers"
              tone="success"
            />
            <SnapshotCard
              icon={AlertCircle}
              label="Failed Deductions"
              value={snapshot.failedDeductions.toString()}
              hint="Requires admin review"
              tone="warning"
            />
            <SnapshotCard
              icon={Lock}
              label="Balance-Locked Drivers"
              value={snapshot.lockedDrivers.toString()}
              hint="Cannot accept rides"
              tone="danger"
            />
          </>
        ) : null}
      </div>

      {/* Ledger table */}
      {ledgerError ? (
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load subscription ledger"
            description={ledgerErr instanceof Error ? ledgerErr.message : 'Please try again.'}
            onRetry={() => refetchLedger()}
          />
        </div>
      ) : (
        <DataTable
          data={ledger}
          columns={columns}
          rowKey={(r) => r.id}
          filters={filters}
          searchable
          searchPlaceholder="Search by driver, reference…"
          searchFn={(r, q) =>
            r.driverName.toLowerCase().includes(q) ||
            r.reference.toLowerCase().includes(q)
          }
          pageSize={8}
          loading={ledgerLoading}
          title="Subscription Ledger"
        />
      )}
    </AppShell>
  )
}