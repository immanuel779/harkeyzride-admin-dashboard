import { useQuery } from '@tanstack/react-query'

import {
  fetchAuditLogReal,
  MOCK_AUDIT_LOG,
  type AuditEntry,
} from '../../features/audit/data/mockAuditLog'
import { env } from '../../config/env'

export const auditKeys = {
  all: ['audit'] as const,
  log: () => [...auditKeys.all, 'log'] as const,
}

export function useAuditLog() {
  return useQuery<AuditEntry[]>({
    queryKey: auditKeys.log(),
    queryFn: () =>
      env.useMockApi ? Promise.resolve(MOCK_AUDIT_LOG) : fetchAuditLogReal(),
  })
}