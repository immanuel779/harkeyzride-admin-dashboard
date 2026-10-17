import { useQuery } from '@tanstack/react-query'

import {
  fetchTransactionsReal,
  MOCK_TRANSACTIONS,
  type Transaction,
} from '../../features/financials/data/mockTransactions'
import { env } from '../../config/env'

export function useTransactions() {
  return useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () =>
      env.useMockApi
        ? Promise.resolve(MOCK_TRANSACTIONS)
        : fetchTransactionsReal(),
    refetchInterval: 60 * 1000,
  })
}