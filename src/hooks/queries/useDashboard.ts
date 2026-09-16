import { useQuery } from '@tanstack/react-query'

import {
  fetchDashboardOverview,
  type DashboardOverview,
} from '../../features/dashboard/services/dashboard'
import { queryKeys } from '../../lib/queryKeys'

export function useDashboardOverview() {
  return useQuery<DashboardOverview>({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: fetchDashboardOverview,
    refetchInterval: 60 * 1000, // refresh every 60s
  })
}