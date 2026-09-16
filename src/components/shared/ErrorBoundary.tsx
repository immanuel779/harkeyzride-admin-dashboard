import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertOctagon, RotateCcw, Home } from 'lucide-react'

type Props = {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
}

type State = {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // 🟡 BACKEND REQUIRED — send to Sentry / LogRocket / your error service
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const title = this.props.fallbackTitle ?? 'Something went wrong'
    const message =
      this.props.fallbackMessage ??
      'An unexpected error occurred. You can try again or reload the page.'

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 text-danger flex items-center justify-center mb-5">
          <AlertOctagon size={28} />
        </div>

        <h2 className="text-xl font-semibold text-ink mb-2">{title}</h2>
        <p className="text-sm text-ink-secondary max-w-md mb-6">{message}</p>

        {import.meta.env.DEV && this.state.error ? (
          <details className="mb-6 w-full max-w-2xl text-left">
            <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink mb-2">
              Technical details (dev only)
            </summary>
            <pre className="rounded-lg bg-surface-alt border border-border p-4 text-xs text-danger overflow-auto max-h-64 font-mono">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          </details>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald text-sm font-semibold text-white hover:bg-emerald-dark transition-colors"
          >
            <RotateCcw size={14} />
            Try again
          </button>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-ink hover:bg-surface-alt transition-colors"
          >
            <Home size={14} />
            Reload page
          </button>
        </div>
      </div>
    )
  }
}