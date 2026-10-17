import { useEffect, useRef, useState } from 'react'
import { Columns3, Eye, EyeOff } from 'lucide-react'

import { cn } from '../../lib/cn'

type Props = {
  columns: { key: string; header: string }[]
  hidden: Set<string>
  onToggle: (key: string) => void
  onShowAll: () => void
}

export function ColumnVisibilityMenu({
  columns,
  hidden,
  onToggle,
  onShowAll,
}: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const t = setTimeout(() => {
      document.addEventListener('mousedown', onClick)
    }, 0)
    return () => {
      clearTimeout(t)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium transition-colors',
          open
            ? 'border-emerald text-emerald'
            : 'text-ink-secondary hover:text-ink hover:border-border-strong',
        )}
        aria-label="Column visibility"
        aria-expanded={open}
      >
        <Columns3 size={13} aria-hidden="true" />
        Columns
        {hidden.size > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-amber-50 text-warning text-[10px] font-bold px-1">
            {columns.length - hidden.size}/{columns.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full mt-2 w-56 rounded-xl bg-surface border border-border shadow-2xl overflow-hidden z-40"
          role="dialog"
          aria-label="Column visibility"
        >
          <div className="px-3 py-2 border-b border-border flex items-center justify-between">
            <span className="text-[11px] font-semibold text-ink-secondary uppercase tracking-wide">
              Toggle columns
            </span>
            {hidden.size > 0 ? (
              <button
                type="button"
                onClick={onShowAll}
                className="text-[11px] text-emerald hover:underline font-medium"
              >
                Show all
              </button>
            ) : null}
          </div>

          <div className="max-h-64 overflow-y-auto p-1">
            {columns.map((col) => {
              const isHidden = hidden.has(col.key)
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={() => onToggle(col.key)}
                  className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-ink hover:bg-surface-alt transition-colors"
                >
                  {isHidden ? (
                    <EyeOff size={13} className="text-ink-muted" aria-hidden="true" />
                  ) : (
                    <Eye size={13} className="text-emerald" aria-hidden="true" />
                  )}
                  <span className={cn('flex-1 text-left', isHidden && 'text-ink-muted')}>
                    {col.header}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}