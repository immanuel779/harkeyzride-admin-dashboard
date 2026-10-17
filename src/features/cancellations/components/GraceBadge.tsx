import { useMemo, useState } from 'react'
import { Clock, AlertCircle, CheckCircle2, Info } from 'lucide-react'

import { cn } from '../../../lib/cn'
import type { GraceStatus } from '../data/mockCancellations'

/* ==========================================================================
   CONFIG (original preserved)
   ========================================================================== */

const CONFIG: Record<
  GraceStatus,
  { label: string; bg: string; text: string; Icon: typeof Clock }
> = {
  within_grace: {
    label: 'Within grace',
    bg: 'bg-emerald-light',
    text: 'text-emerald-dark',
    Icon: CheckCircle2,
  },
  after_grace: {
    label: 'After grace',
    bg: 'bg-red-50',
    text: 'text-danger',
    Icon: AlertCircle,
  },
  waived: {
    label: 'Waived',
    bg: 'bg-blue-50',
    text: 'text-info',
    Icon: Clock,
  },
}

/* ==========================================================================
   TYPES
   ========================================================================== */

type Size = 'sm' | 'md' | 'lg'

type Props = {
  /* -------- Original contract (unchanged) -------- */
  status: GraceStatus
  minutesElapsed: number

  /* -------- Enhancements (all optional) -------- */
  graceMinutes?: number
  size?: Size
  showProgress?: boolean
  showGraceLimit?: boolean
  criticalThreshold?: number
}

const SIZE_MAP: Record<
  Size,
  { pill: string; icon: number; minutes: string; dot: string }
> = {
  sm: { pill: 'px-2 py-0.5 text-[10px]', icon: 10, minutes: 'text-[10px]', dot: 'h-1 w-1' },
  md: { pill: 'px-2.5 py-0.5 text-[11px]', icon: 11, minutes: 'text-xs', dot: 'h-1 w-1' },
  lg: { pill: 'px-3 py-1 text-xs', icon: 13, minutes: 'text-sm', dot: 'h-1.5 w-1.5' },
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function GraceBadge({
  status,
  minutesElapsed,
  graceMinutes = 5,
  size = 'md',
  showProgress = false,
  showGraceLimit = true,
  criticalThreshold,
}: Props) {
  const cfg = CONFIG[status]
  const Icon = cfg.Icon
  const sizes = SIZE_MAP[size]

  const [hovered, setHovered] = useState(false)

  /* --------------------------- derived --------------------------- */

  const progressPct = useMemo(() => {
    if (graceMinutes <= 0) return 100
    return Math.min(100, (minutesElapsed / graceMinutes) * 100)
  }, [minutesElapsed, graceMinutes])

  const overshootMinutes = Math.max(0, minutesElapsed - graceMinutes)
  const remainingMinutes = Math.max(0, graceMinutes - minutesElapsed)

  const isCritical =
    status === 'after_grace' &&
    minutesElapsed >= (criticalThreshold ?? graceMinutes * 2)

  const isApproaching = status === 'within_grace' && progressPct >= 60

  const tooltip = useMemo(() => {
    if (status === 'within_grace') {
      return `Within ${graceMinutes}-minute grace window · ${remainingMinutes} minute${
        remainingMinutes === 1 ? '' : 's'
      } remaining`
    }
    if (status === 'after_grace') {
      return `Cancelled ${overshootMinutes} minute${
        overshootMinutes === 1 ? '' : 's'
      } after the ${graceMinutes}-minute grace window — penalty applies`
    }
    return `Penalty waived by admin · original grace limit ${graceMinutes} minutes`
  }, [status, graceMinutes, remainingMinutes, overshootMinutes])

  const barColor = useMemo(() => {
    if (status === 'within_grace') {
      if (progressPct >= 80) return 'bg-amber-500'
      if (progressPct >= 60) return 'bg-emerald'
      return 'bg-emerald/70'
    }
    if (status === 'after_grace') return 'bg-red-500'
    return 'bg-sky-500'
  }, [status, progressPct])

  /* --------------------------- render ---------------------------- */

  return (
    <div
      className="flex flex-col gap-1"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex items-center gap-2">
        {/* Pill */}
        <span
          title={tooltip}
          aria-label={`${cfg.label} — ${tooltip}`}
          className={cn(
            'inline-flex items-center gap-1 whitespace-nowrap rounded-full font-medium',
            cfg.bg,
            cfg.text,
            sizes.pill,
          )}
        >
          <Icon
            size={sizes.icon}
            className={isCritical ? 'animate-pulse' : undefined}
            aria-hidden="true"
          />
          {cfg.label}
          {isCritical ? (
            <span
              className={cn('ml-0.5 rounded-full bg-red-500 animate-pulse', sizes.dot)}
              aria-hidden="true"
            />
          ) : null}
        </span>

        {/* Minutes + grace limit */}
        <span
          className={cn(
            'tabular-nums text-ink-muted',
            sizes.minutes,
          )}
        >
          {minutesElapsed}m
          {status === 'within_grace' && showGraceLimit ? (
            <span className="ml-1 text-ink-muted/60">/ {graceMinutes}m</span>
          ) : null}
        </span>

        {/* Approaching warning */}
        {isApproaching ? (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-700">
            <Clock size={9} aria-hidden="true" />
            Close
          </span>
        ) : null}

        {/* Overshoot indicator */}
        {status === 'after_grace' && overshootMinutes > 0 && size !== 'sm' ? (
          <span className="text-[10px] font-medium text-danger/80 tabular-nums">
            +{overshootMinutes}m late
          </span>
        ) : null}

        {/* Hover info */}
        {hovered && !isCritical ? (
          <Info
            size={sizes.icon}
            className="text-ink-muted/50"
            aria-hidden="true"
          />
        ) : null}
      </div>

      {/* Progress bar */}
      {showProgress ? (
        <div
          className="relative h-1 w-full overflow-hidden rounded-full bg-surface-alt"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={graceMinutes}
          aria-valuenow={Math.min(minutesElapsed, graceMinutes)}
          aria-label={`${minutesElapsed} of ${graceMinutes} grace minutes elapsed`}
        >
          <div
            className={cn(
              'absolute inset-y-0 left-0 rounded-full transition-all duration-500',
              barColor,
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}
    </div>
  )
}