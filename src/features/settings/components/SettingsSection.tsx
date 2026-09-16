import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = {
  icon: LucideIcon
  title: string
  description: string
  children: ReactNode
}

export function SettingsSection({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      <div className="flex items-start gap-4 p-5 border-b border-border bg-surface-alt/40">
        <div className="w-10 h-10 rounded-lg bg-emerald-light text-emerald flex items-center justify-center flex-shrink-0">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <p className="text-xs text-ink-secondary mt-0.5">{description}</p>
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}