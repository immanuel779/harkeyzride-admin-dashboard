import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  createPromotionApi,
  deletePromotionApi,
  fetchPromotions,
  type Promotion,
  type PromotionType,
} from '../../features/promotions/data/mockPromotions'

export const promotionKeys = {
  all: ['promotions'] as const,
  list: () => [...promotionKeys.all, 'list'] as const,
}

export function usePromotions() {
  return useQuery<Promotion[]>({
    queryKey: promotionKeys.list(),
    queryFn: fetchPromotions,
  })
}

export function useCreatePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      code: string
      type: PromotionType
      value: number
      active: boolean
      expiresAt?: string
    }) => createPromotionApi(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: promotionKeys.all }),
  })
}

export function useDeletePromotion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deletePromotionApi(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: promotionKeys.all }),
  })
}