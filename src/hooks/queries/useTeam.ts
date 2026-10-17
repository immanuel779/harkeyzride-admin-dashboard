import { useQuery } from '@tanstack/react-query'

import {
  fetchTeamReal,
  MOCK_TEAM,
  type TeamMember,
} from '../../features/team/data/mockAdmins'
import { env } from '../../config/env'

export const teamKeys = {
  all: ['team'] as const,
  list: () => [...teamKeys.all, 'list'] as const,
}

export function useTeam() {
  return useQuery<TeamMember[]>({
    queryKey: teamKeys.list(),
    queryFn: () =>
      env.useMockApi ? Promise.resolve(MOCK_TEAM) : fetchTeamReal(),
  })
}