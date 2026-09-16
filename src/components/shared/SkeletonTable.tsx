import { Skeleton } from './Skeleton'

type Props = {
  rows?: number
  columns?: number
}

export function SkeletonTable({ rows = 5, columns = 5 }: Props) {
  return (
    <div className="rounded-xl bg-surface border border-border overflow-hidden">
      {/* Header skeleton */}
      <div className="flex items-center gap-4 p-4 border-b border-border bg-surface-alt/40">
        <Skeleton className="h-4 w-40" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>

      {/* Rows skeleton */}
      <div>
        {Array.from({ length: rows }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-4 border-b border-border last:border-b-0"
          >
            {Array.from({ length: columns }).map((__, j) => (
              <Skeleton
                key={j}
                className={cn(
                  'h-3',
                  j === 0 ? 'w-40' : 'w-24',
                  j === columns - 1 && 'ml-auto w-16',
                )}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}