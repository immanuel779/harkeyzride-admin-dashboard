import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { ActivityFeed } from '../components/ActivityFeed'
import { FleetMapPlaceholder } from '../components/FleetMapPlaceholder'
import { KpiCard } from '../components/KpiCard'
import { RidesChart } from '../components/RidesChart'
import { useDashboardOverview } from '../../../hooks/queries/useDashboard'

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch } = useDashboardOverview()

  const kpis = data?.kpis ?? []
  const activity = data?.activity ?? []
  const chart = data?.chart ?? []

  return (
    <AppShell title="Executive Overview">
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
          <FleetMapPlaceholder />
          <RidesChart data={chart} />
        </div>

        <div className="space-y-4">
          <ActivityFeed items={activity} loading={isLoading} />
        </div>
      </div>
    </AppShell>
  )
}