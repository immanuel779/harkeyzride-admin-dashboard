import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, Check, Inbox, Search } from 'lucide-react'

import { NotificationItem } from './NotificationItem'
import { cn } from '../../../lib/cn'
import { Skeleton } from '../../../components/shared/Skeleton'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from '../../../hooks/queries/useNotifications'
import type {
  AdminNotification,
  NotificationCategory,
} from '../data/mockNotifications'

type Filter = 'all' | NotificationCategory

const CATEGORIES: Array<{ value: Filter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'safety', label: 'Safety' },
  { value: 'rides', label: 'Rides' },
  { value: 'drivers', label: 'Drivers' },
  { value: 'riders', label: 'Riders' },
  { value: 'system', label: 'System' },
]

type Props = {
  open: boolean
  onClose: () => void
}

function groupByDay(items: AdminNotification[]) {
  const groups = new Map<string, AdminNotification[]>()
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const n of items) {
    const d = new Date(n.createdAt)
    let key: string
    if (d >= today) key = 'Today'
    else if (d >= yesterday) key = 'Yesterday'
    else key = 'Earlier'

    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(n)
  }

  const order = ['Today', 'Yesterday', 'Earlier']
  return order
    .filter((k) => groups.has(k))
    .map((title) => ({ title, items: groups.get(title)! }))
}

export function NotificationsPanel({ open, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notifications.filter((n) => {
      if (filter !== 'all' && n.category !== filter) return false
      if (!q) return true
      return (
        n.title.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q)
      )
    })
  }, [notifications, filter, query])

  const grouped = useMemo(() => groupByDay(filtered), [filtered])

  // Category counts
  const categoryCount: Record<Filter, number> = useMemo(() => {
    const counts: Record<string, number> = { all: 0 }
    for (const n of notifications) {
      counts.all = (counts.all ?? 0) + 1
      counts[n.category] = (counts[n.category] ?? 0) + 1
    }
    return counts as Record<Filter, number>
  }, [notifications])

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onClick)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Notifications"
      className="absolute right-0 top-full mt-2 w-[420px] max-w-[calc(100vw-2rem)] rounded-xl bg-surface border border-border shadow-2xl overflow-hidden z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell size={14} className="text-ink-secondary" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">Notifications</h3>
          {unreadCount > 0 ? (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-danger text-white text-[10px] font-bold px-1.5">
              {unreadCount}
            </span>
          ) : null}
        </div>

        {unreadCount > 0 ? (
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald hover:text-emerald-dark transition-colors disabled:opacity-40"
          >
            <Check size={12} aria-hidden="true" />
            Mark all read
          </button>
        ) : null}
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2">
          <Search size={13} className="text-ink-muted" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search notifications…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="px-3 pt-2 pb-2 flex items-center gap-1 overflow-x-auto border-b border-border">
        {CATEGORIES.map((c) => {
          const active = filter === c.value
          const count = categoryCount[c.value] ?? 0
          if (count === 0 && c.value !== 'all') return null
          return (
            <button
              key={c.value}
              type="button"
              onClick={() => setFilter(c.value)}
              className={cn(
                'whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors',
                active
                  ? 'bg-emerald-light text-emerald-dark'
                  : 'text-ink-secondary hover:text-ink',
              )}
            >
              {c.label}
              {count > 0 ? (
                <span className="ml-1 text-[10px] opacity-70">{count}</span>
              ) : null}
            </button>
          )
        })}
      </div>

      {/* List */}
      <div className="max-h-[520px] overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="w-9 h-9 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-surface-alt text-ink-muted flex items-center justify-center mb-3">
              <Inbox size={20} aria-hidden="true" />
            </div>
            <p className="text-xs font-medium text-ink">
              {query
                ? 'No matching notifications'
                : filter === 'all'
                  ? 'All caught up'
                  : `No ${filter} notifications`}
            </p>
            <p className="text-[11px] text-ink-secondary mt-1">
              {query ? 'Try a different search term.' : 'New activity will appear here.'}
            </p>
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.title}>
              <div className="sticky top-0 z-10 px-4 py-1.5 bg-surface-alt/95 backdrop-blur-sm border-b border-border">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">
                  {group.title}
                </span>
              </div>
              {group.items.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onRead={(id) => markRead.mutate(id)}
                  onClose={onClose}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border bg-surface-alt/40 flex items-center justify-between">
        <span className="text-[10px] text-ink-muted">
          {notifications.length} total · auto-refresh 20s
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-[10px] font-medium text-ink-secondary hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  )
}