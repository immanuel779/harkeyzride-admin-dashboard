import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { ActivityFeed } from '../components/ActivityFeed'
import { FleetMap } from '../components/FleetMap'
import { KpiCard } from '../components/KpiCard'
import { RidesChart } from '../components/RidesChart'
import { useDashboardOverview } from '../../../hooks/queries/useDashboard'
import { useHealth } from '../../../hooks/queries/useHealth'

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardOverview()
  const health = useHealth()

  const kpis = data?.kpis ?? []
  const activity = data?.activity ?? []
  const chart = data?.chart ?? []

  return (
    <AppShell title="Executive Overview">
      {/* Backend connectivity indicator */}
      <div className="mb-4 flex items-center gap-2 text-xs">
        <span className="text-ink-secondary">Backend:</span>
        {health.isLoading ? (
          <span className="text-ink-muted">checking…</span>
        ) : health.isError ? (
          <span className="flex items-center gap-1.5 text-danger">
            <span className="w-2 h-2 rounded-full bg-danger" aria-hidden="true" />
            unreachable
          </span>
        ) : health.data?.success ? (
          <span className="flex items-center gap-1.5 text-emerald">
            <span
              className="w-2 h-2 rounded-full bg-emerald animate-pulse"
              aria-hidden="true"
            />
            live · {health.data.database}
          </span>
        ) : (
          <span className="text-ink-muted">unknown</span>
        )}
        {health.isError ? (
          <button
            type="button"
            onClick={() => health.refetch()}
            className="ml-2 text-emerald hover:underline"
          >
            retry
          </button>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded-xl bg-surface border border-border mb-6">
          <ErrorState
            title="Could not load dashboard"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl bg-surface border border-border p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="w-9 h-9" />
                </div>
                <Skeleton className="h-8 w-28 mb-3" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          : kpis.map((metric) => <KpiCard key={metric.id} metric={metric} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 space-y-4">
          <FleetMap />
          <RidesChart data={chart} />
        </div>

        <div className="space-y-4">
          <ActivityFeed items={activity} loading={isLoading} />
        </div>
      </div>
    </AppShell>
  )
}