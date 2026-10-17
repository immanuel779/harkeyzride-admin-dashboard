import { api } from '../../../lib/apiClient'
import { env } from '../../../config/env'
import {
  MOCK_CHANNELS,
  MOCK_MESSAGES,
  type Channel,
  type ChatMessage,
} from '../data/mockChat'

export type BackendChannel = {
  id: string
  name: string
  description: string
  isPrivate: boolean
  unread: number
  lastMessageAt: string | null
}

export type BackendChatMessage = {
  id: string
  channelId: string
  authorId: string | null
  authorName: string
  authorInitials: string
  body: string
  attachment: {
    name: string
    size: string
    type: 'image' | 'file'
  } | null
  createdAt: string
}

export async function fetchChannels(): Promise<Channel[]> {
  if (env.useMockApi) {
    return MOCK_CHANNELS.map((c) => ({ ...c }))
  }
  const res = await api.get<{ channels: BackendChannel[] }>(
    '/admin/chat/channels',
  )
  return (res.channels ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    unread: c.unread ?? 0,
    isPrivate: c.isPrivate,
  }))
}

export async function fetchMessages(
  channelId: string,
  since?: string | null,
): Promise<ChatMessage[]> {
  if (env.useMockApi) {
    return MOCK_MESSAGES.filter((m) => m.channelId === channelId).map((m) => ({
      ...m,
    }))
  }
  const res = await api.get<{ messages: BackendChatMessage[] }>(
    `/admin/chat/channels/${channelId}/messages`,
    { query: since ? { since, limit: 100 } : { limit: 100 } },
  )
  return (res.messages ?? []).map((m) => ({
    id: m.id,
    channelId: m.channelId,
    authorId: m.authorId ?? '',
    authorName: m.authorName,
    authorInitials: m.authorInitials,
    body: m.body,
    attachment: m.attachment ?? undefined,
    createdAt: m.createdAt,
  }))
}

export async function sendMessageApi(
  channelId: string,
  body: string,
  attachment?: { name: string; size: string; type: 'image' | 'file' },
): Promise<ChatMessage> {
  if (env.useMockApi) {
    return {
      id: `mock_${Date.now()}`,
      channelId,
      authorId: 'admin_001',
      authorName: 'You',
      authorInitials: 'YO',
      body,
      attachment,
      createdAt: new Date().toISOString(),
    }
  }
  const res = await api.post<{ message: BackendChatMessage }>(
    `/admin/chat/channels/${channelId}/messages`,
    { body, attachment: attachment ?? null },
  )
  const m = res.message
  return {
    id: m.id,
    channelId: m.channelId,
    authorId: m.authorId ?? '',
    authorName: m.authorName,
    authorInitials: m.authorInitials,
    body: m.body,
    attachment: m.attachment ?? undefined,
    createdAt: m.createdAt,
  }
}

export async function markChannelReadApi(channelId: string): Promise<void> {
  if (env.useMockApi) return
  try {
    await api.put(`/admin/chat/channels/${channelId}/read`)
  } catch {
    // Non-fatal
  }
}