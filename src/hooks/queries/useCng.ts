import { useQuery } from '@tanstack/react-query'

import {
  fetchCngSnapshotReal,
  fetchCngStationsReal,
  fetchRefuelsReal,
  MOCK_SNAPSHOT,
  MOCK_STATIONS,
  MOCK_REFUELS,
  type CngSnapshot,
  type CngStation,
  type RefuelEntry,
} from '../../features/cng/data/mockCng'
import { env } from '../../config/env'

export const cngKeys = {
  all: ['cng'] as const,
  snapshot: () => [...cngKeys.all, 'snapshot'] as const,
  stations: () => [...cngKeys.all, 'stations'] as const,
  refuels: () => [...cngKeys.all, 'refuels'] as const,
}

export function useCngSnapshot() {
  return useQuery<CngSnapshot>({
    queryKey: cngKeys.snapshot(),
    queryFn: () => (env.useMockApi ? Promise.resolve(MOCK_SNAPSHOT) : fetchCngSnapshotReal()),
    refetchInterval: 60 * 1000,
  })
}

export function useCngStations() {
  return useQuery<CngStation[]>({
    queryKey: cngKeys.stations(),
    queryFn: () => (env.useMockApi ? Promise.resolve(MOCK_STATIONS) : fetchCngStationsReal()),
  })
}

export function useRefuels() {
  return useQuery<RefuelEntry[]>({
    queryKey: cngKeys.refuels(),
    queryFn: () => (env.useMockApi ? Promise.resolve(MOCK_REFUELS) : fetchRefuelsReal()),
  })
}