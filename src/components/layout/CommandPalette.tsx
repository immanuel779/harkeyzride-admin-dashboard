import { useEffect, useRef } from 'react'
import { Command } from 'cmdk'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  Car,
  Route,
  Wallet,
  AlertTriangle,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
  Search,
} from 'lucide-react'

import { useAuth } from '../../store/AuthContext'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type NavEntry = {
  id: string
  label: string
  to: string
  icon: typeof LayoutDashboard
}

const NAV_ENTRIES: NavEntry[] = [
  { id: 'dashboard', label: 'Executive Overview', to: '/dashboard', icon: LayoutDashboard },
  { id: 'riders', label: 'Riders', to: '/riders', icon: Users },
  { id: 'drivers', label: 'Drivers', to: '/drivers', icon: Car },
  { id: 'rides', label: 'Rides', to: '/rides', icon: Route },
  { id: 'financials', label: 'Financials', to: '/financials', icon: Wallet },
  { id: 'sos', label: 'SOS Desk', to: '/sos', icon: AlertTriangle },
  { id: 'chat', label: 'Team Chat', to: '/chat', icon: MessageSquare },
  { id: 'audit', label: 'Audit Log', to: '/audit', icon: FileText },
  { id: 'settings', label: 'Settings', to: '/settings', icon: Settings },
]

export function CommandPalette({ open, onOpenChange }: Props) {
  const navigate = useNavigate()
  const { signOut } = useAuth()
  const inputRef = useRef<HTMLInputElement>(null)

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

  // Autofocus input when opened
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(t)
  }, [open])

  if (!open) return null

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
          shouldFilter
          loop
          className="flex flex-col max-h-[70vh] sm:max-h-[60vh]"
        >
          {/* Search row */}
          <div className="flex items-center gap-2 border-b border-border px-4 py-3 flex-shrink-0">
            <Search size={16} className="text-ink-muted flex-shrink-0" />
            <Command.Input
              ref={inputRef}
              placeholder="Search pages, actions…"
              className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-muted focus:outline-none min-w-0"
            />
            <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-mono text-ink-muted flex-shrink-0">
              ESC
            </kbd>
          </div>

          {/* Scrollable list */}
          <Command.List className="flex-1 overflow-y-auto p-2 min-h-0">
            <Command.Empty className="py-8 text-center text-sm text-ink-muted">
              No results found.
            </Command.Empty>

            <Command.Group
              heading="Navigate"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-muted"
            >
              {NAV_ENTRIES.map((entry) => {
                const Icon = entry.icon
                return (
                  <Command.Item
                    key={entry.id}
                    value={entry.label}
                    onSelect={() => go(entry.to)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink cursor-pointer data-[selected=true]:bg-emerald-light data-[selected=true]:text-emerald-dark transition-colors"
                  >
                    <Icon size={16} className="text-ink-secondary flex-shrink-0" />
                    <span className="flex-1 truncate">{entry.label}</span>
                  </Command.Item>
                )
              })}
            </Command.Group>

            <Command.Separator className="my-2 h-px bg-border" />

            <Command.Group
              heading="Account"
              className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-ink-muted"
            >
              <Command.Item
                value="Sign out"
                onSelect={handleSignOut}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-danger cursor-pointer data-[selected=true]:bg-red-50 transition-colors"
              >
                <LogOut size={16} className="flex-shrink-0" />
                <span className="flex-1">Sign out</span>
              </Command.Item>
            </Command.Group>
          </Command.List>

          {/* Footer hints — hidden on small mobile */}
          <div className="hidden sm:flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-ink-muted flex-shrink-0">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">↑</kbd>
                <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">↓</kbd>
                navigate
              </span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">↵</kbd>
                select
              </span>
            </div>
            <span className="inline-flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono">⌘K</kbd>
              to open
            </span>
          </div>
        </Command>
      </div>
    </div>
  )
}