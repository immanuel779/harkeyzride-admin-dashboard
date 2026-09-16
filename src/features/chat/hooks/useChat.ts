import { useEffect, useMemo, useRef, useState } from 'react'

import {
  MOCK_CHANNELS,
  MOCK_MESSAGES,
  MOCK_ONLINE_ADMINS,
  type Channel,
  type ChatMessage,
} from '../data/mockChat'
import { useAuth } from '../../../store/AuthContext'

export function useChat() {
  const { user } = useAuth()
  const [channels, setChannels] = useState<Channel[]>(MOCK_CHANNELS)
  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES)
  const [activeChannelId, setActiveChannelId] = useState<string>(
    MOCK_CHANNELS[0]?.id ?? 'general',
  )

  // Clear unread when switching channel
  const selectChannel = (id: string) => {
    setActiveChannelId(id)
    setChannels((list) =>
      list.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    )
  }

  const activeChannel = useMemo(
    () => channels.find((c) => c.id === activeChannelId) ?? channels[0],
    [channels, activeChannelId],
  )

  const activeMessages = useMemo(
    () =>
      messages
        .filter((m) => m.channelId === activeChannelId)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    [messages, activeChannelId],
  )

  const sendMessage = (
    body: string,
    attachment?: ChatMessage['attachment'],
  ) => {
    if (!user) return
    const initials = `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()

    // 🟡 BACKEND REQUIRED — POST /admin/chat/channels/:id/messages
    // 🟡 Real-time: emit WebSocket 'chat:message_send'
    const newMessage: ChatMessage = {
      id: `m_${Date.now()}`,
      channelId: activeChannelId,
      authorId: user.id,
      authorName: `${user.firstName} ${user.lastName}`,
      authorInitials: initials || 'A',
      body,
      attachment,
      createdAt: new Date().toISOString(),
    }
    setMessages((list) => [...list, newMessage])
  }

  return {
    channels,
    admins: MOCK_ONLINE_ADMINS,
    activeChannel,
    activeMessages,
    selectChannel,
    sendMessage,
  }
}