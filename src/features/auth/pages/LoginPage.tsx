import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  WifiOff,
} from 'lucide-react'

import { useAuth } from '../../../store/AuthContext'
import { BRAND } from '../../../config/brand'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const REMEMBERED_EMAIL_KEY = 'hr.admin.rememberedEmail'
const MAX_ATTEMPTS = 5
const LOCKOUT_SECONDS = 30

const HIGHLIGHTS = [
  {
    title: 'Live fleet visibility',
    body: 'Track every vehicle, driver and trip across Ibadan as it happens — no refresh required.',
  },
  {
    title: 'Audit-ready financials',
    body: 'Reconcile payouts, commissions and ledgers without touching a single spreadsheet.',
  },
  {
    title: 'Emergency response',
    body: 'Trigger, escalate and coordinate SOS workflows in seconds, not minutes.',
  },
]

const ANIMATIONS = `
  @keyframes hr-fade-up { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes hr-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes hr-shake {
    0%, 100% { transform: translateX(0); }
    15% { transform: translateX(-8px); }
    30% { transform: translateX(7px); }
    45% { transform: translateX(-5px); }
    60% { transform: translateX(4px); }
    75% { transform: translateX(-2px); }
  }
  @keyframes hr-float { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(0, -28px, 0) scale(1.06); } }
  @keyframes hr-float-alt { 0%, 100% { transform: translate3d(0, 0, 0) scale(1); } 50% { transform: translate3d(18px, 22px, 0) scale(1.08); } }
  @keyframes hr-shimmer { 0% { transform: translateX(-120%); } 100% { transform: translateX(220%); } }
  @keyframes hr-pop { 0% { opacity: 0; transform: scale(.7); } 60% { transform: scale(1.06); } 100% { opacity: 1; transform: scale(1); } }
  @keyframes hr-ring { 0% { transform: scale(.85); opacity: .65; } 70% { transform: scale(1.55); opacity: 0; } 100% { opacity: 0; } }

  .hr-fade-up { animation: hr-fade-up .65s cubic-bezier(.22,1,.36,1) both; }
  .hr-fade-in { animation: hr-fade-in .5s ease both; }
  .hr-shake { animation: hr-shake .55s cubic-bezier(.36,.07,.19,.97) both; }
  .hr-float { animation: hr-float 9s ease-in-out infinite; }
  .hr-float-alt { animation: hr-float-alt 11s ease-in-out infinite; }
  .hr-pop { animation: hr-pop .45s cubic-bezier(.22,1,.36,1) both; }
  .hr-ring { animation: hr-ring 1.8s ease-out infinite; }

  .hr-shimmer::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.35), transparent);
    transform: translateX(-120%);
  }
  .hr-shimmer:hover::after { animation: hr-shimmer 1s ease; }

  @media (prefers-reduced-motion: reduce) {
    .hr-fade-up, .hr-fade-in, .hr-shake, .hr-float, .hr-float-alt, .hr-pop, .hr-ring { animation: none !important; }
    .hr-shimmer:hover::after { animation: none !important; }
  }
`

type FieldErrors = { email?: string; password?: string }

function validate(values: { email: string; password: string }): FieldErrors {
  const next: FieldErrors = {}
  const trimmed = values.email.trim()

  if (!trimmed) next.email = 'Email is required'
  else if (!EMAIL_PATTERN.test(trimmed)) next.email = 'That email address looks incomplete'

  if (!values.password) next.password = 'Password is required'

  return next
}

export function LoginPage() {
  const { status, signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [shaking, setShaking] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [attempts, setAttempts] = useState(0)
  const [lockout, setLockout] = useState(0)
  const [online, setOnline] = useState(true)
  const [resetHint, setResetHint] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const emailRef = useRef<HTMLInputElement | null>(null)
  const passwordRef = useRef<HTMLInputElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  /* ---------------------------------------------------------------- */
  /* Effects                                                          */
  /* ---------------------------------------------------------------- */

  // Restore remembered email
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(REMEMBERED_EMAIL_KEY)
      if (stored) {
        setEmail(stored)
        setRemember(true)
      }
    } catch {
      /* storage unavailable — ignore */
    }
  }, [])

  // Connectivity awareness
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])

  // Lockout countdown
  useEffect(() => {
    if (lockout <= 0) return
    const id = window.setTimeout(() => setLockout((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearTimeout(id)
  }, [lockout])

  // Rotating highlights on the brand panel
  useEffect(() => {
    const id = window.setInterval(
      () => setHighlightIndex((i) => (i + 1) % HIGHLIGHTS.length),
      4200,
    )
    return () => window.clearInterval(id)
  }, [])

  /* ---------------------------------------------------------------- */
  /* Helpers                                                          */
  /* ---------------------------------------------------------------- */

  const triggerShake = useCallback(() => {
    setShaking(false)
    window.requestAnimationFrame(() => {
      setShaking(true)
      window.setTimeout(() => setShaking(false), 600)
    })
  }, [])

  const syncCapsLock = (event: KeyboardEvent<HTMLInputElement>) => {
    if (typeof event.getModifierState === 'function') {
      setCapsLock(event.getModifierState('CapsLock'))
    }
  }

  // Pointer spotlight — written straight to CSS vars, so no re-renders
  const handlePointerMove = (event: MouseEvent<HTMLDivElement>) => {
    const el = panelRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${((event.clientX - rect.left) / rect.width) * 100}%`)
    el.style.setProperty('--my', `${((event.clientY - rect.top) / rect.height) * 100}%`)
  }

  /* ---------------------------------------------------------------- */
  /* Submit                                                           */
  /* ---------------------------------------------------------------- */

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (loading || success || lockout > 0 || !online) return

    setError('')
    setResetHint(false)

    const nextErrors = validate({ email, password })
    setFieldErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      triggerShake()
      if (nextErrors.email) emailRef.current?.focus()
      else passwordRef.current?.focus()
      return
    }

    setLoading(true)

    try {
      await signIn(email.trim(), password)

      try {
        if (remember) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, email.trim())
        else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY)
      } catch {
        /* storage unavailable — ignore */
      }

      setAttempts(0)
      setSuccess(true)

      const from =
        (location.state as { from?: string } | null)?.from ?? '/dashboard'

      // Let the success animation land before redirecting
      window.setTimeout(() => navigate(from, { replace: true }), 750)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.')
      setLoading(false)
      triggerShake()

      const next = attempts + 1
      if (next >= MAX_ATTEMPTS) {
        setAttempts(0)
        setLockout(LOCKOUT_SECONDS)
      } else {
        setAttempts(next)
      }

      passwordRef.current?.select()
    }
  }

  /* ---------------------------------------------------------------- */
  /* Guards                                                           */
  /* ---------------------------------------------------------------- */

  if (status === 'authenticated' && !success) {
    return <Navigate to="/dashboard" replace />
  }

  const remaining = Math.max(0, MAX_ATTEMPTS - attempts)
  const isLocked = lockout > 0
  const disabled = loading || success || isLocked || !online

  /* ---------------------------------------------------------------- */
  /* Render                                                           */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen flex bg-navy">
      <style>{ANIMATIONS}</style>

      {/* ------------------------------------------------ */}
      {/* Left brand panel — desktop only                  */}
      {/* ------------------------------------------------ */}
      <div
        ref={panelRef}
        onMouseMove={handlePointerMove}
        className="relative hidden lg:flex lg:w-1/2 flex-col justify-between p-12 text-white overflow-hidden"
      >
        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="hr-float absolute -top-28 -left-24 h-80 w-80 rounded-full bg-emerald/25 blur-3xl" />
          <div className="hr-float-alt absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-emerald/10 blur-3xl" />
          <div className="hr-float absolute bottom-[-6rem] left-1/4 h-72 w-72 rounded-full bg-white/5 blur-3xl" />
        </div>

        {/* Grid texture */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 78%)',
            WebkitMaskImage: 'radial-gradient(ellipse at 30% 20%, black, transparent 78%)',
          }}
        />

        {/* Cursor spotlight */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-500"
          style={{
            background:
              'radial-gradient(420px circle at var(--mx, 50%) var(--my, 40%), rgba(16,185,129,0.18), transparent 65%)',
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 hr-fade-up">
          <div className="w-10 h-10 rounded-xl bg-emerald flex items-center justify-center text-base font-bold shadow-lg shadow-emerald/30">
            HR
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold">{BRAND.name}</span>
            <span className="text-xs text-white/50">{BRAND.productLabel}</span>
          </div>
        </div>

        {/* Middle content */}
        <div className="relative z-10 max-w-md">
          <h1
            className="text-4xl font-bold leading-tight mb-4 hr-fade-up"
            style={{ animationDelay: '80ms' }}
          >
            Operations, audit, and control — in one place.
          </h1>

          <p
            className="text-white/60 text-base leading-relaxed mb-10 hr-fade-up"
            style={{ animationDelay: '160ms' }}
          >
            Monitor the fleet, manage drivers, audit financials, and respond to
            emergencies across Ibadan in real time.
          </p>

          {/* Rotating highlights */}
          <div className="relative h-24 mb-3">
            {HIGHLIGHTS.map((item, i) => (
              <div
                key={item.title}
                className={`absolute inset-0 transition-all duration-500 ${
                  i === highlightIndex
                    ? 'opacity-100 translate-y-0'
                    : 'pointer-events-none opacity-0 translate-y-3'
                }`}
              >
                <div className="flex items-center gap-2 text-emerald text-[11px] font-semibold uppercase tracking-[0.18em] mb-2">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  {item.title}
                </div>
                <p className="text-sm text-white/55 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>

          {/* Progress dots */}
          <div className="flex gap-1.5">
            {HIGHLIGHTS.map((item, i) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setHighlightIndex(i)}
                aria-label={`Show highlight ${i + 1}: ${item.title}`}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === highlightIndex
                    ? 'w-6 bg-emerald'
                    : 'w-1.5 bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between gap-4 hr-fade-up" style={{ animationDelay: '240ms' }}>
          <div className="flex items-center gap-2 text-xs text-white/40">
            <ShieldCheck size={14} className="text-emerald/70" aria-hidden="true" />
            <span>Encrypted session · Audit logged</span>
          </div>
          <div className="text-xs text-white/40">
            © {new Date().getFullYear()} {BRAND.parentCompany}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ */}
      {/* Right form panel                                 */}
      {/* ------------------------------------------------ */}
      <div className="flex-1 flex items-center justify-center p-6 bg-canvas lg:rounded-l-[40px] lg:m-4 lg:ml-0">
        <div className="relative w-full max-w-sm">
          {/* Success overlay */}
          {success ? (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center rounded-2xl bg-canvas/95 backdrop-blur-sm hr-fade-in">
              <div className="relative mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald hr-ring" aria-hidden="true" />
                <div className="hr-pop flex h-14 w-14 items-center justify-center rounded-full bg-emerald text-white shadow-lg shadow-emerald/40">
                  <CheckCircle2 size={28} aria-hidden="true" />
                </div>
              </div>
              <p className="text-sm font-semibold text-ink">Welcome back</p>
              <p className="text-xs text-ink-muted mt-1">Redirecting to your dashboard…</p>
            </div>
          ) : null}

          {/* Offline banner */}
          {!online ? (
            <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 hr-fade-up">
              <WifiOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>You&apos;re offline. Sign in will resume once the connection is back.</span>
            </div>
          ) : null}

          {/* Mobile brand */}
          <div className="flex lg:hidden items-center gap-3 mb-8 hr-fade-up">
            <div className="w-10 h-10 rounded-xl bg-navy flex items-center justify-center text-base font-bold text-white">
              HR
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-bold text-ink">{BRAND.name}</span>
              <span className="text-xs text-ink-muted">{BRAND.productLabel}</span>
            </div>
          </div>

          {/* Heading */}
          <div className="hr-fade-up" style={{ animationDelay: '60ms' }}>
            <h1 className="text-2xl font-bold text-ink mb-1">Sign in</h1>
            <p className="text-sm text-ink-secondary mb-8">
              Enter your admin credentials to continue
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            noValidate
            className={`space-y-4 ${shaking ? 'hr-shake' : ''}`}
          >
            {/* Email */}
            <div className="hr-fade-up" style={{ animationDelay: '120ms' }}>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2"
              >
                Email
              </label>
              <div className="relative">
                <Mail
                  size={16}
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                    fieldErrors.email ? 'text-danger' : 'text-ink-muted'
                  }`}
                />
                <input
                  ref={emailRef}
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError('')
                    if (fieldErrors.email) setFieldErrors((p) => ({ ...p, email: undefined }))
                  }}
                  onBlur={() => {
                    const next = validate({ email, password })
                    setFieldErrors((p) => ({ ...p, email: next.email }))
                  }}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                  className={`w-full rounded-lg border bg-surface pl-11 pr-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 transition-colors disabled:opacity-60 ${
                    fieldErrors.email
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-200/40'
                      : 'border-border focus:border-emerald focus:ring-emerald/20'
                  }`}
                  placeholder="you@harkeyzride.dev"
                  disabled={loading || success}
                />
              </div>
              {fieldErrors.email ? (
                <p
                  id="email-error"
                  className="mt-1.5 flex items-center gap-1 text-xs text-danger hr-fade-in"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  {fieldErrors.email}
                </p>
              ) : null}
            </div>

            {/* Password */}
            <div className="hr-fade-up" style={{ animationDelay: '180ms' }}>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold text-ink-secondary uppercase tracking-wide"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setResetHint((v) => !v)}
                  className="text-[11px] font-semibold text-emerald hover:text-emerald-dark transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              <div className="relative">
                <Lock
                  size={16}
                  aria-hidden="true"
                  className={`pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${
                    fieldErrors.password ? 'text-danger' : 'text-ink-muted'
                  }`}
                />
                <input
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError('')
                    if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: undefined }))
                  }}
                  onKeyUp={syncCapsLock}
                  onKeyDown={syncCapsLock}
                  onBlur={() => {
                    setCapsLock(false)
                    const next = validate({ email, password })
                    setFieldErrors((p) => ({ ...p, password: next.password }))
                  }}
                  aria-invalid={Boolean(fieldErrors.password)}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className={`w-full rounded-lg border bg-surface pl-11 pr-11 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 transition-colors disabled:opacity-60 ${
                    fieldErrors.password
                      ? 'border-red-300 focus:border-red-400 focus:ring-red-200/40'
                      : 'border-border focus:border-emerald focus:ring-emerald/20'
                  }`}
                  placeholder="••••••••"
                  disabled={loading || success}
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

              {fieldErrors.password ? (
                <p
                  id="password-error"
                  className="mt-1.5 flex items-center gap-1 text-xs text-danger hr-fade-in"
                >
                  <AlertCircle size={12} aria-hidden="true" />
                  {fieldErrors.password}
                </p>
              ) : null}

              {capsLock ? (
                <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-600 hr-fade-in">
                  <AlertCircle size={12} aria-hidden="true" />
                  Caps Lock is on
                </p>
              ) : null}
            </div>

            {/* Remember me */}
            <div
              className="flex items-center justify-between gap-3 pt-1 hr-fade-up"
              style={{ animationDelay: '220ms' }}
            >
              <label className="flex items-center gap-2 text-xs text-ink-secondary cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  disabled={loading || success}
                  className="h-4 w-4 rounded border-border accent-emerald focus:ring-2 focus:ring-emerald/30"
                />
                Remember me
              </label>

              <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                <ShieldCheck size={12} aria-hidden="true" />
                Secure
              </span>
            </div>

            {/* Forgot-password hint */}
            {resetHint ? (
              <div className="rounded-lg border border-border bg-surface-alt/60 px-3 py-2.5 text-xs text-ink-secondary hr-fade-up">
                Password resets are handled by your administrator. Contact them to
                regain access to this account.
              </div>
            ) : null}

            {/* Error */}
            {error ? (
              <div
                role="alert"
                aria-live="polite"
                className="flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-danger hr-fade-in"
              >
                <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </div>
            ) : null}

            {/* Submit */}
            <div className="hr-fade-up" style={{ animationDelay: '260ms' }}>
              <button
                type="submit"
                disabled={disabled}
                className="hr-shimmer relative w-full overflow-hidden flex items-center justify-center gap-2 rounded-lg bg-emerald px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-dark focus:outline-none focus:ring-2 focus:ring-emerald/40 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isLocked ? (
                  <>Try again in {lockout}s</>
                ) : loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" aria-hidden="true" />
                    Verifying…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={16} aria-hidden="true" />
                  </>
                )}
              </button>

              {attempts > 0 && !isLocked ? (
                <p className="mt-2 text-center text-[11px] text-ink-muted">
                  {remaining} attempt{remaining === 1 ? '' : 's'} remaining before a
                  temporary lock.
                </p>
              ) : null}
            </div>
          </form>

          {/* Support hint */}
          <div
            className="mt-8 rounded-lg border border-border bg-surface-alt/60 p-3 text-xs text-ink-secondary text-center hr-fade-up"
            style={{ animationDelay: '320ms' }}
          >
            Need an account? Contact your administrator.
          </div>

          {/* Footer meta */}
          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-ink-muted">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                online ? 'bg-emerald' : 'bg-amber-500'
              }`}
              aria-hidden="true"
            />
            {online ? 'All systems operational' : 'Connection lost'}
            <span className="text-ink-muted/50">·</span>
            <span>v1.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}