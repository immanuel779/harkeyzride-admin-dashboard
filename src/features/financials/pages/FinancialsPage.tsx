import { AppShell } from '../../../components/layout/AppShell'
import {
  DataTable,
  type DataTableColumn,
  type DataTableFilter,
} from '../../../components/shared/DataTable'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { MOCK_TRANSACTIONS, type Transaction, type TxnStatus, type TxnType } from '../data/mockTransactions'

const TYPE_LABEL: Record<TxnType, string> = {
  ride_payment: 'Ride Payment',
  wallet_funding: 'Wallet Funding',
  driver_payout: 'Driver Payout',
  commission: 'Commission',
  refund: 'Refund',
  cancellation_fee: 'Cancellation Fee',
}

const STATUS_MAP: Record<TxnStatus, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  successful: { label: 'Successful', tone: 'success' },
  pending: { label: 'Pending', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
}

export function FinancialsPage() {
  const columns: DataTableColumn<Transaction>[] = [
    {
      key: 'reference',
      header: 'Reference',
      accessor: (r) => r.reference,
      sortable: true,
      render: (r) => <span className="font-mono text-xs text-ink font-medium">{r.reference}</span>,
    },
    {
      key: 'type',
      header: 'Type',
      accessor: (r) => r.type,
      sortable: true,
      render: (r) => <span className="text-ink">{TYPE_LABEL[r.type]}</span>,
    },
    {
      key: 'user',
      header: 'User',
      accessor: (r) => r.user,
      sortable: true,
      render: (r) => <span className="text-ink-secondary">{r.user}</span>,
    },
    {
      key: 'amount',
      header: 'Amount',
      accessor: (r) => r.amount,
      sortable: true,
      render: (r) => (
        <span className="font-medium text-ink">₦{r.amount.toLocaleString()}</span>
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
      header: 'Date',
      accessor: (r) => r.createdAt,
      sortable: true,
      render: (r) => <span className="text-ink-secondary text-xs">{r.createdAt}</span>,
    },
  ]

  const filters: DataTableFilter<Transaction>[] = [
    {
      key: 'type',
      label: 'Type',
      options: Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label })),
      apply: (row, value) => row.type === value,
    },
    {
      key: 'status',
      label: 'Status',
      options: [
        { value: 'successful', label: 'Successful' },
        { value: 'pending', label: 'Pending' },
        { value: 'failed', label: 'Failed' },
      ],
      apply: (row, value) => row.status === value,
    },
  ]

  return (
    <AppShell title="Financials">
      <DataTable
        data={MOCK_TRANSACTIONS}
        columns={columns}
        rowKey={(r) => r.id}
        filters={filters}
        searchable
        searchPlaceholder="Search by reference, user…"
        searchFn={(r, q) =>
          r.reference.toLowerCase().includes(q) ||
          r.user.toLowerCase().includes(q)
        }
        pageSize={10}
        title="Transaction Ledger"
      />
    </AppShell>
  )
}