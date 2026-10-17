import {
  CalendarCheck,
  Car,
  CircleDot,
  Flag,
  MapPin,
  Navigation,
  Play,
  ShieldAlert,
  XCircle,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { RideEvent } from '../data/mockRides'

const EVENT_CONFIG: Record<
  RideEvent['type'],
  { icon: typeof CircleDot; bg: string; text: string; border: string }
> = {
  requested: {
    icon: CalendarCheck,
    bg: 'bg-blue-50',
    text: 'text-info',
    border: 'border-info',
  },
  driver_assigned: {
    icon: Car,
    bg: 'bg-blue-50',
    text: 'text-info',
    border: 'border-info',
  },
  driver_arriving: {
    icon: Navigation,
    bg: 'bg-blue-50',
    text: 'text-info',
    border: 'border-info',
  },
  driver_arrived: {
    icon: MapPin,
    bg: 'bg-emerald-light',
    text: 'text-emerald',
    border: 'border-emerald',
  },
  trip_started: {
    icon: Play,
    bg: 'bg-emerald-light',
    text: 'text-emerald',
    border: 'border-emerald',
  },
  trip_in_progress: {
    icon: Navigation,
    bg: 'bg-emerald-light',
    text: 'text-emerald',
    border: 'border-emerald',
  },
  trip_completed: {
    icon: Flag,
    bg: 'bg-emerald-light',
    text: 'text-emerald',
    border: 'border-emerald',
  },
  cancelled: {
    icon: XCircle,
    bg: 'bg-red-50',
    text: 'text-danger',
    border: 'border-danger',
  },
  sos_triggered: {
    icon: ShieldAlert,
    bg: 'bg-red-50',
    text: 'text-danger',
    border: 'border-danger',
  },
  sos_resolved: {
    icon: ShieldAlert,
    bg: 'bg-emerald-light',
    text: 'text-emerald',
    border: 'border-emerald',
  },
}

function timeOnly(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function relative(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

type Props = {
  events: RideEvent[]
}

export function RideTimeline({ events }: Props) {
  if (events.length === 0) {
    return (
      <div className="text-center text-sm text-ink-muted py-12">
        No events recorded.
      </div>
    )
  }

  return (
    <ol className="relative">
      {events.map((event, i) => {
        const cfg = EVENT_CONFIG[event.type]
        const Icon = cfg.icon
        const isLast = i === events.length - 1

        return (
          <li key={event.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Vertical line */}
            {!isLast ? (
              <span
                className="absolute left-[15px] top-9 bottom-0 w-px bg-border"
                aria-hidden="true"
              />
            ) : null}

            {/* Icon */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 border-2',
                cfg.bg,
                cfg.text,
                cfg.border,
              )}
            >
              <Icon size={14} aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-semibold text-ink">
                  {event.label}
                </span>
                <span className="text-[10px] text-ink-muted whitespace-nowrap flex-shrink-0">
                  {timeOnly(event.at)} · {relative(event.at)}
                </span>
              </div>
              <div className="text-xs text-ink-secondary mt-0.5">
                {event.description}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}