import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Download,
} from 'lucide-react'

import { cn } from '../../lib/cn'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'
import { SavedViewsMenu } from './SavedViewsMenu'
import { ColumnVisibilityMenu } from './ColumnVisibilityMenu'
import { useSavedViews, type SavedView } from '../../hooks/useSavedViews'

export type DataTableColumn<T> = {
  key: string
  header: string
  render?: (row: T) => ReactNode
  accessor?: (row: T) => string | number
  sortable?: boolean
  className?: string
  headerClassName?: string
  hideable?: boolean
}

export type DataTableFilter<T> = {
  key: string
  label: string
  options: { value: string; label: string }[]
  apply: (row: T, value: string) => boolean
}

export type BulkAction<T> = {
  key: string
  label: string
  tone?: 'default' | 'primary' | 'danger'
  onRun: (rows: T[]) => Promise<void> | void
}

type SortDirection = 'asc' | 'desc'

type Props<T> = {
  data: T[]
  columns: DataTableColumn<T>[]
  rowKey: (row: T) => string
  filters?: DataTableFilter<T>[]
  searchable?: boolean
  searchPlaceholder?: string
  searchFn?: (row: T, query: string) => boolean
  pageSize?: number
  loading?: boolean
  emptyMessage?: string
  onRowClick?: (row: T) => void
  actions?: (row: T) => ReactNode
  title?: string
  toolbarRight?: ReactNode
  selectable?: boolean
  bulkActions?: BulkAction<T>[]
  isRowSelectable?: (row: T) => boolean
  viewKey?: string
  exportFileName?: string
}

const HIDDEN_COLS_PREFIX = 'harkeyzride.hiddencols.'

function loadHiddenCols(viewKey: string | undefined): Set<string> {
  if (!viewKey) return new Set()
  try {
    const raw = localStorage.getItem(`${HIDDEN_COLS_PREFIX}${viewKey}`)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveHiddenCols(viewKey: string | undefined, hidden: Set<string>) {
  if (!viewKey) return
  try {
    localStorage.setItem(
      `${HIDDEN_COLS_PREFIX}${viewKey}`,
      JSON.stringify(Array.from(hidden)),
    )
  } catch {
    // ignore
  }
}

export function DataTable<T>({
  data,
  columns,
  rowKey,
  filters = [],
  searchable = true,
  searchPlaceholder = 'Search…',
  searchFn,
  pageSize = 10,
  loading = false,
  emptyMessage = 'No records found',
  onRowClick,
  actions,
  title,
  toolbarRight,
  selectable = false,
  bulkActions = [],
  isRowSelectable,
  viewKey,
  exportFileName,
}: Props<T>) {
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.key, 'all'])),
  )
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkRunning, setBulkRunning] = useState<string | null>(null)
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() =>
    loadHiddenCols(viewKey),
  )

  const savedViews = useSavedViews(viewKey)

  useEffect(() => {
    setHiddenCols(loadHiddenCols(viewKey))
  }, [viewKey])

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.key)),
    [columns, hiddenCols],
  )

  const filtered = useMemo(() => {
    let rows = data

    if (query.trim() && searchFn) {
      const q = query.trim().toLowerCase()
      rows = rows.filter((row) => searchFn(row, q))
    } else if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter((row) =>
        columns.some((col) => {
          const val = col.accessor?.(row)
          return val !== undefined && String(val).toLowerCase().includes(q)
        }),
      )
    }

    filters.forEach((f) => {
      const value = filterValues[f.key]
      if (value && value !== 'all') {
        rows = rows.filter((row) => f.apply(row, value))
      }
    })

    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey)
      if (col?.accessor) {
        rows = [...rows].sort((a, b) => {
          const av = col.accessor!(a)
          const bv = col.accessor!(b)
          if (av < bv) return sortDir === 'asc' ? -1 : 1
          if (av > bv) return sortDir === 'asc' ? 1 : -1
          return 0
        })
      }
    }

    return rows
  }, [data, columns, filters, filterValues, query, searchFn, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const pageRows = filtered.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return
    if (sortKey === col.key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col.key)
      setSortDir('asc')
    }
  }

  const selectableRows = useMemo(() => {
    if (!selectable) return []
    return isRowSelectable ? pageRows.filter(isRowSelectable) : pageRows
  }, [selectable, pageRows, isRowSelectable])

  const allOnPageSelected =
    selectableRows.length > 0 &&
    selectableRows.every((r) => selectedIds.has(rowKey(r)))

  const toggleRow = (row: T) => {
    const key = rowKey(row)
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleAllOnPage = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        selectableRows.forEach((r) => next.delete(rowKey(r)))
      } else {
        selectableRows.forEach((r) => next.add(rowKey(r)))
      }
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectedRows = useMemo(
    () => data.filter((row) => selectedIds.has(rowKey(row))),
    [data, selectedIds, rowKey],
  )

  const handleBulkAction = async (action: BulkAction<T>) => {
    if (bulkRunning) return
    setBulkRunning(action.key)
    try {
      await action.onRun(selectedRows)
      clearSelection()
    } finally {
      setBulkRunning(null)
    }
  }

  // ---------- Saved Views ----------

  const applyView = (view: SavedView) => {
    setQuery(view.query)
    setFilterValues((prev) => ({ ...prev, ...view.filters }))
    setSortKey(view.sortKey)
    setSortDir(view.sortDir)
    setPage(1)
  }

  const saveCurrentView = (name: string) => {
    if (!viewKey) return
    savedViews.add({
      name,
      query,
      filters: filterValues,
      sortKey,
      sortDir,
    })
  }

  const hasActiveState =
    query.trim().length > 0 ||
    Object.values(filterValues).some((v) => v && v !== 'all') ||
    sortKey !== null

  // ---------- Column visibility ----------

  const toggleCol = (key: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveHiddenCols(viewKey, next)
      return next
    })
  }

  const showAllCols = () => {
    const empty = new Set<string>()
    setHiddenCols(empty)
    saveHiddenCols(viewKey, empty)
  }

  // ---------- CSV export ----------

  const exportCsv = () => {
    const cols = visibleColumns.filter((c) => c.accessor || c.render)
    const header = cols.map((c) => `"${c.header}"`).join(',')

    const rows = filtered.map((row) =>
      cols
        .map((col) => {
          const raw = col.accessor ? col.accessor(row) : ''
          const str = String(raw ?? '')
          const escaped = str.replace(/"/g, '""')
          return `"${escaped}"`
        })
        .join(','),
    )

    const csv = [header, ...rows].join('\n')
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${exportFileName ?? 'export'}-${new Date()
      .toISOString()
      .slice(0, 19)
      .replace(/[:.]/g, '-')}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  const hasToolbar =
    title ||
    searchable ||
    filters.length > 0 ||
    toolbarRight ||
    selectable ||
    viewKey
  const showCheckboxColumn = selectable

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden relative">
      {hasToolbar ? (
        <div className="flex flex-col gap-3 p-4 border-b border-border">
          {/* Top row: title */}
          {title ? (
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">{title}</h3>
              <span className="text-[11px] text-ink-muted">
                {filtered.length} {filtered.length === 1 ? 'row' : 'rows'}
              </span>
            </div>
          ) : null}

          {/* Bottom row: filters + search + actions */}
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <select
                key={f.key}
                value={filterValues[f.key]}
                onChange={(e) => {
                  setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))
                  setPage(1)
                }}
                aria-label={`Filter by ${f.label}`}
                className="rounded-lg border border-border bg-surface px-3 py-2 text-xs text-ink focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20"
              >
                <option value="all">{f.label}: All</option>
                {f.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {f.label}: {opt.label}
                  </option>
                ))}
              </select>
            ))}

            {searchable ? (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 min-w-[200px] flex-1 sm:flex-initial">
                <Search
                  size={14}
                  className="text-ink-muted"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  aria-label="Search table"
                  className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
                />
              </div>
            ) : null}

            <div className="ml-auto flex items-center gap-2 flex-wrap">
              {columns.length > 2 ? (
                <ColumnVisibilityMenu
                  columns={columns.map((c) => ({ key: c.key, header: c.header }))}
                  hidden={hiddenCols}
                  onToggle={toggleCol}
                  onShowAll={showAllCols}
                />
              ) : null}

              {filtered.length > 0 ? (
                <button
                  type="button"
                  onClick={exportCsv}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-medium text-ink-secondary hover:text-ink hover:border-border-strong transition-colors"
                  aria-label="Export CSV"
                >
                  <Download size={13} aria-hidden="true" />
                  Export
                </button>
              ) : null}

              {viewKey ? (
                <SavedViewsMenu
                  views={savedViews.views}
                  hasActiveState={hasActiveState}
                  onLoad={applyView}
                  onSave={saveCurrentView}
                  onDelete={savedViews.remove}
                />
              ) : null}

              {toolbarRight}
            </div>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt/40">
              {showCheckboxColumn ? (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    aria-label="Select all rows on this page"
                    className="w-4 h-4 rounded border-border-strong text-emerald focus:ring-emerald/40 cursor-pointer"
                  />
                </th>
              ) : null}

              {visibleColumns.map((col) => {
                const isSorted = sortKey === col.key
                return (
                  <th
                    key={col.key}
                    scope="col"
                    tabIndex={col.sortable ? 0 : undefined}
                    aria-sort={
                      col.sortable && isSorted
                        ? sortDir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : undefined
                    }
                    onClick={() => handleSort(col)}
                    onKeyDown={(e) => {
                      if (
                        col.sortable &&
                        (e.key === 'Enter' || e.key === ' ')
                      ) {
                        e.preventDefault()
                        handleSort(col)
                      }
                    }}
                    className={cn(
                      'text-left font-semibold text-ink-secondary text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap',
                      col.sortable
                        ? 'cursor-pointer select-none hover:text-ink'
                        : '',
                      col.headerClassName,
                    )}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.header}
                      {col.sortable && isSorted ? (
                        sortDir === 'asc' ? (
                          <ChevronUp size={12} aria-hidden="true" />
                        ) : (
                          <ChevronDown size={12} aria-hidden="true" />
                        )
                      ) : null}
                    </span>
                  </th>
                )
              })}
              {actions ? (
                <th
                  scope="col"
                  className="text-right font-semibold text-ink-secondary text-xs uppercase tracking-wider px-4 py-3 w-1"
                >
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {showCheckboxColumn ? (
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  ) : null}
                  {visibleColumns.map((col) => (
                    <td key={col.key} className="px-4 py-4">
                      <Skeleton className="h-3 w-3/4" />
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-4 py-4">
                      <Skeleton className="h-3 w-12 ml-auto" />
                    </td>
                  ) : null}
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={
                    visibleColumns.length +
                    (actions ? 1 : 0) +
                    (showCheckboxColumn ? 1 : 0)
                  }
                >
                  <EmptyState title={emptyMessage} />
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const key = rowKey(row)
                const isSelected = selectedIds.has(key)
                const canSelect = !isRowSelectable || isRowSelectable(row)

                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'border-b border-border last:border-b-0 transition-colors',
                      onRowClick ? 'cursor-pointer hover:bg-surface-alt/50' : '',
                      isSelected ? 'bg-emerald-light/30' : '',
                    )}
                  >
                    {showCheckboxColumn ? (
                      <td
                        className="px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {canSelect ? (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRow(row)}
                            aria-label="Select row"
                            className="w-4 h-4 rounded border-border-strong text-emerald focus:ring-emerald/40 cursor-pointer"
                          />
                        ) : null}
                      </td>
                    ) : null}

                    {visibleColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-ink align-middle',
                          col.className,
                        )}
                      >
                        {col.render
                          ? col.render(row)
                          : col.accessor
                            ? col.accessor(row)
                            : null}
                      </td>
                    ))}
                    {actions ? (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {actions(row)}
                      </td>
                    ) : null}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && filtered.length > 0 ? (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-border bg-surface-alt/30">
          <span className="text-xs text-ink-secondary">
            Showing{' '}
            <span className="font-medium text-ink">
              {(currentPage - 1) * pageSize + 1}–
              {Math.min(currentPage * pageSize, filtered.length)}
            </span>{' '}
            of <span className="font-medium text-ink">{filtered.length}</span>
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
            <span
              className="text-xs text-ink-secondary px-2"
              aria-live="polite"
            >
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      {selectable && selectedIds.size > 0 && bulkActions.length > 0 ? (
        <div className="sticky bottom-4 left-0 right-0 px-4 pointer-events-none">
          <div className="max-w-2xl mx-auto rounded-xl bg-navy text-white shadow-2xl border border-white/10 px-4 py-3 flex items-center gap-3 pointer-events-auto">
            <span className="text-sm font-semibold whitespace-nowrap">
              {selectedIds.size} selected
            </span>

            <div className="flex-1 flex items-center gap-2 overflow-x-auto">
              {bulkActions.map((action) => (
                <button
                  key={action.key}
                  type="button"
                  onClick={() => handleBulkAction(action)}
                  disabled={!!bulkRunning}
                  className={cn(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
                    action.tone === 'danger'
                      ? 'bg-danger hover:bg-danger/90 text-white'
                      : action.tone === 'primary'
                        ? 'bg-emerald hover:bg-emerald-dark text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white',
                  )}
                >
                  {bulkRunning === action.key ? 'Working…' : action.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={clearSelection}
              disabled={!!bulkRunning}
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40"
              aria-label="Clear selection"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}