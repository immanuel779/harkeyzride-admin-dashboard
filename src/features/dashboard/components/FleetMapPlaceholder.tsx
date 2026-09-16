import { MapPin, Navigation } from 'lucide-react'

export function FleetMapPlaceholder() {
  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold text-ink">Live Fleet</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            Ibadan urban command map
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald animate-pulse" />
          Live
        </div>
      </div>

      {/* Placeholder map area */}
      <div className="relative h-72 bg-gradient-to-br from-navy to-navy-light">
        {/* Fake grid lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-10"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="white"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Fake pins */}
        <div className="absolute top-1/4 left-1/3 flex items-center gap-1 text-white">
          <Navigation size={14} className="fill-emerald text-emerald" />
          <span className="text-[10px] font-medium">SR-821</span>
        </div>
        <div className="absolute top-1/2 left-2/3 flex items-center gap-1 text-white">
          <Navigation size={14} className="fill-emerald text-emerald" />
          <span className="text-[10px] font-medium">SR-204</span>
        </div>
        <div className="absolute bottom-1/3 left-1/4 flex items-center gap-1 text-white">
          <Navigation size={14} className="fill-emerald text-emerald" />
          <span className="text-[10px] font-medium">SR-455</span>
        </div>

        {/* Center marker */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="w-12 h-12 rounded-full bg-emerald/20 flex items-center justify-center">
            <div className="w-6 h-6 rounded-full bg-emerald flex items-center justify-center">
              <MapPin size={12} className="text-white" />
            </div>
          </div>
        </div>

        {/* Corner badge */}
        <div className="absolute bottom-4 right-4 rounded-lg bg-black/40 backdrop-blur px-3 py-2 text-[11px] text-white/80">
          Real map coming in Phase 5
        </div>
      </div>

      {/* Footer stats */}
      <div className="grid grid-cols-3 divide-x divide-border border-t border-border">
        <div className="px-5 py-3">
          <div className="text-xs text-ink-secondary">Active</div>
          <div className="text-lg font-bold text-ink">84</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-xs text-ink-secondary">Idle</div>
          <div className="text-lg font-bold text-ink">26</div>
        </div>
        <div className="px-5 py-3">
          <div className="text-xs text-ink-secondary">Offline</div>
          <div className="text-lg font-bold text-ink">18</div>
        </div>
      </div>
    </div>
  )
}