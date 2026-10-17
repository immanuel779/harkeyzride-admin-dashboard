export type TxnType = 'ride_payment' | 'wallet_funding' | 'driver_payout' | 'commission' | 'refund' | 'cancellation_fee'
export type TxnStatus = 'successful' | 'pending' | 'failed'

export type Transaction = {
  id: string
  type: TxnType
  amount: number
  status: TxnStatus
  user: string
  reference: string
  createdAt: string
}
import { api } from '../../../lib/apiClient'
import {
  unwrapList,
  type BackendPayment,
} from '../../../services/adapters'

// 🟡 BACKEND REQUIRED — GET /admin/financials/ledger
export const MOCK_TRANSACTIONS: Transaction[] = [
  { id: 'tx_9001', type: 'ride_payment', amount: 1200, status: 'successful', user: 'Seyi Ariyo', reference: 'HR-RIDE-4821', createdAt: '2026-09-15 22:10' },
  { id: 'tx_9002', type: 'commission', amount: 240, status: 'successful', user: 'Platform', reference: 'HR-COM-4821', createdAt: '2026-09-15 22:10' },
  { id: 'tx_9003', type: 'wallet_funding', amount: 5000, status: 'successful', user: 'Seyi Ariyo', reference: 'HR-FUND-4821', createdAt: '2026-09-15 21:55' },
  { id: 'tx_9004', type: 'driver_payout', amount: 45200, status: 'successful', user: 'Fleet batch', reference: 'HR-PAY-2026-0915', createdAt: '2026-09-15 21:30' },
  { id: 'tx_9005', type: 'cancellation_fee', amount: 200, status: 'successful', user: 'Grace Nwosu', reference: 'HR-CNC-4816', createdAt: '2026-09-15 20:45' },
  { id: 'tx_9006', type: 'ride_payment', amount: 1500, status: 'successful', user: 'Tunde Bakare', reference: 'HR-RIDE-4820', createdAt: '2026-09-15 22:05' },
  { id: 'tx_9007', type: 'refund', amount: 1200, status: 'pending', user: 'Funke Adeyemi', reference: 'HR-RFD-4814', createdAt: '2026-09-15 20:10' },
  { id: 'tx_9008', type: 'ride_payment', amount: 3500, status: 'successful', user: 'Chidinma Okoye', reference: 'HR-RIDE-4818', createdAt: '2026-09-15 21:30' },
  { id: 'tx_9009', type: 'ride_payment', amount: 900, status: 'failed', user: 'Bola Ariyo', reference: 'HR-RIDE-4819', createdAt: '2026-09-15 21:55' },
  { id: 'tx_9010', type: 'wallet_funding', amount: 10000, status: 'successful', user: 'Grace Nwosu', reference: 'HR-FUND-4817', createdAt: '2026-09-15 19:40' },
]
export async function fetchTransactionsReal(): Promise<Transaction[]> {
  const res = await api.get<unknown>('/admin/payments')
  const rows = unwrapList<BackendPayment>(res, 'payments')

  return rows.map((p) => ({
    id: p.id,
    type: ((p.type ?? 'ride_payment') as TxnType),
    amount: Number(p.amount ?? 0),
    status: ((p.status === 'successful' || p.status === 'success')
      ? 'successful'
      : p.status === 'pending'
        ? 'pending'
        : 'failed') as TxnStatus,
    user: p.userName ?? p.user?.name ?? '—',
    reference: p.reference ?? `PAY-${p.id.slice(0, 8).toUpperCase()}`,
    createdAt: p.createdAt ?? new Date().toISOString(),
  }))
}