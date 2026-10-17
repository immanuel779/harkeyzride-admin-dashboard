import { useQuery } from '@tanstack/react-query'

import {
  fetchRidesReal,
  MOCK_RIDES,
  type Ride,
} from '../../features/rides/data/mockRides'
import { env } from '../../config/env'

export const rideKeys = {
  all: ['rides'] as const,
  list: () => [...rideKeys.all, 'list'] as const,
  detail: (id: string) => [...rideKeys.all, 'detail', id] as const,
}

export function useRides() {
  return useQuery<Ride[]>({
    queryKey: rideKeys.list(),
    queryFn: () => (env.useMockApi ? Promise.resolve(MOCK_RIDES) : fetchRidesReal()),
    refetchInterval: 30 * 1000,
  })
}