import {
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Wallet,
  XCircle,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { ActivityItem } from '../services/dashboard'

const TYPE_CONFIG: Record<
  ActivityItem['type'],
  { icon: LucideIcon; bg: string; color: string }
> = {
  ride_completed: {
    icon: CheckCircle2,
    bg: 'bg-emerald-light',
    color: 'text-emerald',
  },
  driver_approved: {
    icon: UserCheck,
    bg: 'bg-blue-50',
    color: 'text-info',
  },
  sos_triggered: {
    icon: AlertTriangle,
    bg: 'bg-red-50',
    color: 'text-danger',
  },
  payout: {
    icon: Wallet,
    bg: 'bg-amber-50',
    color: 'text-warning',
  },
  cancellation: {
    icon: XCircle,
    bg: 'bg-gray-100',
    color: 'text-ink-secondary',
  },
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type Props = {
  items: ActivityItem[]
  loading?: boolean
}

export function ActivityFeed({ items, loading }: Props) {
  return (
    <div className="rounded-xl bg-surface border border-border">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="text-sm font-semibold text-ink">Activity</h3>
        <span className="text-xs text-ink-muted">Live</span>
      </div>

      <div className="divide-y divide-border max-h-[420px] overflow-y-auto">
        {loading ? (
          <div className="p-5 text-center text-sm text-ink-muted">Loading…</div>
        ) : items.length === 0 ? (
          <div className="p-5 text-center text-sm text-ink-muted">
            No activity yet
          </div>
        ) : (
          items.map((item) => {
            const cfg = TYPE_CONFIG[item.type]
            const Icon = cfg.icon
            return (
              <div key={item.id} className="flex items-start gap-3 px-5 py-4">
                <div
                  className={cn(
                    'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                    cfg.bg,
                    cfg.color,
                  )}
                >
                  <Icon size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    {item.title}
                  </p>
                  <p className="text-xs text-ink-secondary mt-0.5 truncate">
                    {item.meta}
                  </p>
                </div>
                <span className="text-[11px] text-ink-muted flex-shrink-0 whitespace-nowrap">
                  {timeAgo(item.timestamp)}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}