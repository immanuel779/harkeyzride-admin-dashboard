import { fetchDrivers } from '../features/drivers/data/mockDrivers'
import { fetchRiders } from '../features/riders/data/mockRiders'
import { MOCK_RIDES } from '../features/rides/data/mockRides'

export type SearchResultType = 'driver' | 'rider' | 'ride'

export type SearchResult = {
  id: string
  type: SearchResultType
  title: string
  subtitle: string
  linkTo: string
  badge: string
}

const MAX_RESULTS = 20

export async function globalSearch(rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim().toLowerCase()
  if (q.length < 2) return []

  // Fetch dynamic sources in parallel
  const [drivers, riders] = await Promise.all([fetchDrivers(), fetchRiders()])

  const results: SearchResult[] = []

  // ---------- Drivers ----------
  drivers.forEach((d) => {
    const matches =
      d.name.toLowerCase().includes(q) ||
      d.phone.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      d.plate.toLowerCase().includes(q) ||
      d.city.toLowerCase().includes(q)
    if (!matches) return

    results.push({
      id: `driver-${d.id}`,
      type: 'driver',
      title: d.name,
      subtitle: `${d.vehicle} · ${d.plate} · ${d.city}`,
      linkTo: `/drivers/${d.id}`,
      badge: d.status,
    })
  })

  // ---------- Riders ----------
  riders.forEach((r) => {
    const matches =
      r.name.toLowerCase().includes(q) ||
      r.phone.toLowerCase().includes(q) ||
      r.email.toLowerCase().includes(q) ||
      r.city.toLowerCase().includes(q)
    if (!matches) return

    results.push({
      id: `rider-${r.id}`,
      type: 'rider',
      title: r.name,
      subtitle: `${r.phone} · ${r.city} · ₦${r.walletBalance.toLocaleString()}`,
      linkTo: `/riders/${r.id}`,
      badge: r.status,
    })
  })

  // ---------- Rides ----------
  MOCK_RIDES.forEach((r) => {
    const cleanId = r.id.replace('rd_', '')
    const matches =
      cleanId.includes(q) ||
      r.rider.toLowerCase().includes(q) ||
      r.driver.toLowerCase().includes(q) ||
      r.pickup.toLowerCase().includes(q) ||
      r.destination.toLowerCase().includes(q)
    if (!matches) return

    results.push({
      id: `ride-${r.id}`,
      type: 'ride',
      title: `Ride #${cleanId}`,
      subtitle: `${r.rider} → ${r.destination}`,
      linkTo: `/rides/${r.id}`,
      badge: r.status,
    })
  })

  return results.slice(0, MAX_RESULTS)
}