import { useNavigate } from 'react-router-dom'

import { NotificationIcon } from './NotificationIcon'
import { cn } from '../../../lib/cn'
import { timeAgo, type AdminNotification } from '../data/mockNotifications'

type Props = {
  notification: AdminNotification
  onRead: (id: string) => void
  onClose: () => void
}

export function NotificationItem({ notification, onRead, onClose }: Props) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (!notification.isRead) onRead(notification.id)
    if (notification.linkTo) {
      navigate(notification.linkTo)
      onClose()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-border last:border-b-0',
        notification.isRead
          ? 'hover:bg-surface-alt/50'
          : notification.severity === 'critical'
            ? 'bg-red-50/40 hover:bg-red-50/60'
            : 'bg-emerald-light/20 hover:bg-emerald-light/30',
      )}
    >
      <NotificationIcon
        category={notification.category}
        severity={notification.severity}
        unread={!notification.isRead}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-0.5">
          <p
            className={cn(
              'text-xs leading-snug line-clamp-2',
              notification.isRead
                ? 'font-medium text-ink-secondary'
                : 'font-semibold text-ink',
            )}
          >
            {notification.title}
          </p>
          <span className="text-[10px] text-ink-muted whitespace-nowrap flex-shrink-0 mt-0.5 font-mono">
            {timeAgo(notification.createdAt)}
          </span>
        </div>
        <p className="text-[11px] text-ink-secondary line-clamp-2 leading-snug">
          {notification.description}
        </p>
      </div>

      {!notification.isRead ? (
        <span
          className="w-1.5 h-1.5 rounded-full bg-emerald flex-shrink-0 mt-2"
          aria-label="Unread"
        />
      ) : null}
    </button>
  )
}