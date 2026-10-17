import { useEffect, useRef, useState } from 'react'
import { Bookmark, Save, Trash2, X, Check } from 'lucide-react'

import { cn } from '../../lib/cn'
import type { SavedView } from '../../hooks/useSavedViews'

type Props = {
  views: SavedView[]
  hasActiveState: boolean
  onLoad: (view: SavedView) => void
  onSave: (name: string) => void
  onDelete: (id: string) => void
}

export function SavedViewsMenu({
  views,
  hasActiveState,
  onLoad,
  onSave,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSaving(false)
        setName('')
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

  const handleSaveSubmit = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName('')
    setSaving(false)
  }

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
        aria-label="Saved views"
        aria-expanded={open}
      >
        <Bookmark size={13} aria-hidden="true" />
        Views
        {views.length > 0 ? (
          <span className="inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-emerald-light text-emerald text-[10px] font-bold px-1">
            {views.length}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-surface border border-border shadow-2xl overflow-hidden z-40"
          role="dialog"
          aria-label="Saved views"
        >
          {saving ? (
            <div className="p-3 border-b border-border bg-surface-alt/40">
              <label className="block text-[11px] font-semibold text-ink-secondary uppercase tracking-wide mb-1.5">
                Save current view as
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveSubmit()
                    if (e.key === 'Escape') {
                      setSaving(false)
                      setName('')
                    }
                  }}
                  placeholder="e.g. Pending in Ibadan"
                  className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSaveSubmit}
                  disabled={!name.trim()}
                  className="p-1.5 rounded-md bg-emerald text-white hover:bg-emerald-dark transition-colors disabled:opacity-40"
                  aria-label="Save"
                >
                  <Check size={12} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSaving(false)
                    setName('')
                  }}
                  className="p-1.5 rounded-md border border-border text-ink-secondary hover:bg-surface-alt transition-colors"
                  aria-label="Cancel"
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2 border-b border-border">
              <button
                type="button"
                onClick={() => setSaving(true)}
                disabled={!hasActiveState}
                title={
                  hasActiveState
                    ? 'Save current filters and search'
                    : 'Apply filters or search to save a view'
                }
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-ink hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save size={13} aria-hidden="true" />
                Save current view
              </button>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {views.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Bookmark
                  size={20}
                  className="mx-auto text-ink-muted mb-2"
                  aria-hidden="true"
                />
                <p className="text-[11px] text-ink-secondary">
                  No saved views yet.
                </p>
              </div>
            ) : (
              views.map((view) => (
                <div
                  key={view.id}
                  className="flex items-center gap-2 px-2 py-1 hover:bg-surface-alt/60 group"
                >
                  <button
                    type="button"
                    onClick={() => {
                      onLoad(view)
                      setOpen(false)
                    }}
                    className="flex-1 text-left min-w-0 px-1 py-1.5"
                  >
                    <div className="text-xs font-medium text-ink truncate">
                      {view.name}
                    </div>
                    <div className="text-[10px] text-ink-muted truncate mt-0.5">
                      {[
                        view.query ? `"${view.query}"` : null,
                        Object.entries(view.filters)
                          .filter(([, v]) => v && v !== 'all')
                          .map(([k, v]) => `${k}:${v}`)
                          .join(', ') || null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'No filters'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(view.id)
                    }}
                    className="p-1.5 rounded-md text-ink-muted hover:bg-red-50 hover:text-danger transition-colors opacity-0 group-hover:opacity-100"
                    aria-label={`Delete view ${view.name}`}
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}