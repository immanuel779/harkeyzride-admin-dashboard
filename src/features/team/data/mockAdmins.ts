export type AdminRole = 'admin'

export type TeamMember = {
  id: string
  name: string
  email: string
  phone: string
  role: AdminRole
  status: 'active' | 'inactive'
  joinedAt: string
  lastLoginAt: string | null
}
import { api } from '../../../lib/apiClient'
import {
  unwrapList,
  type BackendUser,
} from '../../../services/adapters'

// 🟡 BACKEND REQUIRED — GET /admin/team (once Oladayo adds it)
// For now: mirrors the 4 admins being seeded
export const MOCK_TEAM: TeamMember[] = [
  {
    id: 'admin_ceo',
    name: 'Samuel',
    email: 'harkeyzride@gmail.com',
    phone: '08070467789',
    role: 'admin',
    status: 'active',
    joinedAt: '2026-10-15',
    lastLoginAt: null,
  },
  {
    id: 'admin_damilare',
    name: 'Damilare Opeyemi',
    email: 'officialcodecrafttech@gmail.com',
    phone: '07089584607',
    role: 'admin',
    status: 'active',
    joinedAt: '2026-10-15',
    lastLoginAt: null,
  },
  {
    id: 'admin_oladayo',
    name: 'Oladayo Ayomide',
    email: 'ogunbanjo2019@gmail.com',
    phone: '08106243294',
    role: 'admin',
    status: 'active',
    joinedAt: '2026-10-15',
    lastLoginAt: null,
  },
  {
    id: 'admin_ejike',
    name: 'Eguine Ejike',
    email: 'eugeneejike51@gmail.com',
    phone: '08112153223',
    role: 'admin',
    status: 'active',
    joinedAt: '2026-10-15',
    lastLoginAt: null,
  },
]

export async function fetchTeam(): Promise<TeamMember[]> {
  await new Promise((r) => setTimeout(r, 300))
  return MOCK_TEAM.map((m) => ({ ...m }))
}
export async function fetchTeamReal(): Promise<TeamMember[]> {
  const res = await api.get<unknown>('/admin/users/search', {
    query: { q: 'admin', limit: 50 },
  })
  const rows = unwrapList<BackendUser>(res)

  return rows
    .filter((u) => u.role === 'admin')
    .map((u) => {
      const parts = (u.name ?? '').split(' ')
      return {
        id: u.id,
        name: u.name ?? '—',
        email: u.email ?? '—',
        phone: u.phone ?? '—',
        role: 'admin' as const,
        status: (u.status === 'active' ? 'active' : 'inactive') as
          | 'active'
          | 'inactive',
        joinedAt: (u.createdAt ?? '').slice(0, 10),
        lastLoginAt: null,
        _firstName: parts[0],
        _lastName: parts.slice(1).join(' '),
      } as TeamMember & { _firstName?: string; _lastName?: string }
    })
}