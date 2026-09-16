import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  acknowledgeSosApi,
  fetchSosAlerts,
  resolveSosApi,
  type SosAlert,
} from '../../features/sos/data/mockAlerts'
import { queryKeys } from '../../lib/queryKeys'

export function useSosAlerts() {
  return useQuery<SosAlert[]>({
    queryKey: queryKeys.sos.alerts(),
    queryFn: fetchSosAlerts,
    refetchInterval: 30 * 1000, // auto-refetch every 30s — SOS is time-sensitive
  })
}

export function useAcknowledgeSos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => acknowledgeSosApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sos.all })
    },
  })
}

export function useResolveSos() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      resolveSosApi(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sos.all })
    },
  })
}