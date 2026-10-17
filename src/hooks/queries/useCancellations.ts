import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchCancellationSnapshotReal,
  fetchCancellationsReal,
  MOCK_CANCELLATIONS,
  MOCK_SNAPSHOT,
  waivePenaltyApi,
  type CancellationEntry,
  type CancellationSnapshot,
} from '../../features/cancellations/data/mockCancellations'
import { env } from '../../config/env'

export const cancellationKeys = {
  all: ['cancellations'] as const,
  snapshot: () => [...cancellationKeys.all, 'snapshot'] as const,
  list: () => [...cancellationKeys.all, 'list'] as const,
}

export function useCancellationSnapshot() {
  return useQuery<CancellationSnapshot>({
    queryKey: cancellationKeys.snapshot(),
    queryFn: () =>
      env.useMockApi ? Promise.resolve(MOCK_SNAPSHOT) : fetchCancellationSnapshotReal(),
    refetchInterval: 60 * 1000,
  })
}

export function useCancellations() {
  return useQuery<CancellationEntry[]>({
    queryKey: cancellationKeys.list(),
    queryFn: () =>
      env.useMockApi ? Promise.resolve(MOCK_CANCELLATIONS) : fetchCancellationsReal(),
    refetchInterval: 60 * 1000,
  })
}

export function useWaivePenalty() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      note,
      adminName,
    }: {
      id: string
      note: string
      adminName: string
    }) => waivePenaltyApi(id, note, adminName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: cancellationKeys.all })
    },
  })
}