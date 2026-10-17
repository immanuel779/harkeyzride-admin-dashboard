import {
  AlertTriangle,
  Car,
  Shield,
  Users,
  FileText,
  Radio,
  type LucideIcon,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import type {
  NotificationCategory,
  NotificationSeverity,
} from '../data/mockNotifications'

const CATEGORY_ICON: Record<NotificationCategory, LucideIcon> = {
  safety: AlertTriangle,
  rides: Car,
  drivers: Shield,
  riders: Users,
  finance: FileText,
  system: Radio,
}

const SEVERITY_STYLE: Record<NotificationSeverity, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-50', text: 'text-danger' },
  high: { bg: 'bg-amber-50', text: 'text-warning' },
  normal: { bg: 'bg-blue-50', text: 'text-info' },
  low: { bg: 'bg-surface-alt', text: 'text-ink-secondary' },
}

type Props = {
  category: NotificationCategory
  severity: NotificationSeverity
  unread?: boolean
}

export function NotificationIcon({ category, severity, unread }: Props) {
  const Icon = CATEGORY_ICON[category]
  const style = SEVERITY_STYLE[severity]

  return (
    <div
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 relative',
        style.bg,
        style.text,
      )}
    >
      <Icon size={15} aria-hidden="true" />
      {unread && severity === 'critical' ? (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-danger animate-pulse"
          aria-hidden="true"
        />
      ) : null}
    </div>
  )
}