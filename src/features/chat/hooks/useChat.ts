import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import {
  fetchChannels,
  fetchMessages,
  markChannelReadApi,
  sendMessageApi,
} from '../services/chatApi'
import { MOCK_ONLINE_ADMINS, type Channel, type ChatMessage } from '../data/mockChat'

export const chatKeys = {
  all: ['chat'] as const,
  channels: () => [...chatKeys.all, 'channels'] as const,
  messages: (channelId: string) =>
    [...chatKeys.all, 'messages', channelId] as const,
}

export function useChat() {
  const qc = useQueryClient()
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null)

  // ---------- Channels ----------
  const channelsQuery = useQuery<Channel[]>({
    queryKey: chatKeys.channels(),
    queryFn: fetchChannels,
    refetchInterval: 15 * 1000,
  })

  const channels = channelsQuery.data ?? []

  useEffect(() => {
    if (!activeChannelId && channels.length > 0) {
      setActiveChannelId(channels[0].id)
    }
  }, [channels, activeChannelId])

  const activeChannel =
    channels.find((c) => c.id === activeChannelId) ?? channels[0] ?? null

  // ---------- Messages ----------
  const messagesQuery = useQuery<ChatMessage[]>({
    queryKey: activeChannelId
      ? chatKeys.messages(activeChannelId)
      : (['chat', 'messages', 'none'] as const),
    queryFn: (): Promise<ChatMessage[]> =>
      activeChannelId
        ? fetchMessages(activeChannelId)
        : Promise.resolve([] as ChatMessage[]),
    enabled: !!activeChannelId,
    refetchInterval: 5 * 1000,
  })

  const activeMessages: ChatMessage[] = messagesQuery.data ?? []

  // Mark channel read when it becomes active
  useEffect(() => {
    if (activeChannelId) {
      markChannelReadApi(activeChannelId).then(() => {
        qc.invalidateQueries({ queryKey: chatKeys.channels() })
      })
    }
  }, [activeChannelId, qc])

  // ---------- Select ----------
  const selectChannel = useCallback(
    (id: string) => {
      setActiveChannelId(id)
      qc.setQueryData<Channel[]>(chatKeys.channels(), (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, unread: 0 } : c)) : old,
      )
    },
    [qc],
  )

  // ---------- Send ----------
  const sendMessage = useCallback(
    async (
      body: string,
      attachment?: { name: string; size: string; type: 'image' | 'file' },
    ) => {
      if (!activeChannelId) return
      try {
        await sendMessageApi(activeChannelId, body, attachment)
        await qc.invalidateQueries({
          queryKey: chatKeys.messages(activeChannelId),
        })
        await qc.invalidateQueries({ queryKey: chatKeys.channels() })
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Failed to send message:', e)
        throw e
      }
    },
    [activeChannelId, qc],
  )

  const totalUnread = useMemo(
    () => channels.reduce((sum, c) => sum + (c.unread ?? 0), 0),
    [channels],
  )

  return {
    channels,
    admins: MOCK_ONLINE_ADMINS,
    activeChannel,
    activeMessages,
    selectChannel,
    sendMessage,
    isLoadingChannels: channelsQuery.isLoading,
    isLoadingMessages: messagesQuery.isLoading,
    totalUnread,
  }
}