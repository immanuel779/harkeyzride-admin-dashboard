import { MapView } from '../../../components/shared/MapView'
import { useState } from 'react'
import {
  Phone,
  User,
  Car,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Send,
  MessageSquare,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { SosAlert, AlertSeverity } from '../data/mockAlerts'

const SEVERITY_CONFIG: Record<AlertSeverity, { bg: string; text: string; border: string; label: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-danger', border: 'border-red-200', label: 'CRITICAL' },
  high: { bg: 'bg-amber-50', text: 'text-warning', border: 'border-amber-200', label: 'HIGH' },
  medium: { bg: 'bg-blue-50', text: 'text-info', border: 'border-blue-200', label: 'MEDIUM' },
}

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  return `${Math.floor(minutes / 60)}h ago`
}

type Props = {
  alert: SosAlert
  onAcknowledge: () => void
  onResolve: (note: string) => void
}

export function AlertDetail({ alert, onAcknowledge, onResolve }: Props) {
  const [note, setNote] = useState('')
  const cfg = SEVERITY_CONFIG[alert.severity]
  const isOpen = alert.status === 'open'
  const isResolved = alert.status === 'resolved'

  const handleResolve = () => {
    if (!note.trim()) return
    onResolve(note.trim())
    setNote('')
  }

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      {/* Header */}
      <div className={cn('border-b p-5', cfg.border, cfg.bg)}>
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className={cn('text-xs font-bold tracking-wider mb-1', cfg.text)}>
              {cfg.label} ALERT
            </div>
            <h2 className="text-lg font-bold text-ink">
              {alert.riderName}
            </h2>
            <div className="text-xs text-ink-secondary mt-0.5">
              Ride <span className="font-mono">#{alert.rideId.replace('rd_', '')}</span> · Triggered {timeAgo(alert.triggeredAt)}
            </div>
          </div>
          {isResolved ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-light text-emerald text-xs font-semibold px-2.5 py-1">
              <CheckCircle2 size={12} /> Resolved
            </span>
          ) : alert.status === 'acknowledged' ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 text-info text-xs font-semibold px-2.5 py-1">
              <AlertCircle size={12} /> Acknowledged
            </span>
          ) : null}
        </div>
      </div>

      {/* Info grid */}
      <div className="p-5 space-y-4">
        {/* Location */}
               <div className="rounded-lg bg-surface-alt border border-border overflow-hidden">
          <div className="p-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-navy text-white flex items-center justify-center flex-shrink-0">
              <MapPin size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
                Location
              </div>
              <div className="text-sm font-medium text-ink mt-0.5">
                {alert.location}
              </div>
              <div className="text-xs text-ink-muted font-mono mt-1">
                {alert.coordinates.lat.toFixed(4)}, {alert.coordinates.lng.toFixed(4)}
              </div>
            </div>
          </div>
          <MapView
            height="200px"
            center={[alert.coordinates.lat, alert.coordinates.lng]}
            zoom={15}
            markers={[
              {
                id: alert.id,
                position: [alert.coordinates.lat, alert.coordinates.lng],
                color:
                  alert.severity === 'critical'
                    ? '#E5484D'
                    : alert.severity === 'high'
                      ? '#F5A623'
                      : '#0B7BD6',
                pulse: alert.status === 'open',
                popup: {
                  title: alert.riderName,
                  badge: {
                    text: alert.severity,
                    tone:
                      alert.severity === 'critical'
                        ? 'danger'
                        : alert.severity === 'high'
                          ? 'warning'
                          : 'info',
                  },
                  lines: [
                    { label: 'Ride', value: `#${alert.rideId.replace('rd_', '')}` },
                    { label: 'Driver', value: alert.driverName },
                  ],
                },
              },
            ]}
          />
        </div>

        {/* People */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Rider */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <User size={14} className="text-ink-muted" />
              <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
                Rider
              </span>
            </div>
            <div className="text-sm font-semibold text-ink mb-2">
              {alert.riderName}
            </div>
            <a
              href={`tel:${alert.riderPhone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald text-white text-xs font-semibold px-3 py-2 hover:bg-emerald-dark transition-colors"
            >
              <Phone size={14} />
              Call rider
            </a>
          </div>

          {/* Driver */}
          <div className="rounded-lg border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Car size={14} className="text-ink-muted" />
              <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
                Driver
              </span>
            </div>
            <div className="text-sm font-semibold text-ink mb-2">
              {alert.driverName}
            </div>
            <a
              href={`tel:${alert.driverPhone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-2 rounded-lg bg-navy text-white text-xs font-semibold px-3 py-2 hover:bg-navy-dark transition-colors"
            >
              <Phone size={14} />
              Call driver
            </a>
          </div>
        </div>

        {/* Acknowledged by */}
        {alert.acknowledgedBy ? (
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 flex items-start gap-2 text-xs">
            <CheckCircle2 size={14} className="text-info flex-shrink-0 mt-0.5" />
            <div className="text-ink-secondary">
              Acknowledged by <span className="font-semibold text-ink">{alert.acknowledgedBy}</span>
            </div>
          </div>
        ) : null}

        {/* Notes timeline */}
        {alert.notes.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare size={14} className="text-ink-muted" />
              <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">
                Notes
              </span>
            </div>
            <div className="space-y-2">
              {alert.notes.map((n, i) => (
                <div
                  key={i}
                  className="rounded-lg bg-surface-alt p-3 text-xs text-ink-secondary"
                >
                  {n}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Actions */}
        {!isResolved ? (
          <div className="pt-3 border-t border-border">
            {isOpen ? (
              <button
                type="button"
                onClick={onAcknowledge}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-warning text-white text-sm font-semibold px-4 py-3 hover:bg-warning/90 transition-colors mb-3"
              >
                <AlertCircle size={16} />
                Acknowledge & assign to me
              </button>
            ) : null}

            <div className="space-y-2">
              <label className="text-xs font-semibold text-ink-secondary uppercase tracking-wide block">
                Resolve with note
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe resolution (e.g. False alarm — rider's bag triggered SOS)"
                rows={3}
                className="w-full rounded-lg border border-border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 resize-none"
              />
              <button
                type="button"
                onClick={handleResolve}
                disabled={!note.trim()}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald text-white text-sm font-semibold px-4 py-2.5 hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send size={14} />
                Resolve alert
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-emerald-light border border-emerald/20 p-4 text-xs text-ink-secondary">
            Resolved by <span className="font-semibold text-ink">{alert.resolvedBy}</span>
          </div>
        )}
      </div>
    </div>
  )
}