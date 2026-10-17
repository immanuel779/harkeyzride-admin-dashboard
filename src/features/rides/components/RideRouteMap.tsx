import { MapView, type MapMarker } from '../../../components/shared/MapView'
import type { RideCoordinates } from '../data/mockRides'

type Props = {
  coords: RideCoordinates
  height?: string
}

export function RideRouteMap({ coords, height = '280px' }: Props) {
  const markers: MapMarker[] = [
    {
      id: 'pickup',
      position: [coords.pickup.lat, coords.pickup.lng],
      color: '#1E9A46',
      label: 'P',
      popup: {
        title: 'Pickup',
        badge: { text: 'Start', tone: 'success' },
        lines: [
          {
            label: 'Coordinates',
            value: `${coords.pickup.lat.toFixed(4)}, ${coords.pickup.lng.toFixed(4)}`,
          },
        ],
      },
    },
    {
      id: 'destination',
      position: [coords.destination.lat, coords.destination.lng],
      color: '#0B1E36',
      label: 'D',
      popup: {
        title: 'Destination',
        badge: { text: 'End', tone: 'info' },
        lines: [
          {
            label: 'Coordinates',
            value: `${coords.destination.lat.toFixed(4)}, ${coords.destination.lng.toFixed(4)}`,
          },
        ],
      },
    },
  ]

  if (coords.driverStart) {
    markers.push({
      id: 'driver_start',
      position: [coords.driverStart.lat, coords.driverStart.lng],
      color: '#0B7BD6',
      label: 'DS',
      popup: {
        title: 'Driver start',
        badge: { text: 'Assigned', tone: 'info' },
        lines: [
          {
            label: 'Coordinates',
            value: `${coords.driverStart.lat.toFixed(4)}, ${coords.driverStart.lng.toFixed(4)}`,
          },
        ],
      },
    })
  }

  // Center map on midpoint between pickup & destination
  const center: [number, number] = [
    (coords.pickup.lat + coords.destination.lat) / 2,
    (coords.pickup.lng + coords.destination.lng) / 2,
  ]

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <MapView markers={markers} center={center} zoom={15} height={height} />
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">
            Pickup
          </div>
          <div className="text-[11px] text-ink-secondary font-mono mt-0.5">
            {coords.pickup.lat.toFixed(3)}, {coords.pickup.lng.toFixed(3)}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">
            Destination
          </div>
          <div className="text-[11px] text-ink-secondary font-mono mt-0.5">
            {coords.destination.lat.toFixed(3)},{' '}
            {coords.destination.lng.toFixed(3)}
          </div>
        </div>
        <div className="px-3 py-2">
          <div className="text-[10px] uppercase tracking-wide text-ink-muted">
            Markers
          </div>
          <div className="text-[11px] text-ink-secondary mt-0.5">
            {markers.length} pins
          </div>
        </div>
      </div>
    </div>
  )
}