import { useEffect, useMemo, useRef, useState } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  LayoutDashboard,
  Users,
  Car,
  Route,
  Wallet,
  AlertTriangle,
  MessageSquare,
  Settings,
  LogOut,
  Search,
  FileDown,
  Receipt,
  Ban,
  Fuel,
  Loader2,
  type LucideIcon,
} from 'lucide-react'

import { useAuth } from '../../store/AuthContext'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import {
  globalSearch,
  type SearchResultType,
} from '../../lib/globalSearch'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type NavEntry = {
  id: string
  label: string
  to: string
  icon: LucideIcon
}

const NAV_ENTRIES: NavEntry[] = [
  { id: 'dashboard', label: 'Executive Overview', to: '/dashboard', icon: LayoutDashboard },
  { id: 'riders', label: 'Riders', to: '/riders', icon: Users },
  { id: 'drivers', label: 'Drivers', to: '/drivers', icon: Car },
  { id: 'rides', label: 'Rides', to: '/rides', icon: Route },
  { id: 'financials', label: 'Financials', to: '/financials', icon: Wallet },
  { id: 'subscriptions', label: 'Subscriptions', to: '/subscriptions', icon: Receipt },
  { id: 'cancellations', label: 'Cancellations', to: '/cancellations', icon: Ban },
  { id: 'cng-rebate', label: 'CNG Rebate', to: '/cng-rebate', icon: Fuel },
  { id: 'sos', label: 'SOS Desk', to: '/sos', icon: AlertTriangle },
  { id: 'chat', label: 'Team Chat', to: '/chat', icon: MessageSquare },
  { id: 'audit', label: 'Audit Export', to: '/audit', icon: FileDown },
  { id: 'settings', label: 'Settings', to: '/settings', icon: Settings },
]

const RESULT_ICONS: Record<SearchResultType, LucideIcon> = {
  driver: Car,
  rider: Users,
  ride: Route,
}

const RESULT_GROUP_LABEL: Record<SearchResultType, string> = {
  driver: 'Drivers',
  rider: 'Riders',
  ride: 'Rides',
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, 200)

  const searchQuery = useQuery({
    queryKey: ['global-search', debouncedQuery],
    queryFn: () => globalSearch(debouncedQuery),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 30_000,
  })

  // Filter static nav by current query
  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return NAV_ENTRIES
    return NAV_ENTRIES.filter((e) => e.label.toLowerCase().includes(q))
  }, [query])

  // Group dynamic results by type
  const grouped = useMemo(() => {
    const all = searchQuery.data ?? []
    return {
      driver: all.filter((r) => r.type === 'driver'),
      rider: all.filter((r) => r.type === 'rider'),
      ride: all.filter((r) => r.type === 'ride'),
    }
  }, [searchQuery.data])

  const hasAnyResult =
    filteredNav.length > 0 ||
    grouped.driver.length > 0 ||
    grouped.rider.length > 0 ||
    grouped.ride.length > 0

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  const handleSignOut = async () => {
    onOpenChange(false)
    await signOut()
    navigate('/login', { replace: true })
  }

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [open])

  // Reset query when the palette closes
  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  // Autofocus input when opened
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

  const showSearchLoader =
    searchQuery.isFetching &&
    debouncedQuery.trim().length >= 2 &&
    (searchQuery.data?.length ?? 0) === 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-3 pt-[10vh] sm:pt-[20vh] pb-6"
      role="dialog"
      aria-modal="true"
      aria-label="Command menu"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative w-full max-w-lg rounded-2xl bg-surface border border-border shadow-2xl overflow-hidden">
        <Command
          shouldFilter={false}
          loop
          className="flex flex-col max-h-[70vh] sm:max-h-[60vh]"
        >
          {/* Search row */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 flex-shrink-0">
            <Search size={16} className="text-ink-muted flex-shrink-0" />
            <Command.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder="Search pages, drivers, riders, rides…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none min-w-0"
            />
            {showSearchLoader ? (
              <Loader2
                size={14}
                className="text-ink-muted animate-spin flex-shrink-0"
                aria-label="Searching"
              />
            ) : null}
            <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-mono text-ink-muted flex-shrink-0">
              ESC
            </kbd>
          </div>

          {/* Scrollable list */}
          <Command.List className="flex-1 overflow-y-auto p-2 min-h-0">
            {!hasAnyResult ? (
              <Command.Empty className="py-8 text-center text-sm text-ink-muted">
                No results found.
              </Command.Empty>
            ) : null}

            {/* Static navigation */}
            {filteredNav.length > 0 ? (
              <Command.Group
                heading={query.trim() ? 'Pages' : 'Navigate'}
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-muted"
              >
                {filteredNav.map((entry) => {
                  const Icon = entry.icon
                  return (
                    <Command.Item
                      key={entry.id}
                      value={`page-${entry.id}-${entry.label}`}
                      onSelect={() => go(entry.to)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink cursor-pointer data-[selected=true]:bg-emerald-light data-[selected=true]:text-emerald-dark transition-colors"
                    >
                      <Icon
                        size={16}
                        className="text-ink-secondary flex-shrink-0"
                        aria-hidden="true"
                      />
                      <span className="flex-1 truncate">{entry.label}</span>
                    </Command.Item>
                  )
                })}
              </Command.Group>
            ) : null}

            {/* Dynamic results — only when query >= 2 chars */}
            {(['driver', 'rider', 'ride'] as const).map((type) => {
              const items = grouped[type]
              if (items.length === 0) return null
              const Icon = RESULT_ICONS[type]

              return (
                <div key={type}>
                  {filteredNav.length > 0 ? (
                    <Command.Separator className="my-2 h-px bg-border" />
                  ) : null}
                  <Command.Group
                    heading={RESULT_GROUP_LABEL[type]}
                    className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-muted"
                  >
                    {items.map((result) => (
                      <Command.Item
                        key={result.id}
                        value={`${type}-${result.id}-${result.title}`}
                        onSelect={() => go(result.linkTo)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-ink cursor-pointer data-[selected=true]:bg-emerald-light data-[selected=true]:text-emerald-dark transition-colors"
                      >
                        <div className="w-7 h-7 rounded-md bg-surface-alt flex items-center justify-center flex-shrink-0">
                          <Icon
                            size={13}
                            className="text-ink-secondary"
                            aria-hidden="true"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-medium truncate">
                            {result.title}
                          </div>
                          <div className="text-[11px] text-ink-secondary truncate">
                            {result.subtitle}
                          </div>
                        </div>
                        <span className="text-[10px] uppercase tracking-wide text-ink-muted font-medium flex-shrink-0">
                          {result.badge.replace(/_/g, ' ')}
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                </div>
              )
            })}

            {/* Account actions */}
            <Command.Separator className="my-2 h-px bg-border" />
            <Command.Group
              heading="Account"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-muted"
            >
              <Command.Item
                value="account-sign-out"
                onSelect={handleSignOut}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-danger cursor-pointer data-[selected=true]:bg-red-50 transition-colors"
              >
                <LogOut size={16} className="flex-shrink-0" aria-hidden="true" />
                <span className="flex-1">Sign out</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer hints — hidden on mobile */}
          <div className="hidden sm:flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-ink-muted flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">
                  ↑
                </kbd>
                <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">
                  ↓
                </kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">
                  ↵
                </kbd>
                select
              </span>
            </div>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">
                ⌘K
              </kbd>
              to open
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}