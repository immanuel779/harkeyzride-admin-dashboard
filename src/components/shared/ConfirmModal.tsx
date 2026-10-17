import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type Props = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'primary' | 'danger'
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
  children?: ReactNode
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onClose,
  children,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  // Escape key + body scroll lock + focus management
  useEffect(() => {
    if (!open) return

    const previousFocus = document.activeElement as HTMLElement | null
    document.body.style.overflow = 'hidden'

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) onClose()
    }
    document.addEventListener('keydown', onKey)

    // Focus the confirm button when opening
    setTimeout(() => confirmButtonRef.current?.focus(), 50)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      previousFocus?.focus?.()
    }
  }, [open, loading, onClose])

  if (!open) return null

  return (
       <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      aria-describedby={description ? 'modal-desc' : undefined}
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={loading ? undefined : onClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
               className="relative w-full max-w-md rounded-2xl bg-surface border border-border shadow-xl max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-1 rounded-lg text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors disabled:opacity-40"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          <h3 id="modal-title" className="text-lg font-semibold text-ink mb-2">
            {title}
          </h3>
          {description ? (
            <p id="modal-desc" className="text-sm text-ink-secondary mb-4">
              {description}
            </p>
          ) : null}

          {children ? <div className="mb-6">{children}</div> : null}

          <div className="flex items-center justify-end gap-2 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-ink hover:bg-surface-alt transition-colors disabled:opacity-40"
            >
              {cancelLabel}
            </button>
            <button
              ref={confirmButtonRef}
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors disabled:opacity-60 ${
                variant === 'danger'
                  ? 'bg-danger hover:bg-danger/90'
                  : 'bg-emerald hover:bg-emerald-dark'
              }`}
            >
              {loading ? 'Working…' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}