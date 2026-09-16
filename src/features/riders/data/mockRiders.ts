export type RiderStatus = 'active' | 'suspended' | 'nin_pending'

export type Rider = {
  id: string
  name: string
  phone: string
  email: string
  city: string
  walletBalance: number
  totalRides: number
  rating: number
  status: RiderStatus
  joinedAt: string
  nin: string | null
}

// 🟡 BACKEND REQUIRED — GET /admin/riders
export const MOCK_RIDERS: Rider[] = [
  { id: 'r1', name: 'Seyi Ariyo', phone: '+234 708 958 4607', email: 'seyi.ariyo@example.com', city: 'Ibadan', walletBalance: 4500, totalRides: 28, rating: 4.9, status: 'active', joinedAt: '2026-08-01', nin: '12345678901' },
  { id: 'r2', name: 'Tunde Bakare', phone: '+234 802 345 6789', email: 'tunde.b@example.com', city: 'Ibadan', walletBalance: 1200, totalRides: 15, rating: 4.7, status: 'active', joinedAt: '2026-08-12', nin: '23456789012' },
  { id: 'r3', name: 'Bola Ariyo', phone: '+234 803 456 7890', email: 'bola.a@example.com', city: 'Ibadan', walletBalance: 0, totalRides: 8, rating: 4.5, status: 'nin_pending', joinedAt: '2026-08-25', nin: null },
  { id: 'r4', name: 'Chidinma Okoye', phone: '+234 804 567 8901', email: 'chidinma.o@example.com', city: 'Lagos', walletBalance: 12000, totalRides: 42, rating: 5.0, status: 'active', joinedAt: '2026-07-15', nin: '34567890123' },
  { id: 'r5', name: 'Yusuf Adeleke', phone: '+234 805 678 9012', email: 'yusuf.a@example.com', city: 'Ibadan', walletBalance: 800, totalRides: 6, rating: 4.2, status: 'suspended', joinedAt: '2026-09-01', nin: '45678901234' },
  { id: 'r6', name: 'Grace Nwosu', phone: '+234 806 789 0123', email: 'grace.n@example.com', city: 'Abuja', walletBalance: 15000, totalRides: 55, rating: 4.8, status: 'active', joinedAt: '2026-06-20', nin: '56789012345' },
  { id: 'r7', name: 'Ibrahim Sule', phone: '+234 807 890 1234', email: 'ibrahim.s@example.com', city: 'Ibadan', walletBalance: 3200, totalRides: 19, rating: 4.6, status: 'active', joinedAt: '2026-08-18', nin: '67890123456' },
  { id: 'r8', name: 'Funke Adeyemi', phone: '+234 808 901 2345', email: 'funke.a@example.com', city: 'Lagos', walletBalance: 2200, totalRides: 11, rating: 4.4, status: 'active', joinedAt: '2026-09-02', nin: '78901234567' },
]

export function getRiderById(id: string | undefined): Rider | null {
  if (!id) return null
  return MOCK_RIDERS.find((r) => r.id === id) ?? null
}

// ---------- Async fetchers (used by TanStack Query) ----------

// 🟡 BACKEND REQUIRED — GET /admin/riders
export async function fetchRiders(): Promise<Rider[]> {
  await new Promise((r) => setTimeout(r, 500))
  return MOCK_RIDERS
}

// 🟡 BACKEND REQUIRED — GET /admin/riders/:id
export async function fetchRider(id: string): Promise<Rider> {
  await new Promise((r) => setTimeout(r, 400))
  const rider = MOCK_RIDERS.find((r) => r.id === id)
  if (!rider) throw new Error('Rider not found')
  return rider
}

// 🟡 BACKEND REQUIRED — POST /admin/riders/:id/suspend
export async function suspendRiderApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  console.log('[mock api] suspended rider', id)
}

// 🟡 BACKEND REQUIRED — POST /admin/riders/:id/reinstate
export async function reinstateRiderApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  console.log('[mock api] reinstated rider', id)
}