import { useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Radio, ShieldCheck } from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { EmptyState } from '../../../components/shared/EmptyState'
import { ErrorState } from '../../../components/shared/ErrorState'
import { AlertCard } from '../components/AlertCard'
import { AlertDetail } from '../components/AlertDetail'
import { useAuth } from '../../../store/AuthContext'
import { toast } from '../../../lib/toast'
import {
  useAcknowledgeSos,
  useResolveSos,
  useSosAlerts,
} from '../../../hooks/queries/useSos'
import type { SosAlert } from '../data/mockAlerts'

export function SosPage() {
  const { user } = useAuth()
  const { data: alerts = [], isLoading, isError, error, refetch } = useSosAlerts()
  const acknowledge = useAcknowledgeSos()
  const resolve = useResolveSos()

  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sortedAlerts = useMemo(() => {
    const order: Record<SosAlert['status'], number> = {
      open: 0,
      acknowledged: 1,
      resolved: 2,
    }
    return [...alerts].sort((a, b) => {
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status]
      return new Date(a.triggeredAt).getTime() - new Date(b.triggeredAt).getTime()
    })
  }, [alerts])

  const selected =
    sortedAlerts.find((a) => a.id === selectedId) ?? sortedAlerts[0] ?? null

  const openCount = alerts.filter((a) => a.status === 'open').length
  const ackCount = alerts.filter((a) => a.status === 'acknowledged').length
  const resolvedToday = alerts.filter((a) => a.status === 'resolved').length

  const handleAcknowledge = async () => {
    if (!selected) return
    try {
      await acknowledge.mutateAsync(selected.id)
      toast.info('Alert acknowledged', 'You are now handling this SOS.')
    } catch (e) {
      toast.error('Could not acknowledge', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleResolve = async (note: string) => {
    if (!selected) return
    try {
      await resolve.mutateAsync({ id: selected.id, note })
      toast.success('SOS resolved', `Note saved by ${user?.firstName ?? 'admin'}.`)
    } catch (e) {
      toast.error('Could not resolve', e instanceof Error ? e.message : 'Try again.')
    }
  }

  return (
    <AppShell title="SOS Emergency Response Desk">
      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-danger opacity-75 animate-ping" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-danger" />
            </span>
            Open
          </div>
          <div className="text-2xl font-bold text-danger">{openCount}</div>
        </div>

        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
            <AlertTriangle size={12} className="text-warning" />
            Acknowledged
          </div>
          <div className="text-2xl font-bold text-warning">{ackCount}</div>
        </div>

        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
            <CheckCircle2 size={12} className="text-emerald" />
            Resolved today
          </div>
          <div className="text-2xl font-bold text-emerald">{resolvedToday}</div>
        </div>

        <div className="rounded-xl bg-surface border border-border p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-secondary mb-1">
            <Radio size={12} className="text-info" />
            System
          </div>
          <div className="text-sm font-semibold text-emerald flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald animate-pulse" />
            Live · 30s auto-refresh
          </div>
        </div>
      </div>

      {isError ? (
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load alerts"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-semibold text-ink">Alert Queue</h3>
              <span className="text-xs text-ink-muted">{alerts.length} total</span>
            </div>

            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-surface border border-border h-32 animate-pulse"
                />
              ))
            ) : sortedAlerts.length === 0 ? (
              <div className="rounded-xl bg-surface border border-border">
                <EmptyState
                  icon={ShieldCheck}
                  title="No active alerts"
                  description="All clear. New SOS signals will appear here in real time."
                />
              </div>
            ) : (
              sortedAlerts.map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  selected={alert.id === selected?.id}
                  onClick={() => setSelectedId(alert.id)}
                />
              ))
            )}
          </div>

          <div className="lg:col-span-3">
            {selected ? (
              <AlertDetail
                alert={selected}
                onAcknowledge={handleAcknowledge}
                onResolve={handleResolve}
              />
            ) : (
              <div className="rounded-xl bg-surface border border-border">
                <EmptyState
                  icon={ShieldCheck}
                  title="Select an alert"
                  description="Choose an alert from the queue to view details and take action."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </AppShell>
  )
}