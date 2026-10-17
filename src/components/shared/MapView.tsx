import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import type { LatLngExpression } from 'leaflet'
import { createPinIcon, DEFAULT_ZOOM, IBADAN_CENTER } from '../../lib/leaflet'

export type MapMarker = {
  id: string
  position: [number, number]
  label?: string
  color?: string
  pulse?: boolean
  popup?: {
    title: string
    lines: Array<{ label: string; value: string }>
    badge?: { text: string; tone: 'success' | 'warning' | 'danger' | 'info' | 'neutral' }
  }
}

type Props = {
  markers?: MapMarker[]
  center?: [number, number]
  zoom?: number
  height?: string
  className?: string
}

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

const TILE_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

const BADGE_TONE: Record<string, string> = {
  success: 'background:#E6F5EC;color:#167536;',
  warning: 'background:#FEF3C7;color:#B45309;',
  danger: 'background:#FDECEC;color:#E5484D;',
  info: 'background:#E6F1FB;color:#0B7BD6;',
  neutral: 'background:#EDEFF2;color:#5B6472;',
}

export function MapView({
  markers = [],
  center = IBADAN_CENTER,
  zoom = DEFAULT_ZOOM,
  height = '400px',
  className,
}: Props) {
  return (
    <div className={className} style={{ height, width: '100%', borderRadius: 'inherit', overflow: 'hidden' }}>
      <MapContainer center={center as LatLngExpression} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILE_URL} attribution={TILE_ATTR} />
        {markers.map((m) => (
          <Marker key={m.id} position={m.position as LatLngExpression} icon={createPinIcon({ color: m.color, label: m.label, pulse: m.pulse })}>
            {m.popup ? (
              <Popup>
                <div style={{ padding: '12px 14px', minWidth: '180px' }}>
                  <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '13px', color: '#0B1E36', marginBottom: '8px' }}>{m.popup.title}</div>
                  {m.popup.badge ? (
                    <div style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '999px', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Inter, sans-serif', ...Object.fromEntries(BADGE_TONE[m.popup.badge.tone].replace(/;$/, '').split(';').map((s) => s.split(':').map((x) => x.trim()))) }}>
                      {m.popup.badge.text}
                    </div>
                  ) : null}
                  {m.popup.lines.map((line) => (
                    <div key={line.label} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontFamily: 'Inter, sans-serif', fontSize: '11px', marginTop: '4px' }}>
                      <span style={{ color: '#8A929E' }}>{line.label}</span>
                      <span style={{ color: '#0B1E36', fontWeight: 500 }}>{line.value}</span>
                    </div>
                  ))}
                </div>
              </Popup>
            ) : null}
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}