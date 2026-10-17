import { BRAND } from '../../config/brand'
import { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
   Users2,     
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
   Banknote,        // ← new for Withdrawals
  Tag,             // ← new for Promotions
  MessageCircle,   // ← new for Complaints
} from 'lucide-react'

import { useAuth } from '../../store/AuthContext'
import { cn } from '../../lib/cn'
import { MOCK_CHANNELS } from '../../features/chat/data/mockChat'

type NavItem = {
  to: string
  label: string
  icon: typeof LayoutDashboard
  badgeKey?: 'chat'
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/riders', label: 'Riders', icon: Users },
  { to: '/drivers', label: 'Drivers', icon: Car },
  { to: '/rides', label: 'Rides', icon: Route },
  { to: '/financials', label: 'Financials', icon: Wallet },
   { to: '/withdrawals', label: 'Withdrawals', icon: Banknote },  
  { to: '/subscriptions', label: 'Subscriptions', icon: Receipt },
    { to: '/promotions', label: 'Promotions', icon: Tag },    
  { to: '/cancellations', label: 'Cancellations', icon: Ban },
    { to: '/complaints', label: 'Complaints', icon: MessageCircle }, 
  { to: '/cng-rebate', label: 'CNG Rebate', icon: Fuel },
  { to: '/sos', label: 'SOS Desk', icon: AlertTriangle },
  { to: '/chat', label: 'Team Chat', icon: MessageSquare, badgeKey: 'chat' },
  { to: '/audit', label: 'Audit Export', icon: FileDown },
  { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/team', label: 'Admin Team', icon: Users2 },   
]

type Props = {
  onNavigate?: () => void
}

export function Sidebar({ onNavigate }: Props) {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()

  // 🟡 BACKEND REQUIRED — replace with real unread count from chat store / WebSocket
  const chatUnread = useMemo(
    () => MOCK_CHANNELS.reduce((sum, c) => sum + c.unread, 0),
    [],
  )

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const handleOpenCommandPalette = () => {
    const event = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      metaKey: true,
      bubbles: true,
    })
    window.dispatchEvent(event)
  }

  const initials = user
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : 'A'

  return (
    <aside className="flex h-full w-64 flex-col bg-navy text-white">
           {/* Brand */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div
          className="w-9 h-9 rounded-lg bg-emerald flex items-center justify-center text-base font-bold"
          aria-hidden="true"
        >
          HR
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold">{BRAND.name}</span>
          <span className="text-[11px] text-white/50">{BRAND.productLabel}</span>
        </div>
      </div>

      {/* Command palette hint */}
      <button
        type="button"
        onClick={handleOpenCommandPalette}
        aria-label="Open quick search (Ctrl+K)"
        className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60 hover:bg-white/10 hover:text-white/90 transition-colors"
      >
        <Search size={12} className="flex-shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Quick search</span>
        <kbd className="rounded border border-white/20 bg-white/5 px-1 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {/* Nav */}
      <nav
        className="flex-1 overflow-y-auto py-4"
        role="navigation"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const showBadge = item.badgeKey === 'chat' && chatUnread > 0

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-6 py-3 text-sm font-medium transition-colors',
                  'hover:bg-white/5',
                  isActive
                    ? 'bg-white/10 text-white border-l-2 border-emerald'
                    : 'text-white/70 border-l-2 border-transparent',
                )
              }
            >
              <Icon size={18} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {showBadge ? (
                <span
                  className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-danger text-white text-[10px] font-bold px-1"
                  aria-label={`${chatUnread} unread messages`}
                >
                  {chatUnread}
                </span>
              ) : null}
            </NavLink>
          )
        })}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 mb-3 px-1">
          <div
            className="w-8 h-8 rounded-full bg-emerald flex items-center justify-center text-xs font-bold text-white"
            aria-hidden="true"
          >
            {initials}
          </div>
          <div className="flex flex-col leading-tight min-w-0">
            <span className="text-xs font-semibold truncate">
              {user ? `${user.firstName} ${user.lastName}` : 'Admin'}
            </span>
            <span className="text-[11px] text-white/50 truncate">
              {user?.email ?? ''}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label={`Sign out ${user?.firstName ?? 'admin'}`}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/5 hover:text-white transition-colors"
        >
          <LogOut size={18} aria-hidden="true" />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  )
}