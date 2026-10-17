import { useQuery } from '@tanstack/react-query'

import {
  fetchDashboardOverview,
  fetchDashboardOverviewReal,
  type DashboardOverview,
} from '../../features/dashboard/services/dashboard'
import { env } from '../../config/env'
import { queryKeys } from '../../lib/queryKeys'

export function useDashboardOverview() {
  return useQuery<DashboardOverview>({
    queryKey: queryKeys.dashboard.overview(),
    queryFn: () =>
      env.useMockApi ? fetchDashboardOverview() : fetchDashboardOverviewReal(),
    refetchInterval: 60 * 1000,
  })
}