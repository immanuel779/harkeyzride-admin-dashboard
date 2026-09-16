import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

type Props = {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-alt text-ink-muted flex items-center justify-center mb-4">
        <Icon size={24} />
      </div>
      <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>
      {description ? (
        <p className="text-xs text-ink-secondary max-w-sm mb-4">{description}</p>
      ) : null}
      {action ? <div>{action}</div> : null}
    </div>
  )
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}