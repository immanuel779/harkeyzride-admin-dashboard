import { AlertCircle, RotateCcw } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  title?: string
  description?: string
  icon?: LucideIcon
  onRetry?: () => void
  retryLabel?: string
  className?: string
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'We could not load this content. Try again.',
  icon: Icon = AlertCircle,
  onRetry,
  retryLabel = 'Try again',
  className,
}: Props) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center py-16 px-6',
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-red-50 text-danger flex items-center justify-center mb-4">
        <Icon size={24} />
      </div>
      <h3 className="text-sm font-semibold text-ink mb-1">{title}</h3>
      <p className="text-xs text-ink-secondary max-w-sm mb-4">{description}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald text-white text-sm font-semibold hover:bg-emerald-dark transition-colors"
        >
          <RotateCcw size={14} />
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}