export type DriverStatus = 'pending' | 'approved' | 'rejected'

export type Driver = {
  id: string
  name: string
  phone: string
  email: string
  city: string
  vehicle: string
  plate: string
  vehicleColor: string
  status: DriverStatus
  submittedAt: string
  nin: string
  selfieUrl: string | null
  ninDocUrl: string | null
}
import { env } from '../../../config/env'
import { api } from '../../../lib/apiClient'
import {
  adaptDriver,
  adaptDriverList,
  type BackendDriver,
  type BackendPagination,
} from '../../../services/adapters'

const INITIAL: Driver[] = [
  { id: 'd1', name: 'John Smith', phone: '+234 801 234 5678', email: 'john.smith@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'NR291-KJA', vehicleColor: 'Green', status: 'approved', submittedAt: '2026-09-14', nin: '23456789012', selfieUrl: null, ninDocUrl: null },
  { id: 'd2', name: 'Musa Ibrahim', phone: '+234 802 345 6789', email: 'musa.ibrahim@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'IB-457-XY', vehicleColor: 'Green', status: 'pending', submittedAt: '2026-09-14', nin: '12345678901', selfieUrl: null, ninDocUrl: null },
  { id: 'd3', name: 'Ahmed Bello', phone: '+234 803 456 7890', email: 'ahmed.bello@example.com', city: 'Ibadan', vehicle: 'TVS King', plate: 'OY-892-AB', vehicleColor: 'Yellow', status: 'approved', submittedAt: '2026-09-13', nin: '34567890123', selfieUrl: null, ninDocUrl: null },
  { id: 'd4', name: 'Kunle Adebayo', phone: '+234 804 567 8901', email: 'kunle.adebayo@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'OY-221-CD', vehicleColor: 'Green', status: 'pending', submittedAt: '2026-09-13', nin: '45678901234', selfieUrl: null, ninDocUrl: null },
  { id: 'd5', name: 'Segun Oladipo', phone: '+234 805 678 9012', email: 'segun.oladipo@example.com', city: 'Lagos', vehicle: 'TVS King', plate: 'LA-556-EF', vehicleColor: 'Yellow', status: 'rejected', submittedAt: '2026-09-12', nin: '56789012345', selfieUrl: null, ninDocUrl: null },
  { id: 'd6', name: 'Emeka Okafor', phone: '+234 806 789 0123', email: 'emeka.okafor@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'AN-334-GH', vehicleColor: 'Green', status: 'approved', submittedAt: '2026-09-12', nin: '67890123456', selfieUrl: null, ninDocUrl: null },
  { id: 'd7', name: 'Tunde Bakare', phone: '+234 807 890 1234', email: 'tunde.bakare@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'OY-778-IJ', vehicleColor: 'Green', status: 'pending', submittedAt: '2026-09-11', nin: '78901234567', selfieUrl: null, ninDocUrl: null },
  { id: 'd8', name: 'Femi Akinyemi', phone: '+234 808 901 2345', email: 'femi.akinyemi@example.com', city: 'Abuja', vehicle: 'TVS King', plate: 'AB-112-KL', vehicleColor: 'Yellow', status: 'approved', submittedAt: '2026-09-11', nin: '89012345678', selfieUrl: null, ninDocUrl: null },
]

// ---------- Mutable in-memory store ----------

let store: Driver[] = INITIAL.map((d) => ({ ...d }))

// Sync lookup (used by Detail page for direct access)
export function getDriverById(id: string | undefined): Driver | null {
  if (!id) return null
  const driver = store.find((d) => d.id === id)
  return driver ? { ...driver } : null
}

// ---------- Async fetchers ----------

// ---------- Fetchers (mock OR real) ----------

export async function fetchDrivers(): Promise<Driver[]> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 500))
    return store.map((d) => ({ ...d }))
  }
  const res = await api.get<BackendPagination<BackendDriver>>(
    '/admin/drivers',
    { query: { limit: 100 } },
  )
  return adaptDriverList(res.items)
}

export async function fetchDriver(id: string): Promise<Driver> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 400))
    const driver = store.find((d) => d.id === id)
    if (!driver) throw new Error('Driver not found')
    return { ...driver }
  }
  // No dedicated single-driver endpoint — fetch list and filter
  const res = await api.get<BackendPagination<BackendDriver>>(
    '/admin/drivers',
    { query: { limit: 200 } },
  )
  const found = res.items.find((d) => d.id === id)
  if (!found) throw new Error('Driver not found')
  return adaptDriver(found)
}

export async function approveDriverApi(id: string): Promise<void> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 700))
    store = store.map((d) => (d.id === id ? { ...d, status: 'approved' } : d))
    return
  }
  await api.put(`/admin/drivers/${id}/approve`)
}

export async function rejectDriverApi(id: string): Promise<void> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 700))
    store = store.map((d) => (d.id === id ? { ...d, status: 'rejected' } : d))
    return
  }
  await api.put(`/admin/drivers/${id}/reject`)
}

export async function suspendDriverApi(id: string): Promise<void> {
  if (env.useMockApi) {
    await new Promise((r) => setTimeout(r, 700))
    store = store.map((d) => (d.id === id ? { ...d, status: 'rejected' } : d))
    return
  }
  await api.put(`/admin/drivers/${id}/suspend`)
}
// ---------- Extended detail data ----------

export type DriverDocument = {
  id: string
  label: string
  status: 'approved' | 'pending' | 'rejected'
  uploadedAt: string
  fileName: string
  reviewNote: string | null
}

export type DriverTrip = {
  id: string
  rideId: string
  riderName: string
  pickup: string
  destination: string
  fare: number
  status: 'completed' | 'cancelled' | 'in_progress'
  completedAt: string
}

export type DriverEarningEntry = {
  date: string
  gross: number
  commission: number
  subscription: number
  net: number
  trips: number
}

export type DriverPayout = {
  id: string
  amount: number
  status: 'paid' | 'pending' | 'approved' | 'rejected'
  requestedAt: string
  reviewedAt: string | null
  bank: string
  adminNote: string | null
}

const hoursAgo = (h: number) =>
  new Date(Date.now() - h * 60 * 60 * 1000).toISOString()

const daysAgo = (d: number) =>
  new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString()

export function getDriverDocuments(_id: string): DriverDocument[] {
  return [
    { id: 'doc_lic', label: 'Driver License', status: 'approved', uploadedAt: daysAgo(30), fileName: 'license.pdf', reviewNote: null },
    { id: 'doc_veh', label: 'Vehicle Registration', status: 'approved', uploadedAt: daysAgo(28), fileName: 'vehicle-reg.pdf', reviewNote: null },
    { id: 'doc_ins', label: 'Insurance Certificate', status: 'pending', uploadedAt: daysAgo(2), fileName: 'insurance.pdf', reviewNote: null },
    { id: 'doc_road', label: 'Road Worthiness', status: 'pending', uploadedAt: daysAgo(2), fileName: 'road-worthiness.pdf', reviewNote: null },
    { id: 'doc_selfie', label: 'Live Selfie', status: 'approved', uploadedAt: daysAgo(2), fileName: 'selfie.jpg', reviewNote: 'Matches NIN photo' },
    { id: 'doc_nin', label: 'NIN Slip', status: 'approved', uploadedAt: daysAgo(2), fileName: 'nin.pdf', reviewNote: 'Verified against NIMC' },
  ]
}

export function getDriverTrips(_id: string): DriverTrip[] {
  return [
    { id: 't1', rideId: 'rd_4821', riderName: 'Seyi Ariyo', pickup: 'Bodija', destination: 'Sweet Sensation', fare: 1200, status: 'completed', completedAt: hoursAgo(1) },
    { id: 't2', rideId: 'rd_4820', riderName: 'Tunde Bakare', pickup: 'Ring Road', destination: 'Palms Mall', fare: 1500, status: 'completed', completedAt: hoursAgo(3) },
    { id: 't3', rideId: 'rd_4815', riderName: 'Grace Nwosu', pickup: 'UI Gate', destination: 'Dugbe', fare: 900, status: 'completed', completedAt: hoursAgo(6) },
    { id: 't4', rideId: 'rd_4810', riderName: 'Ibrahim Sule', pickup: 'Challenge', destination: 'Ring Road', fare: 1100, status: 'completed', completedAt: hoursAgo(9) },
    { id: 't5', rideId: 'rd_4805', riderName: 'Funke Adeyemi', pickup: 'Akobo', destination: 'UI', fare: 700, status: 'cancelled', completedAt: hoursAgo(12) },
  ]
}

export function getDriverEarnings(_id: string): DriverEarningEntry[] {
  return Array.from({ length: 7 }).map((_, i) => {
    const trips = 8 + Math.floor(Math.random() * 10)
    const gross = trips * (900 + Math.floor(Math.random() * 600))
    const commission = Math.round(gross * 0.2)
    const subscription = 1500
    return {
      date: daysAgo(6 - i).slice(0, 10),
      gross,
      commission,
      subscription,
      net: gross - commission - subscription,
      trips,
    }
  })
}

export function getDriverPayouts(_id: string): DriverPayout[] {
  return [
    { id: 'pay_01', amount: 45200, status: 'paid', requestedAt: daysAgo(3), reviewedAt: daysAgo(3), bank: 'Wema •• 4610', adminNote: null },
    { id: 'pay_02', amount: 28400, status: 'approved', requestedAt: daysAgo(2), reviewedAt: hoursAgo(20), bank: 'Wema •• 4610', adminNote: 'Verified' },
    { id: 'pay_03', amount: 12600, status: 'pending', requestedAt: hoursAgo(8), reviewedAt: null, bank: 'Wema •• 4610', adminNote: null },
    { id: 'pay_04', amount: 9800, status: 'paid', requestedAt: daysAgo(8), reviewedAt: daysAgo(7), bank: 'Wema •• 4610', adminNote: null },
  ]
}

// 🟡 BACKEND REQUIRED — PUT /admin/documents/:id/review
export async function reviewDocumentApi(
  _docId: string,
  _status: 'approved' | 'rejected',
  _note: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 500))
}

// 🟡 BACKEND REQUIRED — PUT /admin/wallet/withdrawals/:id
export async function reviewPayoutApi(
  _payoutId: string,
  _status: 'approved' | 'rejected' | 'paid',
  _note: string,
): Promise<void> {
  await new Promise((r) => setTimeout(r, 600))
}