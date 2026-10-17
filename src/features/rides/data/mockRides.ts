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
import { api } from '../../../lib/apiClient'
import {
  adaptRide,
  adaptRideList,
  type BackendPagination,
  type BackendRide,
} from '../../../services/adapters'

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

// ---------- Extended detail data ----------

export type RideEvent = {
  id: string
  type:
    | 'requested'
    | 'driver_assigned'
    | 'driver_arriving'
    | 'driver_arrived'
    | 'trip_started'
    | 'trip_in_progress'
    | 'trip_completed'
    | 'cancelled'
    | 'sos_triggered'
    | 'sos_resolved'
  label: string
  description: string
  at: string
}

export type RideCoordinates = {
  pickup: { lat: number; lng: number }
  destination: { lat: number; lng: number }
  driverStart?: { lat: number; lng: number }
}

export type RideFareBreakdown = {
  baseFare: number
  distanceCharge: number
  timeCharge: number
  cngDiscount: number
  surgeMultiplier: number
  total: number
}

export type RideSosInfo = {
  triggered: boolean
  severity: 'critical' | 'high' | 'medium'
  triggeredAt: string
  resolvedAt: string | null
  acknowledgedBy: string | null
  resolvedBy: string | null
  notes: string[]
}

const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60 * 1000).toISOString()

// 🟡 BACKEND REQUIRED — GET /admin/rides/:id/events
export function getRideEvents(_id: string): RideEvent[] {
  return [
    { id: 'e1', type: 'requested', label: 'Ride requested', description: 'Rider requested CNG Economy ride', at: minutesAgo(60) },
    { id: 'e2', type: 'driver_assigned', label: 'Driver assigned', description: 'Musa Ibrahim accepted the request', at: minutesAgo(58) },
    { id: 'e3', type: 'driver_arriving', label: 'Driver arriving', description: 'Driver was 3 minutes away', at: minutesAgo(56) },
    { id: 'e4', type: 'driver_arrived', label: 'Driver arrived', description: 'Driver arrived at pickup point', at: minutesAgo(52) },
    { id: 'e5', type: 'trip_started', label: 'Trip started', description: 'Rider picked up, en route to destination', at: minutesAgo(50) },
    { id: 'e6', type: 'trip_in_progress', label: 'In transit', description: 'Estimated arrival 8 minutes', at: minutesAgo(48) },
    { id: 'e7', type: 'trip_completed', label: 'Trip completed', description: 'Rider dropped off, fare charged', at: minutesAgo(42) },
  ]
}

// 🟡 BACKEND REQUIRED — GET /admin/rides/:id/route
export function getRideCoordinates(_id: string): RideCoordinates {
  return {
    pickup: { lat: 7.418, lng: 3.9024 },
    destination: { lat: 7.4168, lng: 3.9042 },
    driverStart: { lat: 7.4145, lng: 3.8998 },
  }
}

// 🟡 BACKEND REQUIRED — GET /admin/rides/:id/fare-breakdown
export function getRideFareBreakdown(ride: {
  fare: number
}): RideFareBreakdown {
  const baseFare = 500
  const distanceCharge = 600
  const timeCharge = 100
  const subtotal = baseFare + distanceCharge + timeCharge
  const cngDiscount = Math.round(subtotal * 0.1 * 100) / 100
  return {
    baseFare,
    distanceCharge,
    timeCharge,
    cngDiscount,
    surgeMultiplier: 1,
    total: ride.fare,
  }
}

// 🟡 BACKEND REQUIRED — GET /admin/rides/:id/sos
export function getRideSosInfo(
  status: string,
  _id: string,
): RideSosInfo | null {
  if (status !== 'sos') return null
  return {
    triggered: true,
    severity: 'critical',
    triggeredAt: minutesAgo(3),
    resolvedAt: null,
    acknowledgedBy: null,
    resolvedBy: null,
    notes: [],
  }
}
// ---------- Real API fetchers ----------

export async function fetchRidesReal(): Promise<Ride[]> {
  const res = await api.get<BackendPagination<BackendRide>>('/admin/rides', {
    query: { limit: 100 },
  })
  return adaptRideList(res.items)
}

export async function fetchRideReal(id: string): Promise<Ride | null> {
  const res = await api.get<{ ride: BackendRide }>(`/admin/rides/${id}`)
  if (!res?.ride) return null
  return adaptRide(res.ride)
}