import {
  Car,
  Wallet,
  Users,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { KpiMetric } from '../services/dashboard'

const ICONS = {
  rides: Car,
  revenue: Wallet,
  drivers: Users,
  sos: AlertTriangle,
}

type Props = {
  metric: KpiMetric
}

export function KpiCard({ metric }: Props) {
  const Icon = ICONS[metric.icon]
  const DeltaIcon =
    metric.delta > 0 ? TrendingUp : metric.delta < 0 ? TrendingDown : Minus

  const deltaColor =
    metric.delta === 0
      ? 'text-ink-muted'
      : metric.positive
        ? 'text-emerald'
        : 'text-danger'

  return (
    <div className="rounded-xl bg-surface border border-border p-5 hover:border-border-strong transition-colors">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          {metric.label}
        </span>
        <div className="w-9 h-9 rounded-lg bg-emerald-light flex items-center justify-center text-emerald">
          <Icon size={18} />
        </div>
      </div>

      <div className="text-3xl font-bold text-ink tracking-tight mb-2">
        {metric.value}
      </div>

      <div className={cn('flex items-center gap-1.5 text-xs font-medium', deltaColor)}>
        <DeltaIcon size={14} />
        <span>
          {metric.delta > 0 ? '+' : ''}
          {metric.delta}%
        </span>
        <span className="text-ink-muted font-normal">{metric.deltaLabel}</span>
      </div>
    </div>
  )
}