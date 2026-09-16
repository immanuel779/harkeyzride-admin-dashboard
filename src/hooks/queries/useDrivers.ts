import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import {
  approveDriverApi,
  fetchDriver,
  fetchDrivers,
  rejectDriverApi,
  type Driver,
} from '../../features/drivers/data/mockDrivers'
import { queryKeys } from '../../lib/queryKeys'

// ---------- Queries ----------

export function useDrivers() {
  return useQuery<Driver[]>({
    queryKey: queryKeys.drivers.list(),
    queryFn: fetchDrivers,
  })
}

export function useDriver(id: string | undefined) {
  return useQuery<Driver>({
    queryKey: queryKeys.drivers.detail(id ?? ''),
    queryFn: () => fetchDriver(id!),
    enabled: !!id,
  })
}

// ---------- Mutations ----------

export function useApproveDriver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => approveDriverApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all })
    },
  })
}

export function useRejectDriver() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rejectDriverApi(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.drivers.all })
    },
  })
}