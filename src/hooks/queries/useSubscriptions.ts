import { useQuery } from '@tanstack/react-query'

import {
  fetchSubscriptionLedger,
  fetchSubscriptionSnapshot,
  type SubscriptionEntry,
  type SubscriptionSnapshot,
} from '../../features/subscription/data/mockSubscriptions'

export const subscriptionKeys = {
  all: ['subscriptions'] as const,
  snapshot: () => [...subscriptionKeys.all, 'snapshot'] as const,
  ledger: () => [...subscriptionKeys.all, 'ledger'] as const,
}

export function useSubscriptionSnapshot() {
  return useQuery<SubscriptionSnapshot>({
    queryKey: subscriptionKeys.snapshot(),
    queryFn: fetchSubscriptionSnapshot,
    refetchInterval: 60 * 1000,
  })
}

export function useSubscriptionLedger() {
  return useQuery<SubscriptionEntry[]>({
    queryKey: subscriptionKeys.ledger(),
    queryFn: fetchSubscriptionLedger,
    refetchInterval: 60 * 1000,
  })
}