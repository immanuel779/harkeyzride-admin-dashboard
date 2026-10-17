import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertTriangle,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Filter,
  FilterX,
  Loader2,
  Search,
  Sparkles,
  X,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import {
  type AuditAction,
  type AuditModule,
} from '../data/mockAuditLog'

/* ==========================================================================
   CONSTANTS (original MODULES / ACTIONS preserved)
   ========================================================================== */

const MODULES: Array<{ value: AuditModule | 'all'; label: string }> = [
  { value: 'all', label: 'All modules' },
  { value: 'drivers', label: 'Drivers' },
  { value: 'riders', label: 'Riders' },
  { value: 'rides', label: 'Rides' },
  { value: 'financials', label: 'Financials' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'cancellations', label: 'Cancellations' },
  { value: 'cng', label: 'CNG' },
  { value: 'sos', label: 'SOS' },
  { value: 'chat', label: 'Chat' },
  { value: 'settings', label: 'Settings' },
  { value: 'auth', label: 'Auth' },
]

const ACTIONS: Array<{ value: AuditAction | 'all'; label: string }> = [
  { value: 'all', label: 'All actions' },
  { value: 'approve', label: 'Approve' },
  { value: 'reject', label: 'Reject' },
  { value: 'suspend', label: 'Suspend' },
  { value: 'reinstate', label: 'Reinstate' },
  { value: 'waive', label: 'Waive' },
  { value: 'resolve', label: 'Resolve' },
  { value: 'export', label: 'Export' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
]

export type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info'

const SEVERITIES: Array<{ value: Severity; label: string; dot: string }> = [
  { value: 'critical', label: 'Critical', dot: 'bg-red-500' },
  { value: 'high', label: 'High', dot: 'bg-orange-500' },
  { value: 'medium', label: 'Medium', dot: 'bg-amber-500' },
  { value: 'low', label: 'Low', dot: 'bg-sky-500' },
  { value: 'info', label: 'Info', dot: 'bg-slate-400' },
]

const inputClass =
  'w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20'

const ANIMATIONS = `
  @keyframes fp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes fp-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes fp-pop { 0% { transform: scale(.8); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
  .fp-fade-in { animation: fp-fade-in .2s ease both; }
  .fp-fade-up { animation: fp-fade-up .25s cubic-bezier(.22,1,.36,1) both; }
  .fp-pop { animation: fp-pop .3s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .fp-fade-in, .fp-fade-up, .fp-pop { animation: none !important; }
  }
`

/* ==========================================================================
   DATE PRESET HELPERS
   ========================================================================== */

type DatePreset = {
  key: string
  label: string
  compute: () => { from: string; to: string }
}

const toISODate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const todayISO = (): string => toISODate(new Date())

const minusDaysISO = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toISODate(d)
}

const DATE_PRESETS: DatePreset[] = [
  { key: 'today',  label: 'Today',    compute: () => ({ from: todayISO(), to: todayISO() }) },
  { key: '7d',     label: '7d',       compute: () => ({ from: minusDaysISO(6), to: todayISO() }) },
  { key: '30d',    label: '30d',      compute: () => ({ from: minusDaysISO(29), to: todayISO() }) },
  { key: '90d',    label: '90d',      compute: () => ({ from: minusDaysISO(89), to: todayISO() }) },
  { key: 'ytd',    label: 'YTD',      compute: () => ({ from: `${new Date().getFullYear()}-01-01`, to: todayISO() }) },
  { key: 'all',    label: 'All time', compute: () => ({ from: '', to: '' }) },
]

/* ==========================================================================
   PROPS
   ========================================================================== */

type Props = {
  /* ---------- Original (unchanged contract) ---------- */
  from: string
  to: string
  module: AuditModule | 'all'
  action: AuditAction | 'all'
  adminId: string
  admins: { id: string; name: string }[]
  onFromChange: (v: string) => void
  onToChange: (v: string) => void
  onModuleChange: (v: AuditModule | 'all') => void
  onActionChange: (v: AuditAction | 'all') => void
  onAdminChange: (v: string) => void
  onClear: () => void
  matchingCount: number

  /* ---------- Enhancements (all optional, degrade gracefully) ---------- */
  search?: string
  onSearchChange?: (v: string) => void
  severities?: Severity[]
  onSeveritiesChange?: (v: Severity[]) => void
  collapsible?: boolean
  defaultCollapsed?: boolean
  loading?: boolean
  totalCount?: number
  showDatePresets?: boolean
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function FilterPanel({
  from,
  to,
  module,
  action,
  adminId,
  admins,
  onFromChange,
  onToChange,
  onModuleChange,
  onActionChange,
  onAdminChange,
  onClear,
  matchingCount,
  search,
  onSearchChange,
  severities,
  onSeveritiesChange,
  collapsible = false,
  defaultCollapsed = false,
  loading = false,
  totalCount,
  showDatePresets = true,
}: Props) {
  /* ---------------------------- state ---------------------------- */
  const [collapsed, setCollapsed] = useState(defaultCollapsed)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')

  const searchRef = useRef<HTMLInputElement | null>(null)

  /* --------------------------- derived --------------------------- */

  const hasActive = useMemo(() => {
    return (
      !!from ||
      !!to ||
      module !== 'all' ||
      action !== 'all' ||
      adminId !== 'all' ||
      Boolean(severities && severities.length > 0) ||
      Boolean(search && search.trim().length > 0)
    )
  }, [from, to, module, action, adminId, severities, search])

  const activeCount = useMemo(() => {
    let n = 0
    if (from) n += 1
    if (to) n += 1
    if (module !== 'all') n += 1
    if (action !== 'all') n += 1
    if (adminId !== 'all') n += 1
    if (severities?.length) n += severities.length
    if (search?.trim()) n += 1
    return n
  }, [from, to, module, action, adminId, severities, search])

  const dateInvalid = Boolean(from && to && from > to)
  const showSeverity = Boolean(onSeveritiesChange)
  const showSearch = Boolean(onSearchChange)

  const resultPercentage =
    totalCount != null && totalCount > 0
      ? Math.round((matchingCount / totalCount) * 100)
      : null

  const activePills: Array<{ key: string; label: string; onRemove: () => void }> = []

  if (from) {
    activePills.push({
      key: 'from',
      label: `From ${from}`,
      onRemove: () => onFromChange(''),
    })
  }
  if (to) {
    activePills.push({
      key: 'to',
      label: `To ${to}`,
      onRemove: () => onToChange(''),
    })
  }
  if (module !== 'all') {
    activePills.push({
      key: 'module',
      label: MODULES.find((m) => m.value === module)?.label ?? module,
      onRemove: () => onModuleChange('all'),
    })
  }
  if (action !== 'all') {
    activePills.push({
      key: 'action',
      label: ACTIONS.find((a) => a.value === action)?.label ?? action,
      onRemove: () => onActionChange('all'),
    })
  }
  if (adminId !== 'all') {
    activePills.push({
      key: 'admin',
      label: admins.find((a) => a.id === adminId)?.name ?? adminId,
      onRemove: () => onAdminChange('all'),
    })
  }
  if (severities?.length) {
    severities.forEach((s) => {
      activePills.push({
        key: `sev-${s}`,
        label: `Severity: ${SEVERITIES.find((x) => x.value === s)?.label ?? s}`,
        onRemove: () =>
          onSeveritiesChange?.(severities.filter((x) => x !== s)),
      })
    })
  }
  if (search?.trim()) {
    activePills.push({
      key: 'search',
      label: `"${search.trim()}"`,
      onRemove: () => onSearchChange?.(''),
    })
  }

  /* --------------------------- effects --------------------------- */

  // Reset the "copied" tick after a short delay
  useEffect(() => {
    if (copyState !== 'copied') return
    const id = window.setTimeout(() => setCopyState('idle'), 1500)
    return () => window.clearTimeout(id)
  }, [copyState])

  // ⌘K / Ctrl+K focuses the search input
  useEffect(() => {
    if (!showSearch) return
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showSearch])

  /* --------------------------- handlers -------------------------- */

  function applyDatePreset(preset: DatePreset) {
    const { from: f, to: t } = preset.compute()
    onFromChange(f)
    onToChange(t)
  }

  function isPresetActive(preset: DatePreset): boolean {
    const { from: f, to: t } = preset.compute()
    return from === f && to === t
  }

  function toggleSeverity(s: Severity) {
    if (!onSeveritiesChange) return
    const current = severities ?? []
    if (current.includes(s)) {
      onSeveritiesChange(current.filter((x) => x !== s))
    } else {
      onSeveritiesChange([...current, s])
    }
  }

  async function handleCopySummary() {
    const parts: string[] = []
    if (from || to) parts.push(`Date: ${from || '…'} → ${to || '…'}`)
    if (module !== 'all') {
      parts.push(`Module: ${MODULES.find((m) => m.value === module)?.label ?? module}`)
    }
    if (action !== 'all') {
      parts.push(`Action: ${ACTIONS.find((a) => a.value === action)?.label ?? action}`)
    }
    if (adminId !== 'all') {
      parts.push(`Admin: ${admins.find((a) => a.id === adminId)?.name ?? adminId}`)
    }
    if (severities?.length) parts.push(`Severity: ${severities.join(', ')}`)
    if (search?.trim()) parts.push(`Search: "${search.trim()}"`)

    const text = parts.length ? parts.join(' · ') : 'No filters applied'
    try {
      await navigator.clipboard.writeText(text)
      setCopyState('copied')
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  /* ---------------------------- render --------------------------- */

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      <style>{ANIMATIONS}</style>

      {/* -------------------- Header -------------------- */}
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-emerald" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-ink">Filter records</h3>
          {activeCount > 0 ? (
            <span
              className="fp-pop inline-flex items-center justify-center rounded-full bg-emerald/10 text-emerald text-[10px] font-bold px-1.5 py-0.5 min-w-[18px]"
              aria-label={`${activeCount} active filters`}
            >
              {activeCount}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {hasActive ? (
            <>
              <button
                type="button"
                onClick={handleCopySummary}
                title="Copy filter summary to clipboard"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-ink-secondary hover:text-ink hover:bg-surface-alt transition-colors"
              >
                {copyState === 'copied' ? (
                  <>
                    <Check size={12} className="text-emerald" aria-hidden="true" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy size={12} aria-hidden="true" />
                    Copy
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClear}
                className="inline-flex items-center gap-1 text-xs font-medium text-ink-secondary hover:text-danger transition-colors px-2 py-1 rounded-md hover:bg-red-50"
              >
                <X size={12} aria-hidden="true" />
                Clear all
              </button>
            </>
          ) : null}

          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center justify-center rounded-md p-1 text-ink-muted hover:text-ink hover:bg-surface-alt transition-colors"
              aria-expanded={!collapsed}
              aria-label={collapsed ? 'Expand filters' : 'Collapse filters'}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          ) : null}
        </div>
      </div>

      {/* -------------------- Body -------------------- */}
      {!collapsed ? (
        <div className="p-5 space-y-4 fp-fade-in">
          {/* Search */}
          {showSearch ? (
            <div className="relative fp-fade-up">
              <Search
                size={14}
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                ref={searchRef}
                type="text"
                value={search ?? ''}
                onChange={(e) => onSearchChange?.(e.target.value)}
                placeholder="Search by target, admin, notes, IP…"
                aria-label="Search audit records"
                className="w-full rounded-lg border border-border bg-surface pl-9 pr-16 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {search ? (
                  <button
                    type="button"
                    onClick={() => onSearchChange?.('')}
                    className="rounded p-0.5 text-ink-muted hover:text-ink transition-colors"
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : null}
                <kbd className="hidden sm:inline-flex items-center rounded border border-border bg-surface-alt px-1 py-0.5 text-[10px] font-medium text-ink-muted">
                  ⌘K
                </kbd>
              </div>
            </div>
          ) : null}

          {/* Date presets */}
          {showDatePresets ? (
            <div className="flex flex-wrap items-center gap-1.5 fp-fade-up">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mr-1">
                Quick:
              </span>
              {DATE_PRESETS.map((p) => {
                const active = isPresetActive(p)
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => applyDatePreset(p)}
                    className={cn(
                      'rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all',
                      active
                        ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                        : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                    )}
                    aria-pressed={active}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>
          ) : null}

          {/* Original grid — preserved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                <Calendar size={11} aria-hidden="true" />
                From
              </label>
              <input
                type="date"
                value={from}
                onChange={(e) => onFromChange(e.target.value)}
                aria-invalid={dateInvalid}
                className={cn(
                  inputClass,
                  dateInvalid &&
                    'border-red-300 focus:border-red-400 focus:ring-red-200/40',
                )}
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                <Calendar size={11} aria-hidden="true" />
                To
              </label>
              <input
                type="date"
                value={to}
                onChange={(e) => onToChange(e.target.value)}
                aria-invalid={dateInvalid}
                className={cn(
                  inputClass,
                  dateInvalid &&
                    'border-red-300 focus:border-red-400 focus:ring-red-200/40',
                )}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                Module
              </label>
              <select
                value={module}
                onChange={(e) => onModuleChange(e.target.value as AuditModule | 'all')}
                className={inputClass}
              >
                {MODULES.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                Action
              </label>
              <select
                value={action}
                onChange={(e) => onActionChange(e.target.value as AuditAction | 'all')}
                className={inputClass}
              >
                {ACTIONS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                Admin
              </label>
              <select
                value={adminId}
                onChange={(e) => onAdminChange(e.target.value)}
                className={inputClass}
              >
                <option value="all">All admins</option>
                {admins.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date range warning */}
          {dateInvalid ? (
            <div className="fp-fade-in flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              <AlertTriangle size={12} className="shrink-0" aria-hidden="true" />
              The &quot;From&quot; date is after the &quot;To&quot; date — no
              records will match.
            </div>
          ) : null}

          {/* Severity chips */}
          {showSeverity ? (
            <div className="fp-fade-up">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-secondary mb-1.5">
                <Sparkles size={11} aria-hidden="true" />
                Severity
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SEVERITIES.map((s) => {
                  const isActive = severities?.includes(s.value) ?? false
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => toggleSeverity(s.value)}
                      aria-pressed={isActive}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all',
                        isActive
                          ? 'border-emerald bg-emerald/10 text-emerald-dark'
                          : 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald',
                      )}
                    >
                      <span
                        className={cn('h-1.5 w-1.5 rounded-full', s.dot)}
                        aria-hidden="true"
                      />
                      {s.label}
                      {isActive ? <Check size={10} aria-hidden="true" /> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : null}

          {/* Active filter pills */}
          {activePills.length > 0 ? (
            <div className="fp-fade-in flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted mr-1">
                Active:
              </span>
              {activePills.map((pill) => (
                <button
                  key={pill.key}
                  type="button"
                  onClick={pill.onRemove}
                  title={`Remove filter: ${pill.label}`}
                  className="group inline-flex items-center gap-1 rounded-full border border-border bg-surface-alt/60 pl-2 pr-1 py-0.5 text-[11px] font-medium text-ink-secondary hover:border-red-300 hover:text-danger transition-colors"
                >
                  <span className="max-w-[200px] truncate">{pill.label}</span>
                  <X
                    size={10}
                    className="opacity-60 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          ) : null}

          {/* Result count — original contract preserved */}
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-xs flex items-center justify-between gap-2',
              matchingCount === 0
                ? 'border-red-200 bg-red-50 text-danger'
                : 'border-emerald/20 bg-emerald-light text-emerald-dark',
            )}
            aria-live="polite"
          >
            <span className="inline-flex items-center gap-1.5">
              {loading ? (
                <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              ) : matchingCount === 0 ? (
                <FilterX size={12} aria-hidden="true" />
              ) : (
                <Filter size={12} aria-hidden="true" />
              )}
              <span className="font-semibold">
                {matchingCount.toLocaleString()}
              </span>{' '}
              {matchingCount === 1 ? 'record' : 'records'} match these filters
              {totalCount != null ? (
                <span className="opacity-70">
                  · of {totalCount.toLocaleString()} total
                </span>
              ) : null}
            </span>
            {resultPercentage != null ? (
              <span className="text-[10px] font-semibold tabular-nums opacity-70">
                {resultPercentage}%
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        /* Collapsed summary */
        <div className="px-5 py-2.5 flex items-center justify-between gap-2 fp-fade-in">
          <span className="text-xs text-ink-secondary">
            <span className="font-semibold">
              {matchingCount.toLocaleString()}
            </span>{' '}
            {matchingCount === 1 ? 'record' : 'records'} match
            {activeCount > 0 ? (
              <>
                {' '}· {activeCount} active filter
                {activeCount === 1 ? '' : 's'}
              </>
            ) : null}
          </span>
          {activeCount > 0 ? (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] font-semibold text-emerald hover:text-emerald-dark transition-colors"
            >
              Clear
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}