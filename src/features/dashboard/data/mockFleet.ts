import type { MapMarker } from '../../../components/shared/MapView'

export type FleetDriver = {
  id: string
  name: string
  plate: string
  status: 'active' | 'idle' | 'on_trip'
  position: [number, number]
  vehicle: string
  lastRideAt: string
  todayEarnings: number
}

// 🟡 BACKEND REQUIRED — GET /admin/fleet/live
// Real: WebSocket 'fleet:location_update' every 5-10s per driver
export const MOCK_FLEET: FleetDriver[] = [
  { id: 'f1', name: 'John Smith', plate: 'NR291-KJA', status: 'on_trip', position: [7.418, 3.9024], vehicle: 'Bajaj Maxima', lastRideAt: '3m ago', todayEarnings: 8400 },
  { id: 'f2', name: 'Musa Ibrahim', plate: 'IB-457-XY', status: 'on_trip', position: [7.352, 3.8725], vehicle: 'Bajaj Maxima', lastRideAt: '5m ago', todayEarnings: 6200 },
  { id: 'f3', name: 'Ahmed Bello', plate: 'OY-892-AB', status: 'idle', position: [7.4422, 3.8996], vehicle: 'TVS King', lastRideAt: '12m ago', todayEarnings: 4800 },
  { id: 'f4', name: 'Kunle Adebayo', plate: 'OY-221-CD', status: 'active', position: [7.3866, 3.8797], vehicle: 'Bajaj Maxima', lastRideAt: '1m ago', todayEarnings: 7100 },
  { id: 'f5', name: 'Emeka Okafor', plate: 'AN-334-GH', status: 'on_trip', position: [7.3625, 3.9784], vehicle: 'Bajaj Maxima', lastRideAt: '8m ago', todayEarnings: 5600 },
  { id: 'f6', name: 'Femi Akinyemi', plate: 'AB-112-KL', status: 'idle', position: [7.4108, 3.9205], vehicle: 'TVS King', lastRideAt: '22m ago', todayEarnings: 3900 },
  { id: 'f7', name: 'Segun Oladipo', plate: 'LA-556-EF', status: 'active', position: [7.3930, 3.9450], vehicle: 'Bajaj Maxima', lastRideAt: '2m ago', todayEarnings: 6800 },
  { id: 'f8', name: 'Tunde Bakare', plate: 'OY-778-IJ', status: 'on_trip', position: [7.4205, 3.8865], vehicle: 'Bajaj Maxima', lastRideAt: '4m ago', todayEarnings: 5200 },
]

const STATUS_COLOR: Record<FleetDriver['status'], string> = {
  on_trip: '#1E9A46',   // emerald
  idle: '#F5A623',      // warning
  active: '#0B7BD6',    // info
}

export function fleetToMarkers(fleet: FleetDriver[]): MapMarker[] {
  return fleet.map((driver) => ({
    id: driver.id,
    position: driver.position,
    color: STATUS_COLOR[driver.status],
    label: driver.name
      .split(' ')
      .map((n) => n[0])
      .join(''),
    pulse: driver.status === 'on_trip',
    popup: {
      title: driver.name,
      badge: {
        text:
          driver.status === 'on_trip'
            ? 'On trip'
            : driver.status === 'idle'
              ? 'Idle'
              : 'Active',
        tone:
          driver.status === 'on_trip'
            ? 'success'
            : driver.status === 'idle'
              ? 'warning'
              : 'info',
      },
      lines: [
        { label: 'Vehicle', value: driver.vehicle },
        { label: 'Plate', value: driver.plate },
        { label: 'Last activity', value: driver.lastRideAt },
        { label: 'Earnings today', value: `₦${driver.todayEarnings.toLocaleString()}` },
      ],
    },
  }))
}