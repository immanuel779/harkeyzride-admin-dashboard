import { cn } from '../../../lib/cn'

type Props = {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}

export function Toggle({ checked, onChange, label, description }: Props) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="w-full flex items-start justify-between gap-4 text-left p-3 rounded-lg hover:bg-surface-alt transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink">{label}</div>
        {description ? (
          <div className="text-xs text-ink-secondary mt-0.5">{description}</div>
        ) : null}
      </div>
      <div
        className={cn(
          'relative w-11 h-6 rounded-full flex-shrink-0 transition-colors',
          checked ? 'bg-emerald' : 'bg-border-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </div>
    </button>
  )
}