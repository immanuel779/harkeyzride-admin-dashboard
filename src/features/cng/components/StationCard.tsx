import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  Copy,
  Crown,
  ExternalLink,
  Eye,
  Fuel,
  MapPin,
  MoreVertical,
  Pause,
  Play,
  Settings2,
  Sparkles,
  Trophy,
  Users,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { CngStation, CngStationStatus } from '../data/mockCng'

/* ==========================================================================
   CONFIG (original STATUS_MAP preserved)
   ========================================================================== */

const STATUS_MAP: Record<
  CngStationStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  active: { label: 'Active', bg: 'bg-emerald-light', text: 'text-emerald-dark', dot: 'bg-emerald' },
  paused: { label: 'Paused', bg: 'bg-amber-50', text: 'text-warning', dot: 'bg-warning' },
  pending: { label: 'Pending', bg: 'bg-surface-alt', text: 'text-ink-secondary', dot: 'bg-border-strong' },
}

const RANK_STYLES: Record<
  number,
  { label: string; badgeBg: string; badgeText: string; badgeRing: string; icon: typeof Crown | null }
> = {
  1: { label: 'Gold', badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', badgeRing: 'ring-amber-200', icon: Crown },
  2: { label: 'Silver', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', badgeRing: 'ring-slate-200', icon: Trophy },
  3: { label: 'Bronze', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', badgeRing: 'ring-orange-200', icon: Trophy },
}

const HIGH_VOLUME_KG = 5000
const INACTIVE_DAYS = 14

function formatNaira(n: number) {
  return `₦${n.toLocaleString()}`
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const ANIMATIONS = `
  @keyframes sc-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sc-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sc-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes sc-pulse-dot { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); } 70% { box-shadow: 0 0 0 6px rgba(16,185,129,0); } }
  @keyframes sc-bar-grow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
  .sc-fade-up { animation: sc-fade-up .3s cubic-bezier(.22,1,.36,1) both; }
  .sc-fade-in { animation: sc-fade-in .2s ease both; }
  .sc-pop { animation: sc-pop .3s cubic-bezier(.22,1,.36,1) both; }
  .sc-pulse-dot { animation: sc-pulse-dot 1.8s ease-out infinite; }
  .sc-bar { transform-origin: left center; animation: sc-bar-grow .6s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .sc-fade-up, .sc-fade-in, .sc-pop, .sc-pulse-dot, .sc-bar { animation: none !important; }
  }
`

/* ==========================================================================
   PROPS
   ========================================================================== */

type Props = {
  /* -------- Original contract (unchanged) -------- */
  station: CngStation

  /* -------- Enhancements (all optional) -------- */
  rank?: number
  maxVolume?: number
  lastRefuelAt?: string | null
  currency?: string
  isEditingRate?: boolean
  onPause?: (station: CngStation) => void
  onResume?: (station: CngStation) => void
  onAdjustRate?: (station: CngStation, newRate: number) => void
  onViewDetails?: (station: CngStation) => void
  onCopyReference?: (station: CngStation) => void
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function StationCard({
  station,
  rank,
  maxVolume,
  lastRefuelAt,
  currency = '₦',
  onPause,
  onResume,
  onAdjustRate,
  onViewDetails,
  onCopyReference,
}: Props) {
  const cfg = STATUS_MAP[station.status]
  const hasVolume = station.volumeThisMonth > 0

  /* ---------------------------- state ---------------------------- */

  const [menuOpen, setMenuOpen] = useState(false)
  const [rateEditorOpen, setRateEditorOpen] = useState(false)
  const [draftRate, setDraftRate] = useState<string>(String(station.rebatePerKg))
  const [copied, setCopied] = useState(false)

  const menuRef = useRef<HTMLDivElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const copiedTimerRef = useRef<number | null>(null)

  /* --------------------------- derived --------------------------- */

  const rankStyle = rank && rank >= 1 && rank <= 3 ? RANK_STYLES[rank] : null

  const volumePct = useMemo(() => {
    if (!maxVolume || maxVolume <= 0) return null
    return Math.min(100, Math.round((station.volumeThisMonth / maxVolume) * 100))
  }, [maxVolume, station.volumeThisMonth])

  const efficiency = useMemo(() => {
    if (station.volumeThisMonth <= 0 || station.rebatePerKg <= 0) return null
    const expected = station.volumeThisMonth * station.rebatePerKg
    if (expected <= 0) return null
    return station.rebateEarned / expected
  }, [station.volumeThisMonth, station.rebatePerKg, station.rebateEarned])

  const efficiencyTone: 'success' | 'warning' | 'danger' | null =
    efficiency == null
      ? null
      : efficiency >= 0.98
        ? 'success'
        : efficiency >= 0.9
          ? 'warning'
          : 'danger'

  const inactivityDays =
    lastRefuelAt === null
      ? null
      : lastRefuelAt
        ? daysSince(lastRefuelAt)
        : null

  const isInactive =
    station.status === 'active' &&
    ((inactivityDays != null && inactivityDays >= INACTIVE_DAYS) || !hasVolume)

  const hasActions = Boolean(
    onPause || onResume || onAdjustRate || onViewDetails || onCopyReference,
  )

  const canPause = station.status === 'active' && !!onPause
  const canResume = (station.status === 'paused' || station.status === 'pending') && !!onResume
  const canAdjustRate = !!onAdjustRate

  /* --------------------------- effects --------------------------- */

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Escape closes overlays
  useEffect(() => {
    if (!menuOpen && !rateEditorOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        setRateEditorOpen(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [menuOpen, rateEditorOpen])

  // Reset rate draft when station changes
  useEffect(() => {
    setDraftRate(String(station.rebatePerKg))
  }, [station.rebatePerKg])

  // Cleanup copy timer
  useEffect(
    () => () => {
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
    },
    [],
  )

  /* --------------------------- handlers -------------------------- */

  const openRateEditor = useCallback(() => {
    setDraftRate(String(station.rebatePerKg))
    setRateEditorOpen(true)
    setMenuOpen(false)
  }, [station.rebatePerKg])

  const submitRate = useCallback(() => {
    const parsed = Number(draftRate)
    if (!Number.isFinite(parsed) || parsed < 0) return
    if (parsed === station.rebatePerKg) {
      setRateEditorOpen(false)
      return
    }
    onAdjustRate?.(station, parsed)
    setRateEditorOpen(false)
  }, [draftRate, station, onAdjustRate])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        [
          `Station: ${station.name}`,
          `Location: ${station.location}`,
          `Status: ${cfg.label}`,
          `Rate: ${currency}${station.rebatePerKg.toFixed(2)}/kg`,
          `Volume: ${station.volumeThisMonth.toLocaleString()} kg`,
          `Rebate earned: ${currency}${station.rebateEarned.toLocaleString()}`,
          `Drivers served: ${station.driversServed}`,
        ].join('\n'),
      )
      setCopied(true)
      if (copiedTimerRef.current) window.clearTimeout(copiedTimerRef.current)
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
      onCopyReference?.(station)
    } catch {
      /* clipboard unavailable */
    }
    setMenuOpen(false)
  }, [station, cfg.label, currency, onCopyReference])

  /* ---------------------------- render --------------------------- */

  return (
    <div
      className={cn(
        'group relative rounded-xl bg-surface border border-border p-5 transition-all duration-200',
        'hover:border-border-strong hover:shadow-md hover:shadow-black/[0.03] hover:-translate-y-0.5',
        rankStyle && `ring-1 ${rankStyle.badgeRing}`,
        isInactive && 'border-amber-200',
      )}
    >
      <style>{ANIMATIONS}</style>

      {/* -------------------- Rank badge -------------------- */}
      {rankStyle ? (
        <div
          className={cn(
            'sc-pop absolute -top-2 -left-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-2 ring-surface shadow-sm',
            rankStyle.badgeBg,
            rankStyle.badgeText,
          )}
          aria-label={`Rank ${rank} — ${rankStyle.label}`}
        >
          {rankStyle.icon ? (
            <rankStyle.icon size={10} aria-hidden="true" />
          ) : null}
          #{rank}
        </div>
      ) : null}

      {/* -------------------- Header -------------------- */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-2.5 min-w-0">
          {/* Initials avatar */}
          <div
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold',
              station.status === 'active'
                ? 'bg-navy text-white'
                : station.status === 'paused'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-surface-alt text-ink-secondary',
            )}
            aria-hidden="true"
          >
            {initials(station.name)}
          </div>

          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-ink truncate">
              {station.name}
            </h3>
            <div className="flex items-center gap-1 text-xs text-ink-secondary mt-0.5">
              <MapPin size={11} aria-hidden="true" />
              <span className="truncate">{station.location}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Status pill */}
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
              cfg.bg,
              cfg.text,
            )}
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                cfg.dot,
                station.status === 'active' && 'sc-pulse-dot',
              )}
              aria-hidden="true"
            />
            {cfg.label}
          </span>

          {/* Actions menu trigger */}
          {hasActions ? (
            <button
              ref={triggerRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Station actions"
              className="rounded-md p-1 text-ink-muted opacity-0 transition-opacity hover:bg-surface-alt hover:text-ink group-hover:opacity-100 focus:opacity-100"
            >
              <MoreVertical size={14} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </div>

      {/* -------------------- Actions menu -------------------- */}
      {menuOpen ? (
        <div
          ref={menuRef}
          role="menu"
          className="sc-fade-up absolute right-3 top-12 z-30 w-52 overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-black/10"
        >
          <div className="p-1.5">
            {onViewDetails ? (
              <MenuItem
                icon={<Eye size={13} />}
                label="View details"
                onClick={() => {
                  onViewDetails(station)
                  setMenuOpen(false)
                }}
              />
            ) : null}

            {onCopyReference ? (
              <MenuItem
                icon={copied ? <Check size={13} className="text-emerald" /> : <Copy size={13} />}
                label={copied ? 'Copied' : 'Copy summary'}
                onClick={handleCopy}
              />
            ) : null}

            {canAdjustRate ? (
              <MenuItem
                icon={<Settings2 size={13} />}
                label="Adjust rebate rate"
                hint={`${currency}${station.rebatePerKg.toFixed(2)}/kg`}
                onClick={openRateEditor}
              />
            ) : null}

            {(canPause || canResume) && (onPause || onResume) ? (
              <div className="my-1 h-px bg-border" role="separator" />
            ) : null}

            {canPause ? (
              <MenuItem
                icon={<Pause size={13} />}
                label="Pause station"
                tone="warning"
                onClick={() => {
                  onPause?.(station)
                  setMenuOpen(false)
                }}
              />
            ) : null}

            {canResume ? (
              <MenuItem
                icon={<Play size={13} />}
                label="Resume station"
                tone="success"
                onClick={() => {
                  onResume?.(station)
                  setMenuOpen(false)
                }}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      {/* -------------------- Inline rate editor -------------------- */}
      {rateEditorOpen ? (
        <div className="sc-fade-up mb-3 rounded-lg border border-emerald/30 bg-emerald-light/60 p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-dark">
              <Settings2 size={10} aria-hidden="true" />
              Adjust rebate rate
            </span>
            <button
              type="button"
              onClick={() => setRateEditorOpen(false)}
              className="rounded p-0.5 text-emerald-dark/60 hover:text-emerald-dark"
              aria-label="Close rate editor"
            >
              <X size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-ink-muted">
                {currency}
              </span>
              <input
                type="number"
                step="0.25"
                min="0"
                value={draftRate}
                onChange={(e) => setDraftRate(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRate()
                }}
                autoFocus
                className="w-full rounded-md border border-border bg-surface py-1.5 pl-6 pr-8 text-sm text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
                aria-label="New rebate rate"
              />
              <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-ink-muted">
                /kg
              </span>
            </div>
            <button
              type="button"
              onClick={submitRate}
              className="inline-flex items-center gap-1 rounded-md bg-emerald px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
            >
              <Check size={11} aria-hidden="true" />
              Save
            </button>
          </div>
          <p className="mt-1 text-[10px] text-emerald-dark/70">
            Current: {currency}{station.rebatePerKg.toFixed(2)}/kg · Applies to future refuels
          </p>
        </div>
      ) : null}

      {/* -------------------- Inactivity banner -------------------- */}
      {isInactive ? (
        <div className="sc-fade-up mb-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            {!hasVolume
              ? 'No volume recorded yet'
              : `No refuels in ${inactivityDays} days`}
          </span>
        </div>
      ) : null}

      {/* -------------------- Body -------------------- */}
      {hasVolume ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg bg-surface-alt p-2.5">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-muted mb-1">
                <Fuel size={10} aria-hidden="true" />
                Volume (kg)
              </div>
              <div className="text-base font-bold text-ink">
                {station.volumeThisMonth.toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-emerald-light p-2.5">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-dark mb-1">
                <TrendingUp size={10} aria-hidden="true" />
                Rebate earned
              </div>
              <div className="text-base font-bold text-emerald-dark">
                {formatNaira(station.rebateEarned)}
              </div>
            </div>
          </div>

          {/* Volume share bar */}
          {volumePct != null ? (
            <div className="mb-3">
              <div className="mb-1 flex items-center justify-between text-[10px] text-ink-muted">
                <span>Share of top station</span>
                <span className="tabular-nums font-medium text-ink-secondary">
                  {volumePct}%
                </span>
              </div>
              <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-alt">
                <div
                  className="sc-bar absolute inset-y-0 left-0 rounded-full bg-emerald"
                  style={{ width: `${volumePct}%` }}
                />
              </div>
            </div>
          ) : null}

          {/* Efficiency meter */}
          {efficiency != null && efficiencyTone ? (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md bg-surface-alt/60 px-2 py-1.5 text-[10px]">
              <span className="flex items-center gap-1 text-ink-muted">
                <Zap size={10} aria-hidden="true" />
                Rebate efficiency
              </span>
              <span
                className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold uppercase tracking-wide',
                  efficiencyTone === 'success'
                    ? 'bg-emerald-light text-emerald-dark'
                    : efficiencyTone === 'warning'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-50 text-danger',
                )}
              >
                {Math.round(efficiency * 100)}%
              </span>
            </div>
          ) : null}

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-ink-secondary">
              <Users size={11} aria-hidden="true" />
              <span>{station.driversServed} drivers served</span>
            </div>
            <span className="text-ink-muted font-mono">
              {currency}
              {station.rebatePerKg.toFixed(2)}/kg
            </span>
          </div>

          {/* High-volume flag */}
          {station.volumeThisMonth >= HIGH_VOLUME_KG ? (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
              <Sparkles size={10} aria-hidden="true" />
              High volume
            </div>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border-strong py-4 text-center text-xs text-ink-muted">
          Awaiting first refuel
        </div>
      )}

      {/* -------------------- Footer quick actions -------------------- */}
      {onViewDetails || onAdjustRate ? (
        <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 opacity-0 transition-opacity group-hover:opacity-100">
          {onViewDetails ? (
            <button
              type="button"
              onClick={() => onViewDetails(station)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald hover:text-emerald-dark transition-colors"
            >
              <ArrowUpRight size={11} aria-hidden="true" />
              View details
            </button>
          ) : (
            <span />
          )}
          {onAdjustRate ? (
            <button
              type="button"
              onClick={openRateEditor}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-secondary hover:text-ink transition-colors"
            >
              <Settings2 size={11} aria-hidden="true" />
              Adjust rate
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/* ==========================================================================
   SUBCOMPONENTS
   ========================================================================== */

function MenuItem({
  icon,
  label,
  hint,
  tone = 'default',
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  tone?: 'default' | 'success' | 'warning' | 'danger'
  onClick: () => void
}) {
  const toneClass =
    tone === 'success'
      ? 'hover:bg-emerald-light hover:text-emerald-dark'
      : tone === 'warning'
        ? 'hover:bg-amber-50 hover:text-amber-700'
        : tone === 'danger'
          ? 'hover:bg-red-50 hover:text-danger'
          : 'hover:bg-surface-alt hover:text-ink'

  return (
    <button
      type="button"
      onClick={onClick}
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-secondary transition-colors',
        toneClass,
      )}
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {hint ? (
        <span className="text-[10px] text-ink-muted">{hint}</span>
      ) : null}
    </button>
  )
}