import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Clock,
  Keyboard,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react'

import { ConfirmModal } from '../../../components/shared/ConfirmModal'
import { cn } from '../../../lib/cn'

/* ==========================================================================
   PRESETS — grouped by intent (original flat list preserved as PRESET_REASONS)
   ========================================================================== */

type PresetGroup = {
  key: string
  label: string
  icon: typeof ShieldCheck
  presets: string[]
}

const PRESET_GROUPS: PresetGroup[] = [
  {
    key: 'safety',
    label: 'Safety',
    icon: ShieldCheck,
    presets: [
      'Verified safety concern',
      'Driver misrepresented ETA',
      'Harassment reported — escalated',
    ],
  },
  {
    key: 'technical',
    label: 'Technical',
    icon: Sparkles,
    presets: [
      'Network / app issue',
      'GPS tracking failure',
      'Payment gateway error',
    ],
  },
  {
    key: 'goodwill',
    label: 'Goodwill',
    icon: CheckCircle2,
    presets: [
      'Emergency on rider side',
      'One-time courtesy waiver',
      'First-time customer accommodation',
    ],
  },
]

const PRESET_REASONS = PRESET_GROUPS.flatMap((g) => g.presets)

const RECENT_KEY = 'hr.waive.recentReasons'
const MAX_RECENT = 3
const HIGH_FEE_THRESHOLD = 500
const DEFAULT_MIN = 8
const DEFAULT_MAX = 280

const ANIMATIONS = `
  @keyframes wm-fade-up { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes wm-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  .wm-fade-up { animation: wm-fade-up .25s cubic-bezier(.22,1,.36,1) both; }
  .wm-pop { animation: wm-pop .3s cubic-bezier(.22,1,.36,1) both; }
  @media (prefers-reduced-motion: reduce) {
    .wm-fade-up, .wm-pop { animation: none !important; }
  }
`

/* ==========================================================================
   TYPES
   ========================================================================== */

type Props = {
  /* -------- Original contract (unchanged) -------- */
  open: boolean
  riderName: string
  fee: number
  loading: boolean
  onConfirm: (note: string) => void
  onClose: () => void

  /* -------- Enhancements (all optional) -------- */
  reason?: string
  adminName?: string
  currency?: string
  similarCount?: number
  onApplyToSimilar?: (note: string) => void
  minLength?: number
  maxLength?: number
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function WaiveModal({
  open,
  riderName,
  fee,
  loading,
  onConfirm,
  onClose,
  reason,
  adminName,
  currency = '₦',
  similarCount = 0,
  onApplyToSimilar,
  minLength = DEFAULT_MIN,
  maxLength = DEFAULT_MAX,
}: Props) {
  const [note, setNote] = useState('')
  const [recent, setRecent] = useState<string[]>([])
  const [applyToSimilar, setApplyToSimilar] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  /* --------------------------- effects --------------------------- */

  // Reset + load recent reasons + focus textarea
  useEffect(() => {
    if (!open) {
      setNote('')
      setApplyToSimilar(false)
      return
    }
    try {
      const raw = window.localStorage.getItem(RECENT_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) setRecent(parsed.slice(0, MAX_RECENT))
      }
    } catch {
      /* ignore */
    }
    const id = window.setTimeout(() => textareaRef.current?.focus(), 90)
    return () => window.clearTimeout(id)
  }, [open])

  // Force the "apply to similar" toggle off when nothing is similar
  useEffect(() => {
    if (similarCount <= 0) setApplyToSimilar(false)
  }, [similarCount])

  // ⌘/Ctrl + Enter submits
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key !== 'Enter') return
      if (loading) return
      if (note.trim().length < minLength) return
      e.preventDefault()
      submit()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note, loading, minLength])

  /* --------------------------- derived --------------------------- */

  const trimmed = note.trim()
  const charCount = note.length
  const charsLeft = maxLength - charCount
  const remaining = Math.max(0, minLength - trimmed.length)
  const valid = trimmed.length >= minLength && charCount <= maxLength
  const isHighFee = fee >= HIGH_FEE_THRESHOLD

  const suggestedPreset = useMemo(() => {
    if (!reason) return null
    const token = reason.toLowerCase().split(/\s+/)[0] ?? ''
    return PRESET_REASONS.find((p) => p.toLowerCase().includes(token)) ?? null
  }, [reason])

  /* --------------------------- handlers -------------------------- */

  const persistRecent = useCallback((r: string) => {
    setRecent((prev) => {
      const next = [r, ...prev.filter((x) => x !== r)].slice(0, MAX_RECENT)
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])

  const submit = () => {
    if (!valid || loading) return
    persistRecent(trimmed)
    onConfirm(trimmed)
    if (applyToSimilar && onApplyToSimilar && similarCount > 0) {
      onApplyToSimilar(trimmed)
    }
  }

  const pickPreset = (preset: string) => {
    setNote(preset)
    textareaRef.current?.focus()
  }

  /* --------------------------- derived UI ------------------------ */

  const title = `Waive ${currency}${fee.toLocaleString()} penalty?`

  const description =
    applyToSimilar && similarCount > 0
      ? `Rider ${riderName} and ${similarCount} similar ${
          similarCount === 1 ? 'penalty' : 'penalties'
        } will be waived. This action is logged in the audit trail.`
      : `Rider ${riderName} will not be charged. This action is logged in the audit trail.`

  const confirmLabel =
    applyToSimilar && similarCount > 0
      ? `Waive ${similarCount + 1} penalties`
      : 'Waive penalty'

  /* --------------------------- render ---------------------------- */

  return (
    <ConfirmModal
      open={open}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      variant="primary"
      loading={loading}
      onConfirm={submit}
      onClose={onClose}
    >
      <style>{ANIMATIONS}</style>

      <div className="space-y-4 wm-fade-up">
        {/* Fee + context row */}
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-alt/60 px-3 py-2">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              Reversing
            </div>
            <div className="text-sm font-bold text-ink truncate tabular-nums">
              {currency}
              {fee.toLocaleString()}
            </div>
          </div>

          {isHighFee ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 wm-pop">
              <AlertTriangle size={10} aria-hidden="true" />
              High value
            </span>
          ) : null}

          {adminName ? (
            <div className="text-right text-[11px] text-ink-muted">
              <div>by</div>
              <div className="font-semibold text-ink-secondary truncate max-w-[140px]">
                {adminName}
              </div>
            </div>
          ) : null}
        </div>

        {/* Suggested preset */}
        {suggestedPreset && !trimmed ? (
          <button
            type="button"
            onClick={() => pickPreset(suggestedPreset)}
            disabled={loading}
            className="flex w-full items-start gap-2 rounded-lg border border-emerald/30 bg-emerald-light px-3 py-2 text-left text-xs text-emerald-dark hover:bg-emerald-light/80 transition-colors wm-pop"
          >
            <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span className="flex-1">
              <span className="block font-semibold">Suggested reason</span>
              <span className="opacity-80">{suggestedPreset}</span>
            </span>
            <ChevronRight size={14} className="mt-0.5 shrink-0 opacity-60" aria-hidden="true" />
          </button>
        ) : null}

        {/* Note + counter */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="waive-note"
              className="block text-xs font-semibold uppercase tracking-wide text-ink-secondary"
            >
              Reason (required)
            </label>
            <span
              className={cn(
                'text-[10px] font-medium tabular-nums',
                charCount > maxLength ? 'text-danger' : 'text-ink-muted',
              )}
            >
              {charCount}/{maxLength}
            </span>
          </div>

          <textarea
            id="waive-note"
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, maxLength))}
            rows={3}
            placeholder="Explain why this penalty is being waived…"
            disabled={loading}
            aria-invalid={!valid && trimmed.length > 0}
            aria-describedby="waive-note-help"
            className={cn(
              'w-full resize-none rounded-lg border bg-canvas px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 transition-colors',
              charCount > maxLength
                ? 'border-red-300 focus:border-red-400 focus:ring-red-200/40'
                : 'border-border focus:border-emerald focus:ring-emerald/20',
              loading && 'opacity-60',
            )}
          />

          <div
            id="waive-note-help"
            className="mt-1 flex items-center justify-between gap-2"
          >
            <span
              className={cn(
                'text-[10px]',
                remaining > 0 ? 'text-ink-muted' : 'text-emerald',
              )}
            >
              {remaining > 0
                ? `Add ${remaining} more character${remaining === 1 ? '' : 's'}`
                : `${charsLeft} character${charsLeft === 1 ? '' : 's'} remaining`}
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-ink-muted">
              <Keyboard size={10} aria-hidden="true" />
              <kbd className="font-mono">⌘</kbd>
              <kbd className="font-mono">↵</kbd>
              to submit
            </span>
          </div>
        </div>

        {/* Recently used */}
        {recent.length > 0 ? (
          <div className="wm-fade-up">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              <RotateCcw size={10} aria-hidden="true" />
              Recently used
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => pickPreset(r)}
                  disabled={loading}
                  className={cn(
                    'max-w-[220px] truncate rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                    trimmed === r
                      ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                      : 'border-border bg-surface-alt text-ink-secondary hover:border-emerald hover:text-emerald',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Preset groups */}
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
            Quick reasons
          </div>
          <div className="space-y-2.5">
            {PRESET_GROUPS.map((group) => {
              const Icon = group.icon
              return (
                <div key={group.key}>
                  <div className="mb-1 flex items-center gap-1 text-[10px] font-medium text-ink-muted">
                    <Icon size={10} aria-hidden="true" />
                    {group.label}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.presets.map((preset) => {
                      const active = trimmed === preset
                      return (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => pickPreset(preset)}
                          disabled={loading}
                          aria-pressed={active}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors',
                            active
                              ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                              : 'border-border bg-surface text-ink-secondary hover:border-emerald hover:text-emerald',
                          )}
                        >
                          {preset}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Apply to similar */}
        {similarCount > 0 && onApplyToSimilar ? (
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-surface-alt/40 px-3 py-2 hover:border-emerald/40 transition-colors">
            <input
              type="checkbox"
              checked={applyToSimilar}
              onChange={(e) => setApplyToSimilar(e.target.checked)}
              disabled={loading}
              className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-emerald"
            />
            <span className="text-xs text-ink-secondary">
              Also apply to{' '}
              <strong className="text-ink">{similarCount}</strong> similar{' '}
              {similarCount === 1 ? 'penalty' : 'penalties'} for {riderName}
            </span>
          </label>
        ) : null}

        {/* Pre-submit hints */}
        {!valid && trimmed.length > 0 ? (
          <div className="flex items-center gap-1.5 text-[11px] text-ink-muted wm-fade-up">
            <Clock size={11} aria-hidden="true" />
            Reason must be at least {minLength} characters.
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald wm-fade-up">
            <Zap size={11} className="animate-pulse" aria-hidden="true" />
            Processing waiver — this may take a moment.
          </div>
        ) : null}
      </div>
    </ConfirmModal>
  )
}