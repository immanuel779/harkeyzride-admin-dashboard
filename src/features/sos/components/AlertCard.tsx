import { AlertTriangle, Clock } from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { SosAlert, AlertSeverity } from '../data/mockAlerts'

const SEVERITY_CONFIG: Record<AlertSeverity, { label: string; bg: string; text: string; border: string }> = {
  critical: {
    label: 'CRITICAL',
    bg: 'bg-red-50',
    text: 'text-danger',
    border: 'border-danger',
  },
  high: {
    label: 'HIGH',
    bg: 'bg-amber-50',
    text: 'text-warning',
    border: 'border-warning',
  },
  medium: {
    label: 'MEDIUM',
    bg: 'bg-blue-50',
    text: 'text-info',
    border: 'border-info',
  },
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h`
}

type Props = {
  alert: SosAlert
  selected: boolean
  onClick: () => void
}

export function AlertCard({ alert, selected, onClick }: Props) {
  const cfg = SEVERITY_CONFIG[alert.severity]
  const isOpen = alert.status === 'open'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-left rounded-lg border bg-surface p-3 transition-all hover:border-border-strong',
        selected ? 'border-emerald ring-2 ring-emerald/20' : 'border-border',
        isOpen && alert.severity === 'critical' ? 'shadow-sm' : '',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wider',
            cfg.bg,
            cfg.text,
          )}
        >
          {isOpen && alert.severity === 'critical' ? (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-danger" />
            </span>
          ) : (
            <AlertTriangle size={10} />
          )}
          {cfg.label}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted font-medium">
          <Clock size={11} /> {timeAgo(alert.triggeredAt)}
        </span>
      </div>

      <div className="text-sm font-semibold text-ink truncate">
        {alert.riderName}
      </div>
      <div className="text-xs text-ink-secondary truncate mb-2">
        {alert.location}
      </div>

      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink-muted font-mono">#{alert.rideId.replace('rd_', '')}</span>
        {alert.status === 'acknowledged' ? (
          <span className="text-emerald font-medium">Acknowledged</span>
        ) : alert.status === 'resolved' ? (
          <span className="text-ink-muted font-medium">Resolved</span>
        ) : (
          <span className="text-danger font-semibold">Awaiting response</span>
        )}
      </div>
    </button>
  )
}