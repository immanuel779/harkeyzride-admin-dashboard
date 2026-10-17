import type { LucideIcon } from 'lucide-react'

import { cn } from '../../../lib/cn'

type Props = {
  icon: LucideIcon
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
}

const TONE_STYLES = {
  default: { bg: 'bg-emerald-light', icon: 'text-emerald' },
  success: { bg: 'bg-emerald-light', icon: 'text-emerald' },
  warning: { bg: 'bg-amber-50', icon: 'text-warning' },
  danger: { bg: 'bg-red-50', icon: 'text-danger' },
}

export function SnapshotCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
}: Props) {
  const styles = TONE_STYLES[tone]

  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-secondary">
          {label}
        </span>
        <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', styles.bg, styles.icon)}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold text-ink tracking-tight mb-1">
        {value}
      </div>
      {hint ? <div className="text-xs text-ink-muted">{hint}</div> : null}
    </div>
  )
}