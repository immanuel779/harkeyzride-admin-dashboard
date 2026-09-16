import { useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'

import { cn } from '../../lib/cn'
import { EmptyState } from './EmptyState'
import { Skeleton } from './Skeleton'

export type DataTableColumn<T> = {
  key: string
  header: string
  render?: (row: T) => ReactNode
  accessor?: (row: T) => string | number
  sortable?: boolean
  className?: string
  headerClassName?: string
}

export type DataTableFilter<T> = {
  key: string
  label: string
  options: { value: string; label: string }[]
  apply: (row: T, value: string) => boolean
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
}: Props<T>) {
  const [query, setQuery] = useState('')
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(filters.map((f) => [f.key, 'all'])),
  )
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>('asc')
  const [page, setPage] = useState(1)

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

  const hasToolbar = title || searchable || filters.length > 0 || toolbarRight

  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      {hasToolbar ? (
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 p-4 border-b border-border">
          {title ? (
            <h3 className="text-sm font-semibold text-ink lg:mr-auto">{title}</h3>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            {filters.map((f) => (
              <select
                key={f.key}
                value={filterValues[f.key]}
                onChange={(e) => {
                  setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))
                  setPage(1)
                }}
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
              <div className="flex items-center gap-2 rounded-lg border border-border bg-canvas px-3 py-2 min-w-[200px]">
                <Search size={14} className="text-ink-muted" />
                <input
                  type="text"
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setPage(1)
                  }}
                  className="flex-1 bg-transparent text-xs text-ink placeholder:text-ink-muted focus:outline-none"
                />
              </div>
            ) : null}

            {toolbarRight}
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-alt/40">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'text-left font-semibold text-ink-secondary text-xs uppercase tracking-wider px-4 py-3 whitespace-nowrap',
                    col.sortable ? 'cursor-pointer select-none hover:text-ink' : '',
                    col.headerClassName,
                  )}
                  onClick={() => handleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key ? (
                      sortDir === 'asc' ? (
                        <ChevronUp size={12} />
                      ) : (
                        <ChevronDown size={12} />
                      )
                    ) : null}
                  </span>
                </th>
              ))}
              {actions ? (
                <th className="text-right font-semibold text-ink-secondary text-xs uppercase tracking-wider px-4 py-3 w-1">
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {columns.map((col) => (
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
                <td colSpan={columns.length + (actions ? 1 : 0)}>
                  <EmptyState title={emptyMessage} />
                </td>
              </tr>
            ) : (
              pageRows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-border last:border-b-0 transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-surface-alt/50' : '',
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-4 py-3 text-ink align-middle', col.className)}
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
              ))
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
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs text-ink-secondary px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-border hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}