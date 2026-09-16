import { cn } from '../../lib/cn'

type Status = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const CONFIG: Record<Status, string> = {
  success: 'bg-emerald-light text-emerald-dark border-emerald/20',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-red-50 text-danger border-red-200',
  info: 'bg-blue-50 text-info border-blue-200',
  neutral: 'bg-surface-alt text-ink-secondary border-border',
}

type Props = {
  status: Status
  children: string
  className?: string
}

export function StatusBadge({ status, children, className }: Props) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap',
        CONFIG[status],
        className,
      )}
    >
      {children}
    </span>
  )
}