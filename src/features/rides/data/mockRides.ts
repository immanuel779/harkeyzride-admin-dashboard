export type RideStatus = 'in_progress' | 'completed' | 'cancelled' | 'sos'
export type PaymentMethod = 'wallet' | 'cash'

export type Ride = {
  id: string
  rider: string
  driver: string
  pickup: string
  destination: string
  fare: number
  paymentMethod: PaymentMethod
  status: RideStatus
  startedAt: string
  durationMin: number
}

// 🟡 BACKEND REQUIRED — GET /admin/rides
export const MOCK_RIDES: Ride[] = [
  { id: 'rd_4821', rider: 'Seyi Ariyo', driver: 'John Smith', pickup: 'Bodija', destination: 'Sweet Sensation', fare: 1200, paymentMethod: 'wallet', status: 'sos', startedAt: '2026-09-15 22:10', durationMin: 4 },
  { id: 'rd_4820', rider: 'Tunde Bakare', driver: 'Musa Ibrahim', pickup: 'Ring Road', destination: 'Palms Mall', fare: 1500, paymentMethod: 'wallet', status: 'in_progress', startedAt: '2026-09-15 22:05', durationMin: 8 },
  { id: 'rd_4819', rider: 'Bola Ariyo', driver: 'Ahmed Bello', pickup: 'UI Gate', destination: 'Dugbe Market', fare: 900, paymentMethod: 'cash', status: 'in_progress', startedAt: '2026-09-15 21:55', durationMin: 12 },
  { id: 'rd_4818', rider: 'Chidinma Okoye', driver: 'Kunle Adebayo', pickup: 'Bodija', destination: 'Ibadan Airport', fare: 3500, paymentMethod: 'wallet', status: 'completed', startedAt: '2026-09-15 21:30', durationMin: 28 },
  { id: 'rd_4817', rider: 'Yusuf Adeleke', driver: 'Emeka Okafor', pickup: 'Challenge', destination: 'Ring Road', fare: 1100, paymentMethod: 'cash', status: 'completed', startedAt: '2026-09-15 21:00', durationMin: 15 },
  { id: 'rd_4816', rider: 'Grace Nwosu', driver: '—', pickup: 'Iwo Road', destination: 'Total Filling', fare: 200, paymentMethod: 'wallet', status: 'cancelled', startedAt: '2026-09-15 20:45', durationMin: 0 },
  { id: 'rd_4815', rider: 'Ibrahim Sule', driver: 'Femi Akinyemi', pickup: 'Bodija', destination: 'University of Ibadan', fare: 700, paymentMethod: 'wallet', status: 'completed', startedAt: '2026-09-15 20:20', durationMin: 10 },
  { id: 'rd_4814', rider: 'Funke Adeyemi', driver: 'John Smith', pickup: 'Ring Road', destination: 'Dugbe', fare: 1300, paymentMethod: 'wallet', status: 'completed', startedAt: '2026-09-15 19:50', durationMin: 14 },
  { id: 'rd_4813', rider: 'Seyi Ariyo', driver: 'Musa Ibrahim', pickup: 'Bodija', destination: 'Sweet Sensation', fare: 1200, paymentMethod: 'wallet', status: 'completed', startedAt: '2026-09-15 19:10', durationMin: 8 },
]

export function getRideById(id: string | undefined): Ride | null {
  if (!id) return null
  return MOCK_RIDES.find((r) => r.id === id) ?? null
}