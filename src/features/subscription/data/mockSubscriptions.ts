export type SubscriptionStatus = 'success' | 'failed' | 'insufficient_balance' | 'pending'
export type SubscriptionMethod = 'wallet' | 'bank_transfer'

import { env } from '../../../config/env'
import { api } from '../../../lib/apiClient'
import {
  adaptSubscriptionList,
  type BackendPagination,
  type BackendSubscription,
} from '../../../services/adapters'

export type SubscriptionEntry = {
  id: string
  driverId: string
  driverName: string
  amount: number
  status: SubscriptionStatus
  method: SubscriptionMethod
  reference: string
  balanceBefore: number
  balanceAfter: number
  createdAt: string
}

export type SubscriptionSnapshot = {
  activeSubscriptions: number
  todayCollections: number
  failedDeductions: number
  lockedDrivers: number
  currency: string
}

// 🟡 BACKEND REQUIRED — GET /admin/subscriptions/snapshot
export const MOCK_SNAPSHOT: SubscriptionSnapshot = {
  activeSubscriptions: 184,
  todayCollections: 368000, // 184 × ₦2,000
  failedDeductions: 12,
  lockedDrivers: 5,
  currency: '₦',
}

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

// 🟡 BACKEND REQUIRED — GET /admin/subscriptions/ledger
export const MOCK_LEDGER: SubscriptionEntry[] = [
  { id: 'sub_001', driverId: 'd1', driverName: 'John Smith', amount: 2000, status: 'success', method: 'wallet', reference: 'HR-SUB-2026-0919-001', balanceBefore: 6500, balanceAfter: 4500, createdAt: minutesAgo(15) },
  { id: 'sub_002', driverId: 'd3', driverName: 'Ahmed Bello', amount: 2000, status: 'success', method: 'wallet', reference: 'HR-SUB-2026-0919-002', balanceBefore: 3200, balanceAfter: 1200, createdAt: minutesAgo(18) },
  { id: 'sub_003', driverId: 'd6', driverName: 'Emeka Okafor', amount: 2000, status: 'success', method: 'bank_transfer', reference: 'HR-SUB-2026-0919-003', balanceBefore: 0, balanceAfter: 0, createdAt: minutesAgo(22) },
  { id: 'sub_004', driverId: 'd4', driverName: 'Kunle Adebayo', amount: 2000, status: 'insufficient_balance', method: 'wallet', reference: 'HR-SUB-2026-0919-004', balanceBefore: 850, balanceAfter: 850, createdAt: minutesAgo(31) },
  { id: 'sub_005', driverId: 'd2', driverName: 'Musa Ibrahim', amount: 2000, status: 'success', method: 'wallet', reference: 'HR-SUB-2026-0919-005', balanceBefore: 12000, balanceAfter: 10000, createdAt: minutesAgo(45) },
  { id: 'sub_006', driverId: 'd8', driverName: 'Femi Akinyemi', amount: 2000, status: 'success', method: 'wallet', reference: 'HR-SUB-2026-0919-006', balanceBefore: 4500, balanceAfter: 2500, createdAt: minutesAgo(52) },
  { id: 'sub_007', driverId: 'd7', driverName: 'Tunde Bakare', amount: 2000, status: 'failed', method: 'bank_transfer', reference: 'HR-SUB-2026-0919-007', balanceBefore: 0, balanceAfter: 0, createdAt: minutesAgo(68) },
  { id: 'sub_008', driverId: 'd5', driverName: 'Segun Oladipo', amount: 2000, status: 'insufficient_balance', method: 'wallet', reference: 'HR-SUB-2026-0919-008', balanceBefore: 120, balanceAfter: 120, createdAt: minutesAgo(95) },
  { id: 'sub_009', driverId: 'd1', driverName: 'John Smith', amount: 2000, status: 'success', method: 'wallet', reference: 'HR-SUB-2026-0918-009', balanceBefore: 8500, balanceAfter: 6500, createdAt: minutesAgo(1440) },
  { id: 'sub_010', driverId: 'd3', driverName: 'Ahmed Bello', amount: 2000, status: 'success', method: 'wallet', reference: 'HR-SUB-2026-0918-010', balanceBefore: 5200, balanceAfter: 3200, createdAt: minutesAgo(1445) },
  { id: 'sub_011', driverId: 'd6', driverName: 'Emeka Okafor', amount: 2000, status: 'success', method: 'bank_transfer', reference: 'HR-SUB-2026-0918-011', balanceBefore: 0, balanceAfter: 0, createdAt: minutesAgo(1450) },
  { id: 'sub_012', driverId: 'd2', driverName: 'Musa Ibrahim', amount: 2000, status: 'pending', method: 'bank_transfer', reference: 'HR-SUB-2026-0918-012', balanceBefore: 0, balanceAfter: 0, createdAt: minutesAgo(1480) },
]

// ---------- Async fetchers ----------

export async function fetchSubscriptionSnapshot(): Promise<SubscriptionSnapshot> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 400))
    return MOCK_SNAPSHOT
  }
  // Derive from admin dashboard numbers
  const dash = await api.get<{
    activeSubscriptions: number
    totalRevenue: number
  }>('/admin/dashboard')

  return {
    activeSubscriptions: dash.activeSubscriptions,
    todayCollections: 0,
    failedDeductions: 0,
    lockedDrivers: 0,
    currency: '₦',
  }
}

export async function fetchSubscriptionLedger(): Promise<SubscriptionEntry[]> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 500))
    return MOCK_LEDGER
  }
  const res = await api.get<{
    subscriptions: BackendPagination<BackendSubscription> | BackendSubscription[]
    fee?: number
    currency?: string
  }>('/admin/subscription-ledger', { query: { limit: 100 } })

  const rows = Array.isArray(res.subscriptions)
    ? res.subscriptions
    : res.subscriptions?.items ?? []

  return adaptSubscriptionList(rows)
}