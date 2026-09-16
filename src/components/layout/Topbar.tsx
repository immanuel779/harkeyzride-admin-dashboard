import { Menu, Bell, Search } from 'lucide-react'

type Props = {
  onMenuClick: () => void
  onSearchClick: () => void
  title: string
}

export function Topbar({ onMenuClick, onSearchClick, title }: Props) {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

  return (
    <header className="flex h-16 items-center gap-4 border-b border-border bg-surface px-4 md:px-6">
      {/* Mobile menu */}
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-alt transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
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
          aria-label="Open command palette"
        >
          <Search size={16} className="text-ink-muted group-hover:text-ink transition-colors" />
          <span className="flex-1 text-sm text-ink-muted group-hover:text-ink-secondary transition-colors">
            Search or jump to…
          </span>
          <kbd className="rounded border border-border bg-surface-alt px-1.5 py-0.5 text-[10px] font-mono text-ink-muted">
            {isMac ? '⌘K' : 'Ctrl K'}
          </kbd>
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative p-2 rounded-lg hover:bg-surface-alt transition-colors"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger" />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-navy text-white flex items-center justify-center text-sm font-semibold">
          A
        </div>
      </div>
    </header>
  )
}