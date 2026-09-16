import { forwardRef, type InputHTMLAttributes } from 'react'

import { cn } from '../../../lib/cn'

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  hint?: string
  error?: string
  prefix?: string
  suffix?: string
}

export const FormField = forwardRef<HTMLInputElement, Props>(function FormField(
  { label, hint, error, prefix, suffix, className, ...rest },
  ref,
) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-1.5">
        {label}
      </label>

      <div
        className={cn(
          'flex items-center rounded-lg border bg-surface transition-colors overflow-hidden',
          error ? 'border-danger' : 'border-border focus-within:border-emerald focus-within:ring-2 focus-within:ring-emerald/20',
        )}
      >
        {prefix ? (
          <span className="pl-3 pr-1 text-sm text-ink-secondary font-medium">
            {prefix}
          </span>
        ) : null}
        <input
          ref={ref}
          className={cn(
            'flex-1 bg-transparent px-3 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:outline-none',
            prefix && 'pl-1',
            className,
          )}
          {...rest}
        />
        {suffix ? (
          <span className="pl-1 pr-3 text-xs text-ink-muted font-medium">
            {suffix}
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-xs text-danger mt-1.5">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-muted mt-1.5">{hint}</p>
      ) : null}
    </div>
  )
})