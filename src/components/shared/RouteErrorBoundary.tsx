import type { ReactNode } from 'react'

import { ErrorBoundary } from './ErrorBoundary'

type Props = {
  title: string
  children: ReactNode
}

export function RouteErrorBoundary({ title, children }: Props) {
  return (
    <ErrorBoundary
      fallbackTitle={`Couldn't load ${title}`}
      fallbackMessage="This page ran into a problem. The rest of the dashboard is unaffected — try again or switch to another page."
    >
      {children}
    </ErrorBoundary>
  )
}