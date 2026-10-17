import { api } from '../../../lib/apiClient'

export type WithdrawalStatus = 'pending' | 'approved' | 'paid' | 'rejected'

export type Withdrawal = {
  id: string
  driverId: string
  driverName: string
  driverPhone: string
  amount: number
  status: WithdrawalStatus
  bankAccount: string
  bank: string
  reference: string
  requestedAt: string
  reviewedAt: string | null
  adminNote: string | null
}

type BackendWithdrawal = {
  id: string
  driverId: string
  amount: number
  status: string
  createdAt: string
  reviewedAt?: string | null
  adminNote?: string | null
  bankAccount?: string
  driver?: {
    user?: { name?: string; phone?: string }
  }
}

function normalizeStatus(s: string): WithdrawalStatus {
  if (s === 'approved') return 'approved'
  if (s === 'paid') return 'paid'
  if (s === 'rejected') return 'rejected'
  return 'pending'
}

export async function fetchWithdrawals(): Promise<Withdrawal[]> {
  const res = await api.get<unknown>('/admin/wallet/withdrawals', {
    query: { limit: 100 },
  })
  const obj = res as { withdrawals?: { items?: BackendWithdrawal[] } | BackendWithdrawal[] }
  const rows = Array.isArray(obj.withdrawals)
    ? obj.withdrawals
    : obj.withdrawals?.items ?? []

  return rows.map((w) => {
    const bank = w.bankAccount ?? '—'
    return {
      id: w.id,
      driverId: w.driverId,
      driverName: w.driver?.user?.name ?? '—',
      driverPhone: w.driver?.user?.phone ?? '—',
      amount: Number(w.amount ?? 0),
      status: normalizeStatus(w.status),
      bankAccount: bank,
      bank: bank.startsWith('0') ? 'Wema •• ' + bank.slice(-4) : bank,
      reference: `WD-${w.id.slice(0, 8).toUpperCase()}`,
      requestedAt: w.createdAt,
      reviewedAt: w.reviewedAt ?? null,
      adminNote: w.adminNote ?? null,
    }
  })
}

export async function updateWithdrawalApi(
  id: string,
  status: WithdrawalStatus,
  note?: string,
): Promise<void> {
  await api.put(`/admin/wallet/withdrawals/${id}`, { status, note })
}

export async function processWithdrawalApi(id: string): Promise<void> {
  await api.post(`/admin/wallet/withdrawals/${id}/process`)
}