import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate, useNavigation } from 'react-router-dom'
import {
  ArrowUp,
  ChevronRight,
  Clock,
  Command as CommandIcon,
  FileCheck,
  Keyboard,
  LifeBuoy,
  Plus,
  Sparkles,
  Users,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'

import { CommandPalette } from './CommandPalette'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useCommandPalette } from '../../hooks/useCommandPalette'
import { BRAND } from '../../config/brand'

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

type Props = {
  title: string
  children: ReactNode
}

type RecentPage = {
  path: string
  title: string
  at: number
}

const RECENT_KEY = 'hr.recent-pages'
const RECENT_LIMIT = 5
const SCROLL_TOP_THRESHOLD = 400
const G_TIMEOUT_MS = 1200

const G_SHORTCUTS: Record<string, string> = {
  d: '/dashboard',
  r: '/riders',
  v: '/drivers',
  k: '/documents',
  w: '/rides',
  f: '/financials',
  s: '/subscriptions',
  c: '/cancellations',
  n: '/cng-rebate',
  x: '/sos',
  a: '/audit',
  t: '/team',
  p: '/promotions',
  o: '/complaints',
  z: '/settings',
}

const SHORTCUT_LIST: Array<{ keys: string[]; path: string; label: string }> = [
  { keys: ['g', 'd'], path: '/dashboard', label: 'Dashboard' },
  { keys: ['g', 'r'], path: '/riders', label: 'Riders' },
  { keys: ['g', 'v'], path: '/drivers', label: 'Drivers' },
  { keys: ['g', 'k'], path: '/documents', label: 'Document Review' },
  { keys: ['g', 'w'], path: '/rides', label: 'Rides' },
  { keys: ['g', 'f'], path: '/financials', label: 'Financials' },
  { keys: ['g', 's'], path: '/subscriptions', label: 'Subscriptions' },
  { keys: ['g', 'c'], path: '/cancellations', label: 'Cancellations' },
  { keys: ['g', 'n'], path: '/cng-rebate', label: 'CNG Rebate' },
  { keys: ['g', 'x'], path: '/sos', label: 'SOS Desk' },
  { keys: ['g', 'a'], path: '/audit', label: 'Audit Export' },
  { keys: ['g', 't'], path: '/team', label: 'Admin Team' },
  { keys: ['g', 'p'], path: '/promotions', label: 'Promotions' },
  { keys: ['g', 'o'], path: '/complaints', label: 'Complaints' },
  { keys: ['g', 'z'], path: '/settings', label: 'Settings' },
]

const ANIMATIONS = `
  @keyframes as-fade-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes as-slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes as-slide-up { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes as-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.05); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes as-progress { 0% { transform: translateX(-100%); } 60% { transform: translateX(-15%); } 100% { transform: translateX(-5%); } }
  @keyframes as-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
  .as-fade-in { animation: as-fade-in .25s cubic-bezier(.22,1,.36,1) both; }
  .as-slide-down { animation: as-slide-down .3s cubic-bezier(.22,1,.36,1) both; }
  .as-slide-up { animation: as-slide-up .25s cubic-bezier(.22,1,.36,1) both; }
  .as-pop { animation: as-pop .3s cubic-bezier(.22,1,.36,1) both; }
  .as-progress-bar { animation: as-progress 2s cubic-bezier(.22,1,.36,1) infinite; }
  .as-pulse { animation: as-pulse 1.5s ease-in-out infinite; }
  @media (prefers-reduced-motion: reduce) {
    .as-fade-in, .as-slide-down, .as-slide-up, .as-pop, .as-progress-bar, .as-pulse { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function readRecent(): RecentPage[] {
  try {
    const raw = window.sessionStorage.getItem(RECENT_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : []
  } catch {
    return []
  }
}

function persistRecent(list: RecentPage[]): void {
  try {
    window.sessionStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_LIMIT)))
  } catch {
    /* sessionStorage unavailable */
  }
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function AppShell({ title, children }: Props) {
  /* ---------------------------- state ---------------------------- */

  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [fabOpen, setFabOpen] = useState(false)

  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  )
  const [justCameOnline, setJustCameOnline] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [gPending, setGPending] = useState(false)
  const [recent, setRecent] = useState<RecentPage[]>(() => readRecent())

  const location = useLocation()
  const navigate = useNavigate()
  const navigation = useNavigation()
  const isNavigating = navigation.state !== 'idle'

  const mainRef = useRef<HTMLElement>(null)
  const mobileDrawerRef = useRef<HTMLDivElement>(null)
  const fabRef = useRef<HTMLDivElement>(null)
  const gTimerRef = useRef<number | null>(null)

  useCommandPalette(commandOpen, setCommandOpen)

  /* ---------------------------- effects -------------------------- */

  // Focus main + scroll top on route change (preserved behavior + scroll reset)
  useEffect(() => {
    mainRef.current?.focus()
    if (mainRef.current) mainRef.current.scrollTop = 0
  }, [location.pathname])

  // Sync document title with route
  useEffect(() => {
    if (typeof document === 'undefined') return
    const brand = (BRAND as { name?: string } | undefined)?.name ?? 'Admin'
    const next = title ? `${title} · ${brand}` : brand
    if (document.title !== next) document.title = next
  }, [title])

  // Track recent pages
  useEffect(() => {
    if (!location.pathname || location.pathname === '/' || location.pathname === '/login') return
    setRecent((prev) => {
      const next = [
        { path: location.pathname, title, at: Date.now() },
        ...prev.filter((p) => p.path !== location.pathname),
      ].slice(0, RECENT_LIMIT)
      persistRecent(next)
      return next
    })
  }, [location.pathname, title])

  // Online / offline detection
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      setJustCameOnline(true)
      window.setTimeout(() => setJustCameOnline(false), 3000)
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  // Scroll-to-top visibility
  useEffect(() => {
    const el = mainRef.current
    if (!el) return
    const onScroll = () => setShowScrollTop(el.scrollTop > SCROLL_TOP_THRESHOLD)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Click outside FAB closes menu
  useEffect(() => {
    if (!fabOpen) return
    const handler = (e: MouseEvent) => {
      if (fabRef.current && !fabRef.current.contains(e.target as Node)) {
        setFabOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [fabOpen])

  // Focus trap for mobile drawer + Esc closes
  useEffect(() => {
    if (!mobileOpen || !mobileDrawerRef.current) return
    const container = mobileDrawerRef.current
    const focusables = container.querySelectorAll<HTMLElement>(
      'a, button, input, [tabindex]:not([tabindex="-1"])',
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last?.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  // Global shortcuts: g-prefix nav and ?
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      const inField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (target?.isContentEditable ?? false)
      if (inField) return
      if (e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setShortcutsOpen((v) => !v)
        return
      }

      if (gPending && e.key.length === 1) {
        const targetPath = G_SHORTCUTS[e.key.toLowerCase()]
        setGPending(false)
        if (gTimerRef.current) {
          window.clearTimeout(gTimerRef.current)
          gTimerRef.current = null
        }
        if (targetPath) {
          e.preventDefault()
          navigate(targetPath)
        }
        return
      }

      if (e.key === 'g') {
        e.preventDefault()
        setGPending(true)
        if (gTimerRef.current) window.clearTimeout(gTimerRef.current)
        gTimerRef.current = window.setTimeout(() => setGPending(false), G_TIMEOUT_MS)
      }
    }
    window.addEventListener('keydown', handler)
    return () => {
      window.removeEventListener('keydown', handler)
      if (gTimerRef.current) window.clearTimeout(gTimerRef.current)
    }
  }, [gPending, navigate])

  // Cleanup Esc: close modals before page-level handlers
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (shortcutsOpen) {
        setShortcutsOpen(false)
        e.stopPropagation()
      }
      if (commandOpen) {
        setCommandOpen(false)
        e.stopPropagation()
      }
      if (fabOpen) setFabOpen(false)
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [shortcutsOpen, commandOpen, fabOpen])

  /* --------------------------- handlers -------------------------- */

  const scrollToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const closeFab = useCallback(() => setFabOpen(false), [])

  const handleFabNav = useCallback(
    (path: string) => {
      navigate(path)
      setFabOpen(false)
    },
    [navigate],
  )

  /* ---------------------------- render --------------------------- */

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-canvas">
      <style>{ANIMATIONS}</style>

      {/* Skip to content — keyboard users only */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* -------------------- Offline banner -------------------- */}
      {!online ? (
        <div className="as-slide-down fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-amber-500 px-4 py-1.5 text-xs font-semibold text-white shadow-md">
          <WifiOff size={12} aria-hidden="true" />
          You are offline. Some actions may not work until the connection resumes.
        </div>
      ) : null}

      {/* -------------------- Back-online toast -------------------- */}
      {justCameOnline ? (
        <div className="as-slide-down fixed inset-x-0 top-0 z-[80] flex items-center justify-center gap-2 bg-emerald px-4 py-1.5 text-xs font-semibold text-white shadow-md">
          <Zap size={12} aria-hidden="true" />
          Connection restored
        </div>
      ) : null}

      {/* -------------------- Route progress bar -------------------- */}
      {isNavigating ? (
        <div
          className="fixed inset-x-0 top-0 z-[70] h-0.5 overflow-hidden bg-emerald/10"
          aria-hidden="true"
        >
          <div className="as-progress-bar h-full w-1/2 bg-emerald" />
        </div>
      ) : null}

      {/* -------------------- Shell -------------------- */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* Mobile drawer (focus-trapped) */}
        {mobileOpen ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <div
              ref={mobileDrawerRef}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </>
        ) : null}

        {/* Main column */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            title={title}
            onMenuClick={() => setMobileOpen(true)}
            onSearchClick={() => setCommandOpen(true)}
          />
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className="flex-1 overflow-y-auto p-4 md:p-6 focus:outline-none"
            aria-label={`${title} content`}
          >
            <div key={location.pathname} className="as-fade-in">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {title} loaded
      </div>

      {/* -------------------- Scroll-to-top -------------------- */}
      {showScrollTop && !fabOpen ? (
        <button
          type="button"
          onClick={scrollToTop}
          title="Scroll to top"
          aria-label="Scroll to top"
          className="as-pop fixed bottom-24 right-6 z-30 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-ink-secondary shadow-lg transition-colors hover:border-emerald hover:text-emerald"
        >
          <ArrowUp size={15} aria-hidden="true" />
        </button>
      ) : null}

      {/* -------------------- Quick actions FAB -------------------- */}
      <div ref={fabRef} className="fixed bottom-6 right-6 z-40">
        {fabOpen ? (
          <div
            role="menu"
            aria-label="Quick actions"
            className="as-slide-up mb-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/10"
          >
            <div className="p-1.5">
              <FabItem
                icon={<CommandIcon size={13} className="text-emerald" />}
                label="Command palette"
                hint="⌘K"
                onClick={() => {
                  closeFab()
                  setCommandOpen(true)
                }}
              />
              <FabItem
                icon={<Keyboard size={13} className="text-sky-500" />}
                label="Keyboard shortcuts"
                hint="?"
                onClick={() => {
                  closeFab()
                  setShortcutsOpen(true)
                }}
              />
              <FabItem
                icon={<LifeBuoy size={13} className="text-violet-500" />}
                label="Scroll to top"
                onClick={() => {
                  closeFab()
                  scrollToTop()
                }}
              />
            </div>

            {recent.length > 0 ? (
              <div className="border-t border-border">
                <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                  Recently visited
                </div>
                <div className="p-1.5">
                  {recent.slice(0, 3).map((p) => (
                    <FabItem
                      key={p.path}
                      icon={<Clock size={13} className="text-ink-muted" />}
                      label={p.title}
                      hint={p.path}
                      onClick={() => handleFabNav(p.path)}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="border-t border-border">
              <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                Jump to
              </div>
              <div className="p-1.5">
                <FabItem
                  icon={<Sparkles size={13} className="text-amber-500" />}
                  label="Document review"
                  hint="g k"
                  onClick={() => handleFabNav('/documents')}
                />
                <FabItem
                  icon={<Users size={13} className="text-emerald" />}
                  label="Riders"
                  hint="g r"
                  onClick={() => handleFabNav('/riders')}
                />
                <FabItem
                  icon={<FileCheck size={13} className="text-sky-500" />}
                  label="Audit log"
                  hint="g a"
                  onClick={() => handleFabNav('/audit')}
                />
              </div>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setFabOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={fabOpen}
          aria-label={fabOpen ? 'Close quick actions' : 'Open quick actions'}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald text-white shadow-lg shadow-emerald/30 transition-transform hover:bg-emerald-dark active:scale-95"
        >
          {fabOpen ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <Plus size={16} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* -------------------- g-prefix indicator -------------------- */}
      {gPending ? (
        <div
          role="status"
          aria-live="polite"
          className="as-pop fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-ink-secondary shadow-lg"
        >
          Press <kbd className="mx-1 rounded bg-surface-alt px-1 font-mono">d</kbd>
          <kbd className="rounded bg-surface-alt px-1 font-mono">r</kbd>
          <kbd className="rounded bg-surface-alt px-1 font-mono">k</kbd>
          … to navigate
        </div>
      ) : null}

      {/* -------------------- Command palette -------------------- */}
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />

      {/* -------------------- Shortcuts modal -------------------- */}
      {shortcutsOpen ? (
        <ShortcutsModal
          onClose={() => setShortcutsOpen(false)}
          onNavigate={(path) => {
            setShortcutsOpen(false)
            navigate(path)
          }}
        />
      ) : null}
    </div>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

function FabItem({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-secondary transition-colors hover:bg-surface-alt hover:text-ink"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {hint ? (
        <span className="shrink-0 rounded bg-surface-alt px-1 py-0.5 font-mono text-[10px] text-ink-muted">
          {hint}
        </span>
      ) : null}
    </button>
  )
}

function ShortcutsModal({
  onClose,
  onNavigate,
}: {
  onClose: () => void
  onNavigate: (path: string) => void
}) {
  return (
    <div
      className="as-fade-in fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        className="as-pop w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 id="shortcuts-title" className="text-sm font-bold text-ink">
              Keyboard shortcuts
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Navigate the admin console without leaving the keyboard.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted transition-colors hover:bg-surface-alt hover:text-ink"
            aria-label="Close shortcuts"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4">
          <div className="mb-4">
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Global
            </h3>
            <div className="space-y-1">
              <ShortcutRow keys={['⌘', 'K']} label="Open command palette" />
              <ShortcutRow keys={['?']} label="Toggle this help" />
              <ShortcutRow keys={['Esc']} label="Close any modal or drawer" />
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Navigation (press G, then)
            </h3>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {SHORTCUT_LIST.map((item) => (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => onNavigate(item.path)}
                  className="group flex items-center justify-between gap-2 rounded-md px-2 py-1 text-left transition-colors hover:bg-surface-alt"
                >
                  <span className="flex items-center gap-1.5 truncate text-xs text-ink-secondary group-hover:text-ink">
                    <ChevronRight size={11} aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {item.keys.map((k) => (
                      <kbd
                        key={k}
                        className="rounded border border-border bg-surface-alt px-1 py-0.5 font-mono text-[10px] text-ink-muted"
                      >
                        {k.toUpperCase()}
                      </kbd>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="border-t border-border bg-surface-alt/30 px-5 py-2.5 text-[11px] text-ink-muted">
          Shortcuts pause while typing inside any input, textarea, or select.
        </div>
      </div>
    </div>
  )
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1">
      <span className="text-xs text-ink-secondary">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k) => (
          <kbd
            key={k}
            className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
          >
            {k}
          </kbd>
        ))}
      </span>
    </div>
  )
}