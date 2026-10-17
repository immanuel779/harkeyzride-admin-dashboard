import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchNotifications,
  markAllReadApi,
  markNotificationReadApi,
  type AdminNotification,
} from '../../features/notifications/data/mockNotifications'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => [...notificationKeys.all, 'list'] as const,
}

export function useNotifications() {
  return useQuery<AdminNotification[]>({
    queryKey: notificationKeys.list(),
    queryFn: fetchNotifications,
    refetchInterval: 20 * 1000,
    refetchOnWindowFocus: true,
  })
}

export function useMarkNotificationRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => markNotificationReadApi(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: notificationKeys.list() })
      const prev = qc.getQueryData<AdminNotification[]>(notificationKeys.list())
      qc.setQueryData<AdminNotification[]>(notificationKeys.list(), (old) =>
        old ? old.map((n) => (n.id === id ? { ...n, isRead: true } : n)) : old,
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.list(), ctx.prev)
    },
  })
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      const current =
        qc.getQueryData<AdminNotification[]>(notificationKeys.list()) ?? []
      return markAllReadApi(current.map((n) => n.id))
    },
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: notificationKeys.list() })
      const prev = qc.getQueryData<AdminNotification[]>(notificationKeys.list())
      qc.setQueryData<AdminNotification[]>(notificationKeys.list(), (old) =>
        old ? old.map((n) => ({ ...n, isRead: true })) : old,
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(notificationKeys.list(), ctx.prev)
    },
  })
}