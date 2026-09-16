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

// 🟡 BACKEND REQUIRED — replace with GET /admin/drivers
export const MOCK_DRIVERS: Driver[] = [
  { id: 'd1', name: 'John Smith', phone: '+234 801 234 5678', email: 'john.smith@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'NR291-KJA', vehicleColor: 'Green', status: 'approved', submittedAt: '2026-09-14', nin: '23456789012', selfieUrl: null, ninDocUrl: null },
  { id: 'd2', name: 'Musa Ibrahim', phone: '+234 802 345 6789', email: 'musa.ibrahim@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'IB-457-XY', vehicleColor: 'Green', status: 'pending', submittedAt: '2026-09-14', nin: '12345678901', selfieUrl: null, ninDocUrl: null },
  { id: 'd3', name: 'Ahmed Bello', phone: '+234 803 456 7890', email: 'ahmed.bello@example.com', city: 'Ibadan', vehicle: 'TVS King', plate: 'OY-892-AB', vehicleColor: 'Yellow', status: 'approved', submittedAt: '2026-09-13', nin: '34567890123', selfieUrl: null, ninDocUrl: null },
  { id: 'd4', name: 'Kunle Adebayo', phone: '+234 804 567 8901', email: 'kunle.adebayo@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'OY-221-CD', vehicleColor: 'Green', status: 'pending', submittedAt: '2026-09-13', nin: '45678901234', selfieUrl: null, ninDocUrl: null },
  { id: 'd5', name: 'Segun Oladipo', phone: '+234 805 678 9012', email: 'segun.oladipo@example.com', city: 'Lagos', vehicle: 'TVS King', plate: 'LA-556-EF', vehicleColor: 'Yellow', status: 'rejected', submittedAt: '2026-09-12', nin: '56789012345', selfieUrl: null, ninDocUrl: null },
  { id: 'd6', name: 'Emeka Okafor', phone: '+234 806 789 0123', email: 'emeka.okafor@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'AN-334-GH', vehicleColor: 'Green', status: 'approved', submittedAt: '2026-09-12', nin: '67890123456', selfieUrl: null, ninDocUrl: null },
  { id: 'd7', name: 'Tunde Bakare', phone: '+234 807 890 1234', email: 'tunde.bakare@example.com', city: 'Ibadan', vehicle: 'Bajaj Maxima', plate: 'OY-778-IJ', vehicleColor: 'Green', status: 'pending', submittedAt: '2026-09-11', nin: '78901234567', selfieUrl: null, ninDocUrl: null },
  { id: 'd8', name: 'Femi Akinyemi', phone: '+234 808 901 2345', email: 'femi.akinyemi@example.com', city: 'Abuja', vehicle: 'TVS King', plate: 'AB-112-KL', vehicleColor: 'Yellow', status: 'approved', submittedAt: '2026-09-11', nin: '89012345678', selfieUrl: null, ninDocUrl: null },
]

// Sync lookup (used by Detail page for direct access)
export function getDriverById(id: string | undefined): Driver | null {
  if (!id) return null
  return MOCK_DRIVERS.find((d) => d.id === id) ?? null
}

// ---------- Async fetchers (used by TanStack Query) ----------

// 🟡 BACKEND REQUIRED — GET /admin/drivers
export async function fetchDrivers(): Promise<Driver[]> {
  await new Promise((r) => setTimeout(r, 500))
  return MOCK_DRIVERS
}

// 🟡 BACKEND REQUIRED — GET /admin/drivers/:id
export async function fetchDriver(id: string): Promise<Driver> {
  await new Promise((r) => setTimeout(r, 400))
  const driver = MOCK_DRIVERS.find((d) => d.id === id)
  if (!driver) throw new Error('Driver not found')
  return driver
}

// 🟡 BACKEND REQUIRED — POST /admin/drivers/:id/approve
export async function approveDriverApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  console.log('[mock api] approved driver', id)
}

// 🟡 BACKEND REQUIRED — POST /admin/drivers/:id/reject { reason }
export async function rejectDriverApi(id: string): Promise<void> {
  await new Promise((r) => setTimeout(r, 700))
  console.log('[mock api] rejected driver', id)
}