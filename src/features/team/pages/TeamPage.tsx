import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Copy,
  Download,
  Eye,
  FileJson,
  History,
  Keyboard,
  Mail,
  Phone,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Timer,
  User,
  UserCheck,
  UserPlus,
  UserX,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { StatusBadge } from '../../../components/shared/StatusBadge'
import { useTeam } from '../../../hooks/queries/useTeam'
import { useAuth } from '../../../store/AuthContext'
import { toast } from '../../../lib/toast'
import type { TeamMember } from '../data/mockAdmins'

/* ==========================================================================
   CONFIG
   ========================================================================== */

const DORMANT_DAYS = 60
const STALE_DAYS = 30
const AUTO_REFRESH_MS = 60_000

const INVITE_TEMPLATE = `Hi,

You've been invited to join the HarkeyzRide Admin Console.

Once your account is provisioned, sign in at:
https://admin.harkeyzride.dev/login

Access includes:
• Fleet operations, driver approvals, and live ride monitoring
• Financial reconciliation and payout approvals
• Rider support and SOS response

Please reply with a preferred email and phone number so we can create your admin account. Access is audited — all actions are logged.

— HarkeyzRide Operations`

type TabKey =
  | 'all'
  | 'active'
  | 'inactive'
  | 'dormant'
  | 'flagged'
  | 'me'

type SortKey = 'last_active' | 'name' | 'newest' | 'oldest' | 'priority'

type AnomalySeverity = 'critical' | 'high' | 'medium' | 'low'

type Anomaly = {
  type: string
  label: string
  severity: AnomalySeverity
}

const TABS: Array<{ key: TabKey; label: string; icon: typeof User }> = [
  { key: 'all', label: 'All members', icon: User },
  { key: 'active', label: 'Active', icon: UserCheck },
  { key: 'inactive', label: 'Inactive', icon: UserX },
  { key: 'dormant', label: 'Dormant', icon: Clock },
  { key: 'flagged', label: 'Flagged', icon: AlertTriangle },
  { key: 'me', label: 'Me', icon: Shield },
]

const ANOMALY_STYLES: Record<AnomalySeverity, { bg: string; text: string }> = {
  critical: { bg: 'bg-red-100', text: 'text-danger' },
  high: { bg: 'bg-amber-100', text: 'text-amber-700' },
  medium: { bg: 'bg-sky-100', text: 'text-sky-700' },
  low: { bg: 'bg-slate-100', text: 'text-slate-700' },
}

const ANOMALY_ORDER: Record<AnomalySeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
}

const ANIMATIONS = `
  @keyframes tm-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes tm-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tm-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes tm-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes tm-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes tm-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .tm-fade-up { animation: tm-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .tm-fade-in { animation: tm-fade-in .2s ease both; }
  .tm-slide-in { animation: tm-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .tm-pop { animation: tm-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .tm-pulse { animation: tm-pulse 1.5s ease-in-out infinite; }
  .tm-shimmer { position: relative; overflow: hidden; }
  .tm-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .tm-shimmer:hover::after { animation: tm-shimmer 1s ease; }
  .tm-stagger > * { animation: tm-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .tm-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .tm-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .tm-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .tm-stagger > *:nth-child(4) { animation-delay: 180ms; }
  .tm-stagger > *:nth-child(5) { animation-delay: 240ms; }
  @media (prefers-reduced-motion: reduce) {
    .tm-fade-up, .tm-fade-in, .tm-slide-in, .tm-pop, .tm-pulse,
    .tm-stagger > *, .tm-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function initials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function timeAgo(iso: string | null) {
  if (!iso) return 'Never'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatRelative(ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, (Date.now() - t) / (60 * 60 * 1000))
}

function readField<T>(m: TeamMember, key: string): T | undefined {
  return (m as unknown as Record<string, unknown>)[key] as T | undefined
}

function getRole(member: TeamMember): string | null {
  return readField<string>(member, 'role') ?? null
}

function getStatusDot(member: TeamMember): {
  tone: 'emerald' | 'sky' | 'amber' | 'red' | 'slate'
  pulse: boolean
  label: string
} {
  if (member.status !== 'active') {
    return { tone: 'slate', pulse: false, label: 'Inactive' }
  }
  const hrs = hoursSince(member.lastLoginAt)
  if (hrs === null) {
    return { tone: 'red', pulse: false, label: 'Never logged in' }
  }
  if (hrs < 1) {
    return { tone: 'emerald', pulse: true, label: 'Online now' }
  }
  if (hrs < 24) {
    return { tone: 'emerald', pulse: false, label: 'Active today' }
  }
  if (hrs < 24 * 7) {
    return { tone: 'sky', pulse: false, label: 'Active this week' }
  }
  if (hrs < 24 * STALE_DAYS) {
    return { tone: 'amber', pulse: false, label: 'Stale (30d+)' }
  }
  return { tone: 'red', pulse: false, label: 'Dormant (60d+)' }
}

function isDormant(member: TeamMember): boolean {
  if (member.status !== 'active') return false
  const hrs = hoursSince(member.lastLoginAt)
  return hrs === null || hrs > 24 * DORMANT_DAYS
}

function computeAnomalies(
  member: TeamMember,
  all: TeamMember[],
): Anomaly[] {
  const out: Anomaly[] = []
  const hrs = hoursSince(member.lastLoginAt)

  if (member.status === 'active' && hrs === null) {
    out.push({
      type: 'never_logged_in',
      label: 'Active account but never signed in',
      severity: 'high',
    })
  }

  if (member.status === 'active' && hrs !== null && hrs > 24 * DORMANT_DAYS) {
    out.push({
      type: 'dormant',
      label: `Dormant for ${Math.floor(hrs / 24)} days`,
      severity: 'medium',
    })
  }

  if (!member.email || !member.email.includes('@')) {
    out.push({
      type: 'missing_email',
      label: 'Email missing or malformed',
      severity: 'high',
    })
  }

  if (!member.phone || member.phone.trim().length < 7) {
    out.push({
      type: 'missing_phone',
      label: 'Phone number missing',
      severity: 'medium',
    })
  }

  const sameName = all.filter(
    (o) => o.id !== member.id && o.name === member.name,
  )
  if (sameName.length > 0) {
    out.push({
      type: 'duplicate_name',
      label: `Duplicate name (${sameName.length + 1} admins share this name)`,
      severity: 'low',
    })
  }

  return out
}

function priorityScore(member: TeamMember, anomalies: Anomaly[]): number {
  let score = 0
  if (member.status === 'inactive') score += 20
  if (isDormant(member)) score += 30
  if (!member.lastLoginAt) score += 40
  anomalies.forEach((a) => {
    if (a.severity === 'critical') score += 40
    else if (a.severity === 'high') score += 20
    else if (a.severity === 'medium') score += 10
    else score += 5
  })
  return score
}

function sortMembers(
  list: TeamMember[],
  key: SortKey,
  anomaliesBy: Map<string, Anomaly[]>,
): TeamMember[] {
  const sorted = [...list]
  switch (key) {
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name))
    case 'newest':
      return sorted.sort(
        (a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt),
      )
    case 'oldest':
      return sorted.sort(
        (a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt),
      )
    case 'priority':
      return sorted.sort((a, b) => {
        const sa = priorityScore(a, anomaliesBy.get(a.id) ?? [])
        const sb = priorityScore(b, anomaliesBy.get(b.id) ?? [])
        if (sa !== sb) return sb - sa
        return a.name.localeCompare(b.name)
      })
    case 'last_active':
    default:
      return sorted.sort((a, b) => {
        const ta = a.lastLoginAt ? Date.parse(a.lastLoginAt) : 0
        const tb = b.lastLoginAt ? Date.parse(b.lastLoginAt) : 0
        return tb - ta
      })
  }
}

function escapeCSV(value: string): string {
  const needsQuote = /[",\n\r]/.test(value)
  const escaped = value.replace(/"/g, '""')
  return needsQuote ? `"${escaped}"` : escaped
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function isoFilename(ext: string): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(
    d.getDate(),
  ).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(
    d.getMinutes(),
  ).padStart(2, '0')}`
  return `team-${stamp}.${ext}`
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function TeamPage() {
  const { user } = useAuth()
  const { data: members = [], isLoading, isError, error, refetch } = useTeam()

  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [sortKey, setSortKey] = useState<SortKey>('last_active')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(Date.now())
  const [copied, setCopied] = useState<string | null>(null)
  const [showInvite, setShowInvite] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)

  const searchRef = useRef<HTMLInputElement>(null)
  const copiedTimerRef = useRef<number | null>(null)

  /* ---------------------------- derived ---------------------------- */

  const anomaliesByMember = useMemo(() => {
    const map = new Map<string, Anomaly[]>()
    for (const m of members) map.set(m.id, computeAnomalies(m, members))
    return map
  }, [members])

  const flaggedIds = useMemo(() => {
    const s = new Set<string>()
    for (const [id, list] of anomaliesByMember) {
      if (list.length > 0) s.add(id)
    }
    return s
  }, [anomaliesByMember])

  const sorted = useMemo(
    () => sortMembers(members, sortKey, anomaliesByMember),
    [members, sortKey, anomaliesByMember],
  )

  const tabFiltered = useMemo(() => {
    let list = sorted
    switch (tab) {
      case 'active':
        list = list.filter((m) => m.status === 'active')
        break
      case 'inactive':
        list = list.filter((m) => m.status !== 'active')
        break
      case 'dormant':
        list = list.filter(isDormant)
        break
      case 'flagged':
        list = list.filter((m) => flaggedIds.has(m.id))
        break
      case 'me':
        list = list.filter((m) => user?.email === m.email)
        break
      default:
        break
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.phone.includes(q),
      )
    }
    return list
  }, [sorted, tab, flaggedIds, user?.email, query])

  const counts = useMemo<Record<TabKey, number>>(() => {
    const active = members.filter((m) => m.status === 'active').length
    const inactive = members.filter((m) => m.status !== 'active').length
    const dormant = members.filter(isDormant).length
    const me = user?.email
      ? members.filter((m) => m.email === user.email).length
      : 0
    return {
      all: members.length,
      active,
      inactive,
      dormant,
      flagged: flaggedIds.size,
      me,
    }
  }, [members, flaggedIds, user?.email])

  const stats = useMemo(() => {
    const active = counts.active
    const inactive = counts.inactive
    const dormant = counts.dormant

    const recentLogins = members.filter((m) => {
      const hrs = hoursSince(m.lastLoginAt)
      return hrs !== null && hrs < 24
    }).length

    return {
      total: members.length,
      active,
      inactive,
      dormant,
      flagged: flaggedIds.size,
      recentLogins,
    }
  }, [members, counts, flaggedIds])

  const detail = useMemo(
    () => (detailId ? members.find((m) => m.id === detailId) ?? null : null),
    [members, detailId],
  )

  const detailAnomalies = useMemo(
    () => (detail ? anomaliesByMember.get(detail.id) ?? [] : []),
    [detail, anomaliesByMember],
  )

  /* ---------------------------- effects ---------------------------- */

  // Auto-refresh
  useEffect(() => {
    const id = window.setInterval(async () => {
      try {
        await refetch()
        setLastUpdated(Date.now())
      } catch {
        /* silent */
      }
    }, AUTO_REFRESH_MS)
    return () => window.clearInterval(id)
  }, [refetch])

  // Cleanup copy timer
  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === 'Escape') {
        if (showShortcuts) {
          setShowShortcuts(false)
          return
        }
        if (showInvite) {
          setShowInvite(false)
          return
        }
        if (detailId) {
          setDetailId(null)
          return
        }
        return
      }

      if (inField) return
      if (!(e.metaKey || e.ctrlKey)) return

      if (e.key.toLowerCase() === 'e') {
        e.preventDefault()
        handleExportCSV()
      } else if (e.key.toLowerCase() === 'j') {
        e.preventDefault()
        handleExportJSON()
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailId, showInvite, showShortcuts, tabFiltered, tab])

  /* ---------------------------- handlers --------------------------- */

  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await refetch()
      setLastUpdated(Date.now())
      toast.success('Refreshed')
    } finally {
      setRefreshing(false)
    }
  }, [refetch])

  const handleCopy = useCallback(
    async (value: string, key: string) => {
      try {
        await navigator.clipboard.writeText(value)
        setCopied(key)
        if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
        copiedTimerRef.current = window.setTimeout(() => setCopied(null), 1400)
      } catch {
        toast.error('Copy failed', 'Clipboard unavailable.')
      }
    },
    [],
  )

  const handleExportCSV = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No members match the current view.')
      return
    }
    const headers = [
      'id', 'name', 'email', 'phone', 'status', 'role',
      'joinedAt', 'lastLoginAt', 'anomalyCount',
    ]
    const lines = [headers.join(',')]
    for (const m of rows) {
      lines.push(
        [
          m.id,
          m.name,
          m.email,
          m.phone,
          m.status,
          getRole(m) ?? '',
          m.joinedAt,
          m.lastLoginAt ?? '',
          String(anomaliesByMember.get(m.id)?.length ?? 0),
        ]
          .map((v) => escapeCSV(String(v ?? '')))
          .join(','),
      )
    }
    downloadFile(lines.join('\n'), isoFilename('csv'), 'text/csv;charset=utf-8')
    toast.success('CSV exported', `${rows.length} member${rows.length === 1 ? '' : 's'} downloaded.`)
  }, [tabFiltered, anomaliesByMember])

  const handleExportJSON = useCallback(() => {
    const rows = tabFiltered
    if (rows.length === 0) {
      toast.error('Nothing to export', 'No members match the current view.')
      return
    }
    const payload = {
      exportedAt: new Date().toISOString(),
      count: rows.length,
      tab,
      stats,
      members: rows.map((m) => ({
        ...m,
        anomalies: anomaliesByMember.get(m.id) ?? [],
      })),
    }
    downloadFile(
      JSON.stringify(payload, null, 2),
      isoFilename('json'),
      'application/json',
    )
    toast.success('JSON exported', `${rows.length} member${rows.length === 1 ? '' : 's'} downloaded.`)
  }, [tabFiltered, tab, stats, anomaliesByMember])

  const handleCopyInviteTemplate = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INVITE_TEMPLATE)
      toast.success('Invite message copied', 'Paste it into email or Slack.')
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [])

  const handleBulkCopyEmails = useCallback(async () => {
    const emails = tabFiltered.map((m) => m.email).filter(Boolean).join(', ')
    if (!emails) {
      toast.error('Nothing to copy', 'No emails in the current view.')
      return
    }
    try {
      await navigator.clipboard.writeText(emails)
      toast.success(`${tabFiltered.length} emails copied`)
    } catch {
      toast.error('Copy failed', 'Clipboard unavailable.')
    }
  }, [tabFiltered])

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Admin Team">
      <style>{ANIMATIONS}</style>

      {/* Header banner (preserved design, minor copy polish) */}
      <div className="rounded-xl bg-navy text-white p-6 mb-6 flex items-start gap-4 tm-fade-up">
        <div className="w-12 h-12 rounded-xl bg-emerald flex items-center justify-center flex-shrink-0">
          <Shield size={22} aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold mb-1">Admin Team</h2>
          <p className="text-sm text-white/60 leading-relaxed">
            {members.length} admin accounts with full access to the operations
            console. All admin actions are recorded in the audit log.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
            <span className="inline-flex items-center gap-1 text-white/70">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald tm-pulse" />
              {stats.recentLogins} active in last 24h
            </span>
            {stats.dormant > 0 ? (
              <span className="inline-flex items-center gap-1 text-amber-300">
                <AlertTriangle size={10} />
                {stats.dormant} dormant
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 tm-stagger">
        <KpiCard
          icon={<User size={14} aria-hidden="true" />}
          tone="slate"
          label="Total"
          value={String(stats.total)}
          hint="Admin accounts"
        />
        <KpiCard
          icon={<UserCheck size={14} aria-hidden="true" />}
          tone="emerald"
          label="Active"
          value={String(stats.active)}
          hint={`${stats.recentLogins} today`}
        />
        <KpiCard
          icon={<UserX size={14} aria-hidden="true" />}
          tone="red"
          label="Inactive"
          value={String(stats.inactive)}
          hint="Suspended / disabled"
        />
        <KpiCard
          icon={<Clock size={14} aria-hidden="true" />}
          tone={stats.dormant > 0 ? 'amber' : 'slate'}
          label="Dormant"
          value={String(stats.dormant)}
          hint={`${DORMANT_DAYS}d+ no login`}
        />
        <KpiCard
          icon={<AlertTriangle size={14} aria-hidden="true" />}
          tone={stats.flagged > 0 ? 'amber' : 'slate'}
          label="Flagged"
          value={String(stats.flagged)}
          hint={stats.flagged > 0 ? 'Needs attention' : 'All clean'}
        />
      </div>

      {/* Tabs + actions */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5 tm-fade-up">
          {TABS.map(({ key, label, icon: Icon }) => {
            const active = tab === key
            const count = counts[key]
            // Hide "Me" tab if user has no matching member
            if (key === 'me' && count === 0) return null
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={active}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                  active
                    ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                    : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                ].join(' ')}
              >
                <Icon size={12} aria-hidden="true" />
                {label}
                {count > 0 ? (
                  <span
                    className={[
                      'tm-pop inline-flex items-center justify-center rounded-full px-1.5 text-[10px] font-bold min-w-[18px]',
                      active
                        ? 'bg-white/25 text-white'
                        : key === 'flagged' || key === 'dormant'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-surface-alt text-ink-muted',
                    ].join(' ')}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="hidden items-center gap-1.5 text-[11px] text-ink-muted sm:inline-flex">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald tm-pulse" aria-hidden="true" />
            Live · {formatRelative(lastUpdated)}
          </span>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors disabled:opacity-50"
          >
            <RefreshCw
              size={12}
              className={refreshing ? 'animate-spin' : undefined}
              aria-hidden="true"
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            title="Export CSV (Ctrl/Cmd + E)"
            className="tm-shimmer inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            CSV
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            title="Export JSON (Ctrl/Cmd + J)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <FileJson size={12} aria-hidden="true" />
            JSON
          </button>
        </div>
      </div>

      {/* Toolbar (preserved search input) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 flex-1 max-w-md">
          <Search size={14} className="text-ink-muted" aria-hidden="true" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search by name, email, phone…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="rounded p-0.5 text-ink-muted hover:text-ink transition-colors"
              aria-label="Clear search"
            >
              <X size={12} />
            </button>
          ) : null}
        </div>

        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          aria-label="Sort members"
          className="rounded-lg border border-border bg-surface px-2.5 py-2 text-xs text-ink focus:border-emerald focus:outline-none"
        >
          <option value="last_active">Last active</option>
          <option value="name">Name A-Z</option>
          <option value="newest">Newest joined</option>
          <option value="oldest">Oldest joined</option>
          <option value="priority">Priority</option>
        </select>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleBulkCopyEmails}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
          >
            <Mail size={13} aria-hidden="true" />
            Copy emails
          </button>
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
          >
            <UserPlus size={13} aria-hidden="true" />
            Invite admin
          </button>
        </div>
      </div>

      {/* Members list */}
      {isError ? (
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load team"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl bg-surface border border-border p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <Skeleton variant="circle" className="w-12 h-12" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-3 w-full mb-2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      ) : tabFiltered.length === 0 ? (
        <div className="rounded-xl bg-surface border border-border py-12 text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
            <Search size={20} aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-ink mb-1">
            {query || tab !== 'all' ? 'No matches' : 'No team members yet'}
          </p>
          <p className="text-xs text-ink-muted">
            {query
              ? `No team members match "${query}"`
              : tab !== 'all'
                ? 'Try a different tab or clear filters.'
                : 'Invite your first admin to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tabFiltered.map((member) => (
            <MemberCard
              key={member.id}
              member={member}
              isCurrentUser={user?.email === member.email}
              anomalies={anomaliesByMember.get(member.id) ?? []}
              onOpen={() => setDetailId(member.id)}
              copiedKey={copied}
              onCopyEmail={() => handleCopy(member.email, `email-${member.id}`)}
              onCopyPhone={() => handleCopy(member.phone, `phone-${member.id}`)}
            />
          ))}
        </div>
      )}

      {/* Detail drawer */}
      {detail ? (
        <MemberDetailDrawer
          member={detail}
          isCurrentUser={user?.email === detail.email}
          anomalies={detailAnomalies}
          copied={copied}
          onCopy={handleCopy}
          onClose={() => setDetailId(null)}
        />
      ) : null}

      {/* Invite modal */}
      {showInvite ? (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onCopyTemplate={handleCopyInviteTemplate}
        />
      ) : null}

      {/* Shortcuts modal */}
      {showShortcuts ? (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      ) : null}

      {/* Shortcut hint (bottom) */}
      <div className="mt-6 flex items-center justify-center gap-3 text-[10px] text-ink-muted">
        <button
          type="button"
          onClick={() => setShowShortcuts(true)}
          className="inline-flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 font-mono hover:border-emerald hover:text-emerald transition-colors"
        >
          <Keyboard size={10} />
          ?
        </button>
        <span>for keyboard shortcuts</span>
      </div>
    </AppShell>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

function KpiCard({
  icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  tone: 'emerald' | 'red' | 'amber' | 'sky' | 'slate'
  label: string
  value: string
  hint: string
}) {
  const toneClass: Record<typeof tone, string> = {
    emerald: 'bg-emerald-light text-emerald-dark',
    red: 'bg-red-50 text-danger',
    amber: 'bg-amber-50 text-amber-700',
    sky: 'bg-sky-50 text-sky-700',
    slate: 'bg-surface-alt text-ink-secondary',
  }
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClass[tone]}`}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            {label}
          </div>
          <div className="text-base font-bold text-ink tabular-nums truncate">
            {value}
          </div>
        </div>
      </div>
      <div className="mt-1.5 truncate text-[10px] text-ink-muted">{hint}</div>
    </div>
  )
}

function MemberCard({
  member,
  isCurrentUser,
  anomalies,
  onOpen,
  copiedKey,
  onCopyEmail,
  onCopyPhone,
}: {
  member: TeamMember
  isCurrentUser: boolean
  anomalies: Anomaly[]
  onOpen: () => void
  copiedKey: string | null
  onCopyEmail: () => void
  onCopyPhone: () => void
}) {
  const role = getRole(member)
  const dot = getStatusDot(member)
  const topAnomaly =
    anomalies.length > 0
      ? anomalies.reduce((a, b) =>
          ANOMALY_ORDER[a.severity] >= ANOMALY_ORDER[b.severity] ? a : b,
        )
      : null

  const dotClass =
    dot.tone === 'emerald'
      ? 'bg-emerald'
      : dot.tone === 'sky'
        ? 'bg-sky-500'
        : dot.tone === 'amber'
          ? 'bg-amber-500'
          : dot.tone === 'red'
            ? 'bg-red-500'
            : 'bg-slate-400'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={
        'group rounded-xl border p-5 transition-all cursor-pointer ' +
        (isCurrentUser
          ? 'border-emerald bg-emerald-light/20 ring-1 ring-emerald/20'
          : 'border-border bg-surface hover:border-emerald/40 hover:shadow-sm')
      }
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">
            {initials(member.name)}
          </div>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface ${dotClass} ${dot.pulse ? 'tm-pulse' : ''}`}
            title={dot.label}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="text-sm font-semibold text-ink truncate">
              {member.name}
            </h3>
            {isCurrentUser ? (
              <span className="text-[10px] uppercase tracking-wide font-bold text-emerald bg-emerald-light px-1.5 py-0.5 rounded">
                You
              </span>
            ) : null}
            {role ? (
              <span className="text-[9px] uppercase tracking-wide font-semibold text-ink-secondary bg-surface-alt px-1.5 py-0.5 rounded">
                {role}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge
              status={member.status === 'active' ? 'success' : 'neutral'}
            >
              {member.status}
            </StatusBadge>
            <span className="inline-flex items-center gap-1 text-[10px] text-ink-muted">
              <Clock size={10} aria-hidden="true" />
              {timeAgo(member.lastLoginAt)}
            </span>
            {topAnomaly ? (
              <span
                title={anomalies.map((a) => a.label).join(' · ')}
                className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${ANOMALY_STYLES[topAnomaly.severity].bg} ${ANOMALY_STYLES[topAnomaly.severity].text}`}
              >
                <AlertTriangle size={8} aria-hidden="true" />
                {anomalies.length}
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onOpen()
          }}
          className="shrink-0 rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-alt hover:text-ink group-hover:opacity-100 focus:opacity-100"
          aria-label="View details"
        >
          <Eye size={14} aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs">
          <Mail size={12} className="text-ink-muted flex-shrink-0" aria-hidden="true" />
          <span className="text-ink-secondary truncate flex-1">{member.email}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCopyEmail()
            }}
            className="shrink-0 rounded p-0.5 text-ink-muted hover:text-emerald transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Copy email"
          >
            {copiedKey === `email-${member.id}` ? (
              <Check size={10} className="text-emerald" aria-hidden="true" />
            ) : (
              <Copy size={10} aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <Phone size={12} className="text-ink-muted flex-shrink-0" aria-hidden="true" />
          <span className="text-ink-secondary font-mono flex-1">{member.phone}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onCopyPhone()
            }}
            className="shrink-0 rounded p-0.5 text-ink-muted hover:text-emerald transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            aria-label="Copy phone"
          >
            {copiedKey === `phone-${member.id}` ? (
              <Check size={10} className="text-emerald" aria-hidden="true" />
            ) : (
              <Copy size={10} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[10px] text-ink-muted">
        <span>Full admin access</span>
        <span>Joined {member.joinedAt}</span>
      </div>
    </div>
  )
}

function MemberDetailDrawer({
  member,
  isCurrentUser,
  anomalies,
  copied,
  onCopy,
  onClose,
}: {
  member: TeamMember
  isCurrentUser: boolean
  anomalies: Anomaly[]
  copied: string | null
  onCopy: (value: string, key: string) => Promise<void>
  onClose: () => void
}) {
  const role = getRole(member)
  const dot = getStatusDot(member)
  const hrs = hoursSince(member.lastLoginAt)

  const dotClass =
    dot.tone === 'emerald'
      ? 'bg-emerald'
      : dot.tone === 'sky'
        ? 'bg-sky-500'
        : dot.tone === 'amber'
          ? 'bg-amber-500'
          : dot.tone === 'red'
            ? 'bg-red-500'
            : 'bg-slate-400'

  return (
    <div
      className="tm-fade-in fixed inset-0 z-[10000] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Member details"
      onClick={onClose}
    >
      <div
        className="tm-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-12 h-12 rounded-full bg-navy text-white flex items-center justify-center text-sm font-bold">
                {initials(member.name)}
              </div>
              <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-surface ${dotClass} ${dot.pulse ? 'tm-pulse' : ''}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-ink truncate">
                  {member.name}
                </h2>
                {isCurrentUser ? (
                  <span className="text-[10px] uppercase tracking-wide font-bold text-emerald bg-emerald-light px-1.5 py-0.5 rounded">
                    You
                  </span>
                ) : null}
                {role ? (
                  <span className="text-[9px] uppercase tracking-wide font-semibold text-ink-secondary bg-surface-alt px-1.5 py-0.5 rounded">
                    {role}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-[11px] text-ink-muted">
                {dot.label} · {timeAgo(member.lastLoginAt)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Contact */}
          <div className="space-y-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Contact
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Mail size={13} className="text-ink-muted" aria-hidden="true" />
              <span className="text-ink flex-1 truncate">{member.email}</span>
              <button
                type="button"
                onClick={() => onCopy(member.email, 'drawer-email')}
                className="rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
                aria-label="Copy email"
              >
                {copied === 'drawer-email' ? (
                  <Check size={11} className="text-emerald" aria-hidden="true" />
                ) : (
                  <Copy size={11} aria-hidden="true" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Phone size={13} className="text-ink-muted" aria-hidden="true" />
              <span className="text-ink font-mono flex-1">{member.phone}</span>
              <button
                type="button"
                onClick={() => onCopy(member.phone, 'drawer-phone')}
                className="rounded p-0.5 text-ink-muted hover:text-emerald transition-colors"
                aria-label="Copy phone"
              >
                {copied === 'drawer-phone' ? (
                  <Check size={11} className="text-emerald" aria-hidden="true" />
                ) : (
                  <Copy size={11} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <History size={11} aria-hidden="true" />
              Timeline
            </div>
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
              <TimelineRow
                label="Joined"
                at={member.joinedAt}
                tone="info"
              />
              {member.lastLoginAt ? (
                <TimelineRow
                  label="Last active"
                  at={member.lastLoginAt}
                  tone={hrs !== null && hrs < 24 ? 'success' : 'default'}
                />
              ) : (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="text-ink font-medium">Never signed in</span>
                </div>
              )}
            </div>
          </div>

          {/* Status */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Status
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge
                status={member.status === 'active' ? 'success' : 'neutral'}
              >
                {member.status}
              </StatusBadge>
              <span className="text-[11px] text-ink-secondary">
                Full admin access
              </span>
            </div>
          </div>

          {/* Anomalies */}
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <AlertTriangle size={11} aria-hidden="true" />
              Flags
              {anomalies.length > 0 ? (
                <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-700">
                  {anomalies.length}
                </span>
              ) : null}
            </div>
            {anomalies.length === 0 ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700">
                No anomalies detected for this admin.
              </div>
            ) : (
              <div className="space-y-1">
                {anomalies.map((a) => {
                  const style = ANOMALY_STYLES[a.severity]
                  return (
                    <div
                      key={a.type}
                      className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] ${style.bg} ${style.text}`}
                    >
                      <AlertTriangle size={11} className="mt-0.5 shrink-0" aria-hidden="true" />
                      <span>{a.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Raw payload */}
          <div className="rounded-lg border border-border bg-surface-alt/50 p-3">
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Raw payload
            </div>
            <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-all text-[10px] leading-relaxed">
              {JSON.stringify(member, null, 2)}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-alt/30 px-5 py-3">
          <button
            type="button"
            onClick={() => onCopy(JSON.stringify(member, null, 2), 'drawer-full')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            {copied === 'drawer-full' ? (
              <>
                <Check size={12} className="text-emerald" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <ClipboardCopy size={12} aria-hidden="true" />
                Copy JSON
              </>
            )}
          </button>
          <span className="font-mono text-[10px] text-ink-muted">{member.id}</span>
        </div>
      </div>
    </div>
  )
}

function TimelineRow({
  label,
  at,
  tone,
}: {
  label: string
  at: string
  tone: 'info' | 'success' | 'default'
}) {
  const dot =
    tone === 'success'
      ? 'bg-emerald'
      : tone === 'info'
        ? 'bg-sky-500'
        : 'bg-slate-400'
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />
      <span className="text-ink font-medium">{label}</span>
      <span className="ml-auto text-ink-muted tabular-nums">
        {new Date(at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </span>
    </div>
  )
}

function InviteModal({
  onClose,
  onCopyTemplate,
}: {
  onClose: () => void
  onCopyTemplate: () => Promise<void>
}) {
  return (
    <div
      className="tm-fade-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="invite-title"
      onClick={onClose}
    >
      <div
        className="tm-pop w-full max-w-lg rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3
              id="invite-title"
              className="flex items-center gap-1.5 text-sm font-bold text-ink"
            >
              <UserPlus size={14} aria-hidden="true" />
              Invite an admin
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Automated invite emails are coming in Phase 8. For now, copy the
              template below and send it manually — then create the account from
              your backend admin.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-surface-alt"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="rounded-lg border border-border bg-surface-alt/40 p-3 max-h-64 overflow-y-auto">
          <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-ink-secondary font-sans">
            {INVITE_TEMPLATE}
          </pre>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="rounded-md bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-[10px] text-amber-700 flex items-start gap-1.5 max-w-[280px]">
            <Sparkles size={10} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Backend endpoint <code className="font-mono">POST /admin/admins/invite</code>{' '}
              is required to automate this.
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onCopyTemplate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
            >
              <ClipboardCopy size={12} aria-hidden="true" />
              Copy template
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: ['⌘', 'K'], label: 'Focus search' },
    { keys: ['⌘', 'E'], label: 'Export CSV' },
    { keys: ['⌘', 'J'], label: 'Export JSON' },
    { keys: ['Esc'], label: 'Close modal / drawer' },
    { keys: ['?'], label: 'Toggle this help' },
  ]
  return (
    <div
      className="tm-fade-in fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={onClose}
    >
      <div
        className="tm-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3
              id="shortcuts-title"
              className="flex items-center gap-1.5 text-sm font-bold text-ink"
            >
              <Keyboard size={14} />
              Keyboard shortcuts
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Work when focus is not in an input.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-surface-alt"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>
        <ul className="space-y-1">
          {shortcuts.map((s) => (
            <li
              key={s.label}
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-surface-alt transition-colors"
            >
              <span className="text-xs text-ink-secondary">{s.label}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="rounded border border-border bg-surface-alt px-1.5 py-0.5 font-mono text-[10px] text-ink-muted"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}