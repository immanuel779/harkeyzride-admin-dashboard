import { api } from '../../../lib/apiClient'

export type ComplaintStatus = 'open' | 'in_review' | 'resolved' | 'dismissed'
export type ComplaintPriority = 'low' | 'normal' | 'high' | 'urgent'

export type Complaint = {
  id: string
  subject: string
  category: string
  status: ComplaintStatus
  priority: ComplaintPriority
  riderId: string
  rideId: string | null
  description: string
  createdAt: string
  updatedAt: string
  resolvedAt: string | null
}

type BackendComplaint = {
  id: string
  subject?: string
  category?: string
  status?: string
  priority?: string
  userId?: string
  rideId?: string
  description?: string
  createdAt?: string
  updatedAt?: string
  resolvedAt?: string
}

function normalizeStatus(s?: string): ComplaintStatus {
  if (s === 'in_review') return 'in_review'
  if (s === 'resolved') return 'resolved'
  if (s === 'dismissed') return 'dismissed'
  return 'open'
}

function normalizePriority(p?: string): ComplaintPriority {
  if (p === 'urgent' || p === 'high' || p === 'low') return p
  return 'normal'
}

export async function fetchComplaints(): Promise<Complaint[]> {
  const res = await api.get<{ complaints?: BackendComplaint[] }>(
    '/admin/complaints',
  )
  const rows = res.complaints ?? []
  return rows.map((c) => ({
    id: c.id,
    subject: c.subject ?? 'Complaint',
    category: c.category ?? 'other',
    status: normalizeStatus(c.status),
    priority: normalizePriority(c.priority),
    riderId: c.userId ?? '',
    rideId: c.rideId ?? null,
    description: c.description ?? '—',
    createdAt: c.createdAt ?? new Date().toISOString(),
    updatedAt: c.updatedAt ?? c.createdAt ?? new Date().toISOString(),
    resolvedAt: c.resolvedAt ?? null,
  }))
}

export async function updateComplaintApi(
  id: string,
  status: ComplaintStatus,
  note?: string,
): Promise<void> {
  await api.put(`/admin/complaints/${id}`, { status, adminNote: note })
}