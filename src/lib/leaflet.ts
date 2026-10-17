import L from 'leaflet'

// Fix default marker icon paths (Webpack/Vite bundle issue)
// We override this anyway with custom divIcons below, but this covers
// cases where Leaflet's default marker is used.

// SwitchRide hub — Ibadan
export const IBADAN_CENTER: [number, number] = [7.3775, 3.9470]
export const DEFAULT_ZOOM = 12

// Custom marker icons using Tailwind-friendly HTML
export function createPinIcon(options: {
  color?: string
  label?: string
  pulse?: boolean
}) {
  const color = options.color ?? '#1E9A46'
  const pulse = options.pulse ?? false

  const html = `
    <div style="position: relative; display: inline-flex; align-items: center; justify-content: center;">
      ${
        pulse
          ? `<span style="
              position: absolute;
              width: 40px;
              height: 40px;
              border-radius: 50%;
              background: ${color};
              opacity: 0.35;
              animation: sr-pulse 1.8s ease-out infinite;
            "></span>`
          : ''
      }
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${color};
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(11,30,54,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 10px;
        font-weight: 700;
        font-family: Inter, system-ui, sans-serif;
        position: relative;
        z-index: 2;
      ">${options.label ?? ''}</div>
    </div>
  `

  return L.divIcon({
    html,
    className: 'sr-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  })
}

// Inject the pulse keyframes into the document once
if (typeof document !== 'undefined') {
  const styleId = 'sr-map-styles'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.innerHTML = `
      @keyframes sr-pulse {
        0% { transform: scale(0.6); opacity: 0.55; }
        100% { transform: scale(1.8); opacity: 0; }
      }
      .sr-marker { background: transparent !important; border: none !important; }
      .leaflet-popup-content-wrapper {
        border-radius: 12px;
        padding: 0;
        box-shadow: 0 8px 24px rgba(11,30,54,0.12);
      }
      .leaflet-popup-content { margin: 0; }
      .leaflet-popup-tip { box-shadow: 0 2px 8px rgba(11,30,54,0.12); }
    `
    document.head.appendChild(style)
  }
}