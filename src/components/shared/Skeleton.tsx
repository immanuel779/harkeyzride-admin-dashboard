import { cn } from '../../lib/cn'

type Props = {
  className?: string
  variant?: 'text' | 'circle' | 'rect'
}

export function Skeleton({ className, variant = 'rect' }: Props) {
  return (
    <div
      className={cn(
        'animate-pulse bg-surface-alt',
        variant === 'text' && 'h-3 rounded',
        variant === 'circle' && 'rounded-full',
        variant === 'rect' && 'rounded-lg',
        className,
      )}
    />
  )
}