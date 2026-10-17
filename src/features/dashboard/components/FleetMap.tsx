import { Radio } from 'lucide-react'

import { MapView } from '../../../components/shared/MapView'
import { MOCK_FLEET, fleetToMarkers } from '../data/mockFleet'

export function FleetMap() {
  const active = MOCK_FLEET.filter(
    (d) => d.status === 'on_trip' || d.status === 'active',
  ).length
  const onTrip = MOCK_FLEET.filter((d) => d.status === 'on_trip').length
  const idle = MOCK_FLEET.filter((d) => d.status === 'idle').length

  const markers = fleetToMarkers(MOCK_FLEET)

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-ink">Live Fleet</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            Ibadan urban command map · {MOCK_FLEET.length} drivers
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald font-medium">
          <Radio size={12} />
          <span>Live</span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
        </div>
      </div>

      {/* Map */}
      <MapView markers={markers} height="320px" />

      {/* Footer stats */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-5 py-3">
          <div className="text-xs text-ink-secondary">On trip</div>
          <div className="text-lg font-bold text-ink">{onTrip}</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-xs text-ink-secondary">Available</div>
          <div className="text-lg font-bold text-ink">{active - onTrip}</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-xs text-ink-secondary">Idle</div>
          <div className="text-lg font-bold text-ink">{idle}</div>
        </div>
      </div>
    </div>
  )
}