export type Channel = {
  id: string
  name: string
  description: string
  unread: number
  isPrivate: boolean
}

export type ChatMessage = {
  id: string
  channelId: string
  authorId: string
  authorName: string
  authorInitials: string
  body: string
  attachment?: {
    name: string
    size: string
    type: 'image' | 'file'
  }
  createdAt: string
}

export type OnlineAdmin = {
  id: string
  name: string
  initials: string
  status: 'online' | 'away'
}

// 🟡 BACKEND REQUIRED — GET /admin/chat/channels
// 🟡 Real-time: WebSocket 'chat:message_new' per channel
export const MOCK_CHANNELS: Channel[] = [
  { id: 'general', name: 'general', description: 'Company-wide updates', unread: 3, isPrivate: false },
  { id: 'operations', name: 'operations', description: 'Daily ops coordination', unread: 0, isPrivate: false },
  { id: 'sos-alerts', name: 'sos-alerts', description: 'Emergency escalation channel', unread: 1, isPrivate: false },
  { id: 'finance', name: 'finance', description: 'Payouts, refunds, reconciliations', unread: 0, isPrivate: true },
]

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

// 🟡 BACKEND REQUIRED — GET /admin/chat/channels/:id/messages
export const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'm_001',
    channelId: 'general',
    authorId: 'admin_001',
    authorName: 'Damilare Opeyemi',
    authorInitials: 'DO',
    body: 'Morning team. Just pushed the SOS response desk — please test it and flag anything weird.',
    createdAt: minutesAgo(180),
  },
  {
    id: 'm_002',
    channelId: 'general',
    authorId: 'admin_002',
    authorName: 'Oladayo Ayomide',
    authorInitials: 'OA',
    body: 'Noted. Backend endpoints for /admin/sos/* are up on staging. I\'ll send the OpenAPI link in a bit.',
    createdAt: minutesAgo(175),
  },
  {
    id: 'm_003',
    channelId: 'general',
    authorId: 'admin_003',
    authorName: 'Eguine Ejike',
    authorInitials: 'EE',
    body: 'Driver app is nearly done. One bug left in background GPS — should be fixed by EOD.',
    createdAt: minutesAgo(120),
  },
  {
    id: 'm_004',
    channelId: 'general',
    authorId: 'admin_001',
    authorName: 'Damilare Opeyemi',
    authorInitials: 'DO',
    body: 'Great. Let\'s sync at 4pm to align on the demo to Harkeyz.',
    createdAt: minutesAgo(60),
  },
  {
    id: 'm_005',
    channelId: 'general',
    authorId: 'admin_002',
    authorName: 'Oladayo Ayomide',
    authorInitials: 'OA',
    body: 'Sharing the API contract for the wallet module — paystack webhooks are working on staging now.',
    attachment: {
      name: 'wallet-api-v1.pdf',
      size: '342 KB',
      type: 'file',
    },
    createdAt: minutesAgo(45),
  },
  {
    id: 'm_006',
    channelId: 'general',
    authorId: 'admin_003',
    authorName: 'Eguine Ejike',
    authorInitials: 'EE',
    body: 'Screenshot of the driver home screen for reference.',
    attachment: {
      name: 'driver-home.png',
      size: '1.2 MB',
      type: 'image',
    },
    createdAt: minutesAgo(20),
  },
  {
    id: 'm_007',
    channelId: 'general',
    authorId: 'admin_001',
    authorName: 'Damilare Opeyemi',
    authorInitials: 'DO',
    body: 'Looks clean. Let\'s keep it tight.',
    createdAt: minutesAgo(5),
  },
]

export const MOCK_ONLINE_ADMINS: OnlineAdmin[] = [
  { id: 'admin_001', name: 'Damilare Opeyemi', initials: 'DO', status: 'online' },
  { id: 'admin_002', name: 'Oladayo Ayomide', initials: 'OA', status: 'online' },
  { id: 'admin_003', name: 'Eguine Ejike', initials: 'EE', status: 'online' },
  { id: 'admin_004', name: 'Bola A.', initials: 'BA', status: 'away' },
]