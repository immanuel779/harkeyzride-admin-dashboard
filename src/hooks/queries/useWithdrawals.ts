import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchWithdrawals,
  processWithdrawalApi,
  updateWithdrawalApi,
  type Withdrawal,
  type WithdrawalStatus,
} from '../../features/withdrawals/data/mockWithdrawals'

export const withdrawalKeys = {
  all: ['withdrawals'] as const,
  list: () => [...withdrawalKeys.all, 'list'] as const,
}

export function useWithdrawals() {
  return useQuery<Withdrawal[]>({
    queryKey: withdrawalKeys.list(),
    queryFn: fetchWithdrawals,
    refetchInterval: 30 * 1000,
  })
}

export function useUpdateWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string
      status: WithdrawalStatus
      note?: string
    }) => updateWithdrawalApi(id, status, note),
    onSuccess: () => qc.invalidateQueries({ queryKey: withdrawalKeys.all }),
  })
}

export function useProcessWithdrawal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => processWithdrawalApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: withdrawalKeys.all }),
  })
}