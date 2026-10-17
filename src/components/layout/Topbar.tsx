import { useState } from 'react'
import { Menu, Bell, Search } from 'lucide-react'

import { NotificationsPanel } from '../../features/notifications/components/NotificationsPanel'
import { useNotifications } from '../../hooks/queries/useNotifications'
import { useAuth } from '../../store/AuthContext'

type Props = {
  onMenuClick: () => void
  onSearchClick: () => void
  title: string
}

export function Topbar({ onMenuClick, onSearchClick, title }: Props) {
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { data: notifications = [] } = useNotifications()
  const { user } = useAuth()

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const userInitials = user
    ? `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() ||
      'A'
    : 'A'

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Admin'

  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 md:px-6">
      {/* Mobile menu */}
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-alt transition-colors"
        aria-label="Open navigation menu"
      >
        <Menu size={20} aria-hidden="true" />
      </button>

      {/* Page title */}
      <h1 className="text-lg font-semibold text-ink">{title}</h1>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2 md:gap-4">
        {/* Search — opens command palette */}
        <button
          type="button"
          onClick={onSearchClick}
          className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 w-72 text-left hover:border-border-strong transition-colors group"
          aria-label="Open command palette to search pages and actions"
        >
          <Search
            size={16}
            className="text-ink-muted group-hover:text-ink transition-colors"
            aria-hidden="true"
          />
          <span className="flex-1 text-sm text-ink-muted group-hover:text-ink-secondary transition-colors">
            Search or jump to…
          </span>
          <kbd
            className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-mono text-ink-muted"
            aria-hidden="true"
          >
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNotificationsOpen((v) => !v)}
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : 'Notifications'
            }
            aria-expanded={notificationsOpen}
            className="relative p-2 rounded-lg hover:bg-surface-alt transition-colors"
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 ? (
              <span
                className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-danger text-white text-[9px] font-bold flex items-center justify-center px-1"
                aria-hidden="true"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            ) : null}
          </button>

          <NotificationsPanel
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        </div>

        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-sm font-semibold"
          aria-label={`Signed in as ${fullName}`}
          title={user ? `${fullName} · ${user.email}` : 'Admin'}
          role="img"
        >
          {userInitials}
        </div>
      </div>
    </header>
  )
}