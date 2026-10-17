import { api } from '../../../lib/apiClient'

export type PromotionType = 'percent' | 'fixed'

export type Promotion = {
  id: string
  code: string
  type: PromotionType
  value: number
  active: boolean
  expiresAt: string | null
  createdAt: string
}

type BackendPromotion = {
  id: string
  code: string
  type: string
  value: number
  active?: boolean
  expiresAt?: string
  createdAt?: string
}

export async function fetchPromotions(): Promise<Promotion[]> {
  const res = await api.get<{ promotions?: BackendPromotion[] }>(
    '/admin/promotions',
  )
  const rows = res.promotions ?? []
  return rows.map((p) => ({
    id: p.id,
    code: p.code,
    type: (p.type === 'percent' ? 'percent' : 'fixed') as PromotionType,
    value: Number(p.value ?? 0),
    active: p.active !== false,
    expiresAt: p.expiresAt ?? null,
    createdAt: p.createdAt ?? new Date().toISOString(),
  }))
}

export async function createPromotionApi(input: {
  code: string
  type: PromotionType
  value: number
  active: boolean
  expiresAt?: string
}): Promise<void> {
  await api.post('/admin/promotions', input)
}

export async function deletePromotionApi(id: string): Promise<void> {
  await api.delete(`/admin/promotions/${id}`)
}