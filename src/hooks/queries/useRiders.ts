import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchRider,
  fetchRiders,
  reinstateRiderApi,
  suspendRiderApi,
  type Rider,
} from '../../features/riders/data/mockRiders'
import { queryKeys } from '../../lib/queryKeys'

export function useRiders() {
  return useQuery<Rider[]>({
    queryKey: queryKeys.riders.list(),
    queryFn: fetchRiders,
  })
}

export function useRider(id: string | undefined) {
  return useQuery<Rider>({
    queryKey: queryKeys.riders.detail(id ?? ''),
    queryFn: () => fetchRider(id!),
    enabled: !!id,
  })
}

export function useSuspendRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => suspendRiderApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.riders.all })
    },
  })
}

export function useReinstateRider() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => reinstateRiderApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.riders.all })
    },
  })
}