import type { LucideIcon } from 'lucide-react'

import { cn } from '../../lib/cn'

export type TabItem<T extends string = string> = {
  id: T
  label: string
  icon?: LucideIcon
  badge?: number | string
}

type Props<T extends string> = {
  tabs: TabItem<T>[]
  value: T
  onChange: (value: T) => void
}

export function Tabs<T extends string>({ tabs, value, onChange }: Props<T>) {
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-1 overflow-x-auto -mb-px">
        {tabs.map((tab) => {
          const isActive = tab.id === value
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                'inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors',
                isActive
                  ? 'border-emerald text-emerald'
                  : 'border-transparent text-ink-secondary hover:text-ink',
              )}
            >
              {Icon ? <Icon size={14} aria-hidden="true" /> : null}
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== 0 ? (
                <span
                  className={cn(
                    'inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1',
                    isActive
                      ? 'bg-emerald-light text-emerald'
                      : 'bg-surface-alt text-ink-secondary',
                  )}
                >
                  {tab.badge}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}