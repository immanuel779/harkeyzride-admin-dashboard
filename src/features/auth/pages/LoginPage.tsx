import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

import { useAuth } from '../../../store/AuthContext'

export function LoginPage() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (status === 'authenticated') {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim() || !password) {
      setError('Email and password are required')
      return
    }

    setLoading(true)
    try {
      await signIn(email.trim(), password)
      const from = (location.state as { from?: string } | null)?.from ?? '/dashboard'
      navigate(from, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-navy">
      {/* Left brand panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald flex items-center justify-center text-xl font-bold">
            S
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold">SwitchRide</span>
            <span className="text-xs text-white/50">Admin Console</span>
          </div>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Operations, audit, and control — in one place.
          </h1>
          <p className="text-white/60 text-base leading-relaxed">
            Monitor the fleet, manage drivers, audit financials, and respond to
            emergencies across Ibadan in real time.
          </p>
        </div>

        <div className="text-xs text-white/40">
          © {new Date().getFullYear()} Harkeyz Holdings Ltd. · All rights reserved.
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-canvas lg:rounded-l-[40px] lg:m-4 lg:ml-0">
        <div className="w-full max-w-sm">
          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center text-xl font-bold text-white">
              S
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-ink">SwitchRide</span>
              <span className="text-xs text-ink-muted">Admin Console</span>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-ink mb-1">Sign in</h1>
          <p className="text-sm text-ink-secondary mb-8">
            Enter your admin credentials to continue
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError('')
                }}
                className="w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 transition-colors"
                placeholder="admin@switchride.dev"
                disabled={loading}
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError('')
                  }}
                  className="w-full rounded-lg border border-border bg-surface px-4 py-3 pr-11 text-sm text-ink placeholder:text-ink-muted focus:border-emerald focus:outline-none focus:ring-2 focus:ring-emerald/20 transition-colors"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error ? (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-danger">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-8 rounded-lg border border-dashed border-border bg-surface-alt/60 p-3 text-xs text-ink-secondary">
            <p className="font-semibold text-ink mb-1">Demo credentials</p>
            <p>Email: <span className="font-mono">admin@switchride.dev</span></p>
            <p>Password: <span className="font-mono">SwitchRide2026!</span></p>
          </div>
        </div>
      </div>
    </div>
  )
}