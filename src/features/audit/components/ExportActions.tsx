import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AlertCircle,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  MoreVertical,
  Settings2,
  Shield,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'

/* ==========================================================================
   TYPES
   ========================================================================== */

type ExportFormat = 'csv' | 'pdf' | 'json' | 'copy' | 'email'
type ScheduleFrequency = 'daily' | 'weekly' | 'monthly'

export type AdvancedOptions = {
  redactPii: boolean
  includeFingerprints: boolean
  includeMetadata: boolean
}

type HistoryItem = {
  id: string
  format: ExportFormat
  recordCount: number
  sizeBytes: number
  at: number
  status: 'success' | 'error'
  durationMs: number
}

type Toast = {
  id: string
  tone: 'success' | 'error' | 'info'
  title: string
  description?: string
}

type Props = {
  recordCount: number
  onExportCsv: () => Promise<void>
  onExportPdf: () => Promise<void>
  // ---- Optional enhancements (non-breaking) ----
  onExportJson?: () => Promise<void>
  onCopyToClipboard?: () => Promise<void>
  onEmailExport?: (email: string) => Promise<void>
  onScheduleExport?: (frequency: ScheduleFrequency) => Promise<void>
  onOptionsChange?: (opts: AdvancedOptions) => void
  estimatedSizeBytes?: number
  filterSummary?: string
  variant?: 'default' | 'compact'
}

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const CONFIRM_THRESHOLD = 500
const SUCCESS_FEEDBACK_MS = 1600
const TOAST_DURATION_MS = 4000
const HISTORY_MAX = 8
const BYTES_PER_RECORD = 260

const ANIMATIONS = `
  @keyframes ea-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes ea-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes ea-slide-in { from { opacity: 0; transform: translateY(16px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
  @keyframes ea-pop { 0% { transform: scale(.8); opacity: 0; } 60% { transform: scale(1.08); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes ea-ring { 0% { transform: scale(.85); opacity: .7; } 100% { transform: scale(1.8); opacity: 0; } }
  @keyframes ea-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  @keyframes ea-pulse-dot { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
  .ea-fade-up { animation: ea-fade-up .3s cubic-bezier(.22,1,.36,1) both; }
  .ea-fade-in { animation: ea-fade-in .2s ease both; }
  .ea-slide-in { animation: ea-slide-in .35s cubic-bezier(.22,1,.36,1) both; }
  .ea-pop { animation: ea-pop .4s cubic-bezier(.22,1,.36,1) both; }
  .ea-ring { animation: ea-ring 1.2s ease-out; }
  .ea-pulse-dot { animation: ea-pulse-dot 1.4s ease-in-out infinite; }
  .ea-shimmer { position: relative; overflow: hidden; }
  .ea-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.28), transparent);
    transform: translateX(-100%);
  }
  .ea-shimmer:hover::after { animation: ea-shimmer 1s ease; }
  @media (prefers-reduced-motion: reduce) {
    .ea-fade-up, .ea-fade-in, .ea-slide-in, .ea-pop, .ea-ring, .ea-pulse-dot { animation: none !important; }
    .ea-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   UTILITIES
   ========================================================================== */

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function formatLabel(format: ExportFormat): string {
  switch (format) {
    case 'csv': return 'CSV'
    case 'pdf': return 'PDF'
    case 'json': return 'JSON'
    case 'copy': return 'Clipboard'
    case 'email': return 'Email'
  }
}

function timeAgo(ms: number): string {
  const diff = Math.max(0, Date.now() - ms)
  const s = Math.floor(diff / 1000)
  if (s < 45) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ==========================================================================
   COMPONENT
   ========================================================================== */

export function ExportActions({
  recordCount,
  onExportCsv,
  onExportPdf,
  onExportJson,
  onCopyToClipboard,
  onEmailExport,
  onScheduleExport,
  onOptionsChange,
  estimatedSizeBytes,
  filterSummary,
  variant = 'default',
}: Props) {
  /* ------------------------------ state ------------------------------ */

  const [exporting, setExporting] = useState<ExportFormat | null>(null)
  const [progress, setProgress] = useState(0)
  const [lastSuccess, setLastSuccess] = useState<ExportFormat | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [showMenu, setShowMenu] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [showConfirm, setShowConfirm] = useState<ExportFormat | null>(null)
  const [emailInput, setEmailInput] = useState('')

  const [options, setOptions] = useState<AdvancedOptions>({
    redactPii: false,
    includeFingerprints: true,
    includeMetadata: true,
  })

  const [history, setHistory] = useState<HistoryItem[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])

  /* ------------------------------ refs ------------------------------- */

  const menuRef = useRef<HTMLDivElement | null>(null)
  const menuButtonRef = useRef<HTMLButtonElement | null>(null)
  const successTimerRef = useRef<number | null>(null)
  const progressTimerRef = useRef<number | null>(null)
  const cancelledRef = useRef(false)

  /* ---------------------------- derived ------------------------------ */

  const disabled = recordCount === 0 || exporting !== null
  const sizeEstimate = useMemo(
    () => estimatedSizeBytes ?? recordCount * BYTES_PER_RECORD,
    [estimatedSizeBytes, recordCount],
  )
  const isCompact = variant === 'compact'
  const isLocked = exporting !== null && !showConfirm
  const shouldConfirm = recordCount > CONFIRM_THRESHOLD

  const canShowJson = Boolean(onExportJson)
  const canShowCopy = Boolean(onCopyToClipboard)
  const canShowEmail = Boolean(onEmailExport)
  const canShowSchedule = Boolean(onScheduleExport)
  const hasAdvancedActions = canShowJson || canShowCopy || canShowEmail || canShowSchedule

  /* --------------------------- effects ------------------------------- */

  // Notify parent when options change
  useEffect(() => {
    onOptionsChange?.(options)
  }, [options, onOptionsChange])

  // Click outside closes menu
  useEffect(() => {
    if (!showMenu) return
    const handler = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        menuButtonRef.current && !menuButtonRef.current.contains(target)
      ) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  // Escape closes overlays
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMenu(false)
        setShowConfirm(null)
        setShowEmailModal(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Cleanup timers on unmount
  useEffect(() => () => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
  }, [])

  /* --------------------------- helpers ------------------------------- */

  const pushToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = uid()
    setToasts((prev) => [...prev, { ...toast, id }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, TOAST_DURATION_MS)
  }, [])

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  const pushHistory = useCallback((item: Omit<HistoryItem, 'id'>) => {
    setHistory((prev) => [{ ...item, id: uid() }, ...prev].slice(0, HISTORY_MAX))
  }, [])

  const startProgress = useCallback(() => {
    if (progressTimerRef.current) window.clearInterval(progressTimerRef.current)
    setProgress(0)
    cancelledRef.current = false
    progressTimerRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p
        const step = p < 30 ? 8 : p < 60 ? 4 : 2
        return Math.min(90, p + step)
      })
    }, 180)
  }, [])

  const finishProgress = useCallback(async () => {
    if (progressTimerRef.current) {
      window.clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setProgress(100)
    await sleep(260)
    setProgress(0)
  }, [])

  const cancelOverlay = () => {
    cancelledRef.current = true
    pushToast({
      tone: 'info',
      title: 'Progress hidden',
      description: 'The export continues in the background.',
    })
  }

  /* ------------------------- export runner --------------------------- */

  const runExport = useCallback(
    async (
      format: ExportFormat,
      task: () => Promise<void>,
      displayLabel?: string,
    ) => {
      if (disabled) return
      setError(null)
      setExporting(format)
      startProgress()
      const startedAt = Date.now()

      try {
        await task()
        await finishProgress()

        if (cancelledRef.current) {
          pushHistory({
            format,
            recordCount,
            sizeBytes: sizeEstimate,
            at: Date.now(),
            status: 'error',
            durationMs: Date.now() - startedAt,
          })
          return
        }

        setLastSuccess(format)
        if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
        successTimerRef.current = window.setTimeout(
          () => setLastSuccess(null),
          SUCCESS_FEEDBACK_MS,
        )

        pushHistory({
          format,
          recordCount,
          sizeBytes: sizeEstimate,
          at: Date.now(),
          status: 'success',
          durationMs: Date.now() - startedAt,
        })

        const label = displayLabel ?? formatLabel(format)
        pushToast({
          tone: 'success',
          title: `${label} export ready`,
          description: `${recordCount.toLocaleString()} records · ${formatBytes(sizeEstimate)} · ${(
            (Date.now() - startedAt) / 1000
          ).toFixed(1)}s`,
        })
      } catch (err) {
        await finishProgress()
        const message = err instanceof Error ? err.message : 'Export failed'
        setError(message)
        pushHistory({
          format,
          recordCount,
          sizeBytes: sizeEstimate,
          at: Date.now(),
          status: 'error',
          durationMs: Date.now() - startedAt,
        })
        pushToast({ tone: 'error', title: 'Export failed', description: message })
      } finally {
        setExporting(null)
      }
    },
    [
      disabled, recordCount, sizeEstimate,
      startProgress, finishProgress, pushHistory, pushToast,
    ],
  )

  /* --------------------------- handlers ------------------------------ */

  function proceedWithExport(format: ExportFormat) {
    setShowConfirm(null)
    if (format === 'csv') void runExport('csv', onExportCsv)
    else if (format === 'pdf') void runExport('pdf', onExportPdf)
    else if (format === 'json') {
      if (!onExportJson) return
      void runExport('json', onExportJson)
    } else if (format === 'copy') {
      if (!onCopyToClipboard) return
      void runExport('copy', onCopyToClipboard, 'Clipboard')
    }
  }

  function handleExport(format: ExportFormat) {
    if (disabled) return
    if (shouldConfirm && (format === 'csv' || format === 'pdf')) {
      setShowConfirm(format)
      return
    }
    proceedWithExport(format)
  }

  function handleEmail() {
    if (!onEmailExport) return
    const email = emailInput.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      pushToast({
        tone: 'error',
        title: 'Invalid email',
        description: 'Enter a valid delivery address.',
      })
      return
    }
    setShowEmailModal(false)
    setEmailInput('')
    void runExport('email', () => onEmailExport(email), 'Email')
  }

  async function handleSchedule(freq: ScheduleFrequency) {
    if (!onScheduleExport) return
    try {
      await onScheduleExport(freq)
      pushToast({
        tone: 'success',
        title: `Scheduled ${freq}`,
        description: `Recurring export scheduled ${freq}.`,
      })
      setShowMenu(false)
    } catch (err) {
      pushToast({
        tone: 'error',
        title: 'Schedule failed',
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  /* -------------------- keyboard shortcuts --------------------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.code !== 'KeyE') return
      if (disabled) return
      e.preventDefault()
      if (e.shiftKey) {
        if (recordCount > CONFIRM_THRESHOLD) {
          setShowConfirm('pdf')
        } else {
          void runExport('pdf', onExportPdf)
        }
      } else {
        if (recordCount > CONFIRM_THRESHOLD) {
          setShowConfirm('csv')
        } else {
          void runExport('csv', onExportCsv)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [disabled, recordCount, runExport, onExportCsv, onExportPdf])

  /* ------------------------------ render ----------------------------- */

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <style>{ANIMATIONS}</style>

      {/* Count + size badge */}
      {recordCount > 0 && !isCompact ? (
        <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-border bg-surface-alt/60 px-2.5 py-1.5 text-[11px] font-medium text-ink-secondary">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald ea-pulse-dot" aria-hidden="true" />
          <span>{recordCount.toLocaleString()} records</span>
          <span className="text-ink-muted/60">·</span>
          <span className="text-ink-muted">~{formatBytes(sizeEstimate)}</span>
        </div>
      ) : null}

      {/* CSV — original preserved */}
      <button
        type="button"
        onClick={() => handleExport('csv')}
        disabled={disabled}
        title="Export CSV (Ctrl/Cmd + E)"
        className="ea-shimmer inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-ink hover:border-emerald hover:text-emerald transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {exporting === 'csv' ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : lastSuccess === 'csv' ? (
          <Check size={14} className="text-emerald ea-pop" aria-hidden="true" />
        ) : (
          <Download size={14} aria-hidden="true" />
        )}
        {exporting === 'csv' ? (
          <span className="tabular-nums">{progress}%</span>
        ) : lastSuccess === 'csv' ? (
          'Exported'
        ) : (
          'Export CSV'
        )}
      </button>

      {/* PDF — original preserved */}
      <button
        type="button"
        onClick={() => handleExport('pdf')}
        disabled={disabled}
        title="Export PDF (Ctrl/Cmd + Shift + E)"
        className="ea-shimmer inline-flex items-center gap-2 rounded-lg bg-emerald px-3.5 py-2 text-sm font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {exporting === 'pdf' ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : lastSuccess === 'pdf' ? (
          <Check size={14} className="ea-pop" aria-hidden="true" />
        ) : (
          <FileText size={14} aria-hidden="true" />
        )}
        {exporting === 'pdf' ? (
          <span className="tabular-nums">{progress}%</span>
        ) : lastSuccess === 'pdf' ? (
          'Exported'
        ) : (
          'Export PDF'
        )}
      </button>

      {/* More menu trigger */}
      <button
        ref={menuButtonRef}
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={showMenu}
        aria-label="More export options"
        className="inline-flex items-center justify-center rounded-lg border border-border bg-surface p-2 text-ink-secondary hover:text-ink hover:border-ink-muted transition-colors disabled:opacity-40"
        disabled={exporting !== null}
      >
        <MoreVertical size={14} aria-hidden="true" />
      </button>

      {/* More menu dropdown */}
      {showMenu ? (
        <div
          ref={menuRef}
          role="menu"
          className="ea-slide-in absolute right-0 top-full z-40 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-black/10"
        >
          {/* Quick actions */}
          <div className="p-1.5">
            {canShowJson ? (
              <MenuItem
                icon={<FileJson size={14} className="text-amber-500" />}
                label="Export JSON"
                hint="Machine-readable"
                onClick={() => { setShowMenu(false); proceedWithExport('json') }}
              />
            ) : null}
            {canShowCopy ? (
              <MenuItem
                icon={<Copy size={14} className="text-sky-500" />}
                label="Copy to clipboard"
                hint="Paste anywhere"
                onClick={() => { setShowMenu(false); proceedWithExport('copy') }}
              />
            ) : null}
            {canShowEmail ? (
              <MenuItem
                icon={<Mail size={14} className="text-violet-500" />}
                label="Email export"
                hint="Deliver to inbox"
                onClick={() => { setShowMenu(false); setShowEmailModal(true) }}
              />
            ) : null}

            {canShowSchedule ? (
              <>
                <div className="my-1 h-px bg-border" role="separator" />
                <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                  Schedule recurring
                </div>
                <MenuItem
                  icon={<Calendar size={14} className="text-emerald" />}
                  label="Daily"
                  hint="Every 24h"
                  onClick={() => void handleSchedule('daily')}
                />
                <MenuItem
                  icon={<Calendar size={14} className="text-emerald" />}
                  label="Weekly"
                  hint="Every Monday"
                  onClick={() => void handleSchedule('weekly')}
                />
                <MenuItem
                  icon={<Calendar size={14} className="text-emerald" />}
                  label="Monthly"
                  hint="1st of month"
                  onClick={() => void handleSchedule('monthly')}
                />
              </>
            ) : null}

            {!hasAdvancedActions ? (
              <div className="px-2 py-2 text-xs text-ink-muted">
                No extra formats configured
              </div>
            ) : null}
          </div>

          {/* Advanced options */}
          <div className="border-t border-border">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-ink-secondary hover:bg-surface-alt transition-colors"
              aria-expanded={showAdvanced}
            >
              <span className="flex items-center gap-2">
                <Settings2 size={14} aria-hidden="true" />
                Advanced options
              </span>
              <ChevronRight
                size={14}
                className={`transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
                aria-hidden="true"
              />
            </button>
            {showAdvanced ? (
              <div className="ea-fade-up space-y-1 px-3 pb-3">
                <ToggleRow
                  label="Redact PII"
                  description="Strip emails, IPs, phones, NINs"
                  icon={<Shield size={12} />}
                  checked={options.redactPii}
                  onChange={(v) => setOptions((o) => ({ ...o, redactPii: v }))}
                />
                <ToggleRow
                  label="Include fingerprints"
                  description="Tamper-evident hashes per row"
                  icon={<ShieldCheck size={12} />}
                  checked={options.includeFingerprints}
                  onChange={(v) => setOptions((o) => ({ ...o, includeFingerprints: v }))}
                />
                <ToggleRow
                  label="Include metadata"
                  description="Filter summary & export timestamp"
                  icon={<Sparkles size={12} />}
                  checked={options.includeMetadata}
                  onChange={(v) => setOptions((o) => ({ ...o, includeMetadata: v }))}
                />
              </div>
            ) : null}
          </div>

          {/* History */}
          {history.length > 0 ? (
            <div className="border-t border-border">
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-xs font-semibold text-ink-secondary hover:bg-surface-alt transition-colors"
                aria-expanded={showHistory}
              >
                <span className="flex items-center gap-2">
                  <Clock size={14} aria-hidden="true" />
                  Recent exports ({history.length})
                </span>
                <ChevronRight
                  size={14}
                  className={`transition-transform ${showHistory ? 'rotate-90' : ''}`}
                  aria-hidden="true"
                />
              </button>
              {showHistory ? (
                <div className="ea-fade-up space-y-1 px-2 pb-2">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-surface-alt transition-colors"
                    >
                      {item.status === 'success' ? (
                        <CheckCircle2 size={12} className="shrink-0 text-emerald" aria-hidden="true" />
                      ) : (
                        <AlertCircle size={12} className="shrink-0 text-danger" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-ink">
                          {formatLabel(item.format)} · {item.recordCount} records
                        </div>
                        <div className="truncate text-[10px] text-ink-muted">
                          {formatBytes(item.sizeBytes)} ·{' '}
                          {Math.round(item.durationMs / 100) / 10}s · {timeAgo(item.at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Progress overlay */}
      {exporting ? (
        <div className="ea-slide-in fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/15">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <Loader2 size={14} className="shrink-0 animate-spin text-emerald" aria-hidden="true" />
              <span className="truncate text-sm font-semibold text-ink">
                Exporting {formatLabel(exporting)}…
              </span>
            </div>
            <button
              type="button"
              onClick={cancelOverlay}
              className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
              aria-label="Hide progress"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="px-4 py-3">
            <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
              <div
                className="h-full rounded-full bg-emerald transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px] text-ink-muted">
              <span>
                {recordCount.toLocaleString()} records · ~{formatBytes(sizeEstimate)}
              </span>
              <span className="tabular-nums font-semibold text-ink-secondary">{progress}%</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Confirmation dialog for large exports */}
      {showConfirm ? (
        <div
          className="ea-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <div className="ea-pop w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Zap size={16} aria-hidden="true" />
              </div>
              <div>
                <h3 id="confirm-title" className="text-sm font-semibold text-ink">
                  Large export
                </h3>
                <p className="text-xs text-ink-muted">This may take a moment</p>
              </div>
            </div>
            <p className="mb-4 text-sm text-ink-secondary">
              You&apos;re about to export{' '}
              <strong className="text-ink">{recordCount.toLocaleString()} records</strong> (~
              {formatBytes(sizeEstimate)}) as {formatLabel(showConfirm)}. Continue?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirm(null)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => proceedWithExport(showConfirm)}
                className="rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
              >
                Continue export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Email modal */}
      {showEmailModal ? (
        <div
          className="ea-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-title"
        >
          <div className="ea-pop w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 id="email-title" className="text-sm font-semibold text-ink">
                Email export
              </h3>
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X size={14} />
              </button>
            </div>
            <label
              htmlFor="export-email"
              className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-secondary"
            >
              Recipient email
            </label>
            <input
              id="export-email"
              type="email"
              autoFocus
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEmail()
              }}
              placeholder="you@harkeyzride.dev"
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
            />
            <p className="mt-2 text-[11px] text-ink-muted">
              {recordCount.toLocaleString()} records · ~{formatBytes(sizeEstimate)} will be delivered.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowEmailModal(false)}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmail}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
              >
                <Mail size={12} aria-hidden="true" />
                Send export
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Toast stack */}
      <div className="pointer-events-none fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`ea-slide-in pointer-events-auto flex w-80 items-start gap-2 rounded-lg border px-3 py-2.5 shadow-lg ${
              t.tone === 'success'
                ? 'border-emerald/30 bg-emerald/5 text-emerald-dark'
                : t.tone === 'error'
                  ? 'border-red-200 bg-red-50 text-danger'
                  : 'border-border bg-surface text-ink-secondary'
            }`}
            role="status"
            aria-live="polite"
          >
            {t.tone === 'success' ? (
              <CheckCircle2 size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : t.tone === 'error' ? (
              <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            ) : (
              <Sparkles size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold">{t.title}</div>
              {t.description ? (
                <div className="text-[11px] opacity-80">{t.description}</div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="rounded-md p-0.5 opacity-60 hover:opacity-100 transition-opacity"
              aria-label="Dismiss"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
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
  onClick,
}: {
  icon: React.ReactNode
  label: string
  hint?: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-ink-secondary hover:bg-surface-alt hover:text-ink transition-colors"
      role="menuitem"
    >
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {hint ? <span className="text-[10px] text-ink-muted">{hint}</span> : null}
    </button>
  )
}

function ToggleRow({
  label,
  description,
  icon,
  checked,
  onChange,
}: {
  label: string
  description: string
  icon: React.ReactNode
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 rounded-md px-1 py-1 hover:bg-surface-alt transition-colors">
      <span className="mt-0.5 text-ink-muted">{icon}</span>
      <span className="flex-1">
        <span className="block text-[11px] font-semibold text-ink">{label}</span>
        <span className="block text-[10px] leading-snug text-ink-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-3.5 w-3.5 rounded border-border accent-emerald focus:ring-2 focus:ring-emerald/30"
      />
    </label>
  )
}