import { useEffect, useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bookmark,
  Calculator,
  CheckCircle2,
  ChevronDown,
  Clock,
  Coins,
  DollarSign,
  Download,
  Eye,
  History,
  Layers,
  Lightbulb,
  Lock,
  Moon,
  Percent,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Sparkles,
  Star,
  TrendingUp,
  Wallet,
  X,
  Zap,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { ErrorState } from '../../../components/shared/ErrorState'
import { Skeleton } from '../../../components/shared/Skeleton'
import { FormField } from '../components/FormField'
import { SettingsSection } from '../components/SettingsSection'
import { toast } from '../../../lib/toast'
import { api } from '../../../lib/apiClient'
import { env } from '../../../config/env'
import {
  DEFAULT_FARE_VALUES,
  fareSchema,
  type FareFormValues,
} from '../schemas/fareSchema'

/* ==========================================================================
   TYPES (original BackendPricing preserved)
   ========================================================================== */

type BackendPricing = {
  id: string
  baseFare: number
  perKm: number
  perMinute: number
  minimumFare: number
  cashSurcharge: number
  nightSurcharge: number
  currency: string
  version: number
  isBootstrapDefault: boolean
  updatedAt: string
  updatedBy: string
}

const pricingKeys = {
  all: ['pricing'] as const,
}

/* ==========================================================================
   SETTINGS TABS
   ========================================================================== */

type SettingsTab = 'pricing' | 'operations' | 'notifications' | 'security'

const SETTINGS_TABS: Array<{
  id: SettingsTab
  label: string
  icon: typeof DollarSign
  description: string
}> = [
  {
    id: 'pricing',
    label: 'Pricing & Tariffs',
    icon: DollarSign,
    description: 'Base fare, surcharges, and rate structure',
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: Settings,
    description: 'Dispatch rules, cancellation windows, and SLAs',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Sparkles,
    description: 'Email, SMS, and push notification templates',
  },
  {
    id: 'security',
    label: 'Security',
    icon: Shield,
    description: 'Access control, 2FA, and audit settings',
  },
]

/* ==========================================================================
   PRESETS
   ========================================================================== */

type Preset = {
  id: string
  label: string
  hint: string
  values: FareFormValues
  icon: typeof Star
  tone: 'emerald' | 'sky' | 'amber' | 'violet'
}

const PRESETS: Preset[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    hint: 'Lower barrier to entry',
    icon: Coins,
    tone: 'emerald',
    values: {
      baseFare: 300,
      perKm: 150,
      perMinute: 25,
      minimumFare: 500,
      cashSurcharge: 100,
      nightSurcharge: 200,
    },
  },
  {
    id: 'standard',
    label: 'Standard',
    hint: 'Recommended for Ibadan',
    icon: Star,
    tone: 'sky',
    values: {
      baseFare: 400,
      perKm: 187,
      perMinute: 35,
      minimumFare: 700,
      cashSurcharge: 150,
      nightSurcharge: 300,
    },
  },
  {
    id: 'premium',
    label: 'Premium',
    hint: 'Higher margins, upscale market',
    icon: TrendingUp,
    tone: 'violet',
    values: {
      baseFare: 600,
      perKm: 250,
      perMinute: 50,
      minimumFare: 1000,
      cashSurcharge: 200,
      nightSurcharge: 500,
    },
  },
  {
    id: 'night-friendly',
    label: 'Night Friendly',
    hint: 'Encourages nighttime drivers',
    icon: Moon,
    tone: 'amber',
    values: {
      baseFare: 400,
      perKm: 187,
      perMinute: 35,
      minimumFare: 700,
      cashSurcharge: 150,
      nightSurcharge: 700,
    },
  },
]

/* ==========================================================================
   VERSION HISTORY
   ========================================================================== */

type PricingVersion = {
  id: string
  version: number
  values: FareFormValues
  savedAt: string
  savedBy: string
  note?: string
}

const VERSION_KEY = 'hr.pricing.versions.v1'
const MAX_VERSIONS = 20

function loadVersions(): PricingVersion[] {
  try {
    const raw = window.localStorage.getItem(VERSION_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistVersion(version: PricingVersion): void {
  try {
    const current = loadVersions()
    const next = [version, ...current].slice(0, MAX_VERSIONS)
    window.localStorage.setItem(VERSION_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

/* ==========================================================================
   ANIMATIONS
   ========================================================================== */

const ANIMATIONS = `
  @keyframes sp-fade-up { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sp-fade-in { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sp-slide-in { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
  @keyframes sp-pop { 0% { transform: scale(.85); opacity: 0; } 60% { transform: scale(1.06); } 100% { transform: scale(1); opacity: 1; } }
  @keyframes sp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .45; } }
  @keyframes sp-slide-down { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  @keyframes sp-shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(220%); } }
  .sp-fade-up { animation: sp-fade-up .35s cubic-bezier(.22,1,.36,1) both; }
  .sp-fade-in { animation: sp-fade-in .2s ease both; }
  .sp-slide-in { animation: sp-slide-in .3s cubic-bezier(.22,1,.36,1) both; }
  .sp-pop { animation: sp-pop .35s cubic-bezier(.22,1,.36,1) both; }
  .sp-pulse { animation: sp-pulse 1.5s ease-in-out infinite; }
  .sp-slide-down { animation: sp-slide-down .3s cubic-bezier(.22,1,.36,1) both; }
  .sp-shimmer { position: relative; overflow: hidden; }
  .sp-shimmer::after {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.3), transparent);
    transform: translateX(-100%);
  }
  .sp-shimmer:hover::after { animation: sp-shimmer 1s ease; }
  .sp-stagger > * { animation: sp-fade-up .4s cubic-bezier(.22,1,.36,1) both; }
  .sp-stagger > *:nth-child(1) { animation-delay: 0ms; }
  .sp-stagger > *:nth-child(2) { animation-delay: 60ms; }
  .sp-stagger > *:nth-child(3) { animation-delay: 120ms; }
  .sp-stagger > *:nth-child(4) { animation-delay: 180ms; }
  @media (prefers-reduced-motion: reduce) {
    .sp-fade-up, .sp-fade-in, .sp-slide-in, .sp-pop, .sp-pulse, .sp-slide-down,
    .sp-stagger > *, .sp-shimmer:hover::after { animation: none !important; }
  }
`

/* ==========================================================================
   HELPERS
   ========================================================================== */

function fmt(n: number, currency = '₦'): string {
  return `${currency}${n.toFixed(0)}`
}

function fmtPrecise(n: number, currency = '₦'): string {
  return `${currency}${n.toFixed(2)}`
}

function fmtRelative(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = Math.max(0, Date.now() - t)
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

/* ==========================================================================
   PAGE
   ========================================================================== */

export function SettingsPage() {
  const queryClient = useQueryClient()

  const [tab, setTab] = useState<SettingsTab>('pricing')
  const [showCalculator, setShowCalculator] = useState(true)
  const [showVersions, setShowVersions] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [showDiff, setShowDiff] = useState(true)
  const [versions, setVersions] = useState<PricingVersion[]>([])

  /* ---------------------------- data ---------------------------- */

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: pricingKeys.all,
    queryFn: async (): Promise<BackendPricing> => {
      const res = await api.get<{ pricing: BackendPricing }>('/admin/pricing')
      return res.pricing
    },
    enabled: !env.useMockApi,
    initialData: undefined,
  })

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FareFormValues>({
    resolver: zodResolver(fareSchema),
    defaultValues: DEFAULT_FARE_VALUES,
  })

  const watchedValues = useWatch({
    control,
    defaultValue: DEFAULT_FARE_VALUES,
  }) as FareFormValues

  /* ---------------------------- effects ---------------------------- */

  useEffect(() => {
    if (!data) return
    reset({
      baseFare: data.baseFare,
      perKm: data.perKm,
      perMinute: data.perMinute,
      minimumFare: data.minimumFare,
      cashSurcharge: data.cashSurcharge,
      nightSurcharge: data.nightSurcharge,
    })
  }, [data, reset])

  useEffect(() => {
    setVersions(loadVersions())
  }, [])

  // ⌘S to save
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      if (e.key.toLowerCase() !== 's') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'TEXTAREA') return
      e.preventDefault()
      if (isDirty && !isSubmitting) handleSubmit(onSubmit)()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDirty, isSubmitting])

  // Unsaved changes guard
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  /* ---------------------------- submit ---------------------------- */

  const onSubmit = async (values: FareFormValues) => {
    try {
      await api.put('/admin/pricing', values)

      // Record version
      const version: PricingVersion = {
        id: `v_${Date.now()}`,
        version: (data?.version ?? 0) + 1,
        values,
        savedAt: new Date().toISOString(),
        savedBy: 'Admin',
      }
      persistVersion(version)
      setVersions(loadVersions())

      await queryClient.invalidateQueries({ queryKey: pricingKeys.all })
      toast.success('Pricing updated', 'New tariff applies to new rides only.')
    } catch (e) {
      toast.error('Save failed', e instanceof Error ? e.message : 'Try again.')
    }
  }

  const handleReset = () => {
    if (data) {
      reset({
        baseFare: data.baseFare,
        perKm: data.perKm,
        perMinute: data.perMinute,
        minimumFare: data.minimumFare,
        cashSurcharge: data.cashSurcharge,
        nightSurcharge: data.nightSurcharge,
      })
      toast.info('Form reset', 'Values restored to last saved.')
    } else {
      reset(DEFAULT_FARE_VALUES)
    }
  }

  const handleApplyPreset = (preset: Preset) => {
    Object.entries(preset.values).forEach(([key, value]) => {
      setValue(key as keyof FareFormValues, value as number, {
        shouldDirty: true,
        shouldValidate: true,
      })
    })
    toast.success(`${preset.label} applied`, 'Review and save to publish.')
  }

  const handleRestoreVersion = (version: PricingVersion) => {
    Object.entries(version.values).forEach(([key, value]) => {
      setValue(key as keyof FareFormValues, value as number, {
        shouldDirty: true,
        shouldValidate: true,
      })
    })
    setShowVersions(false)
    toast.info(
      `Restored v${version.version}`,
      'Review and save to publish this version.',
    )
  }

  const handleExportJSON = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      current: watchedValues,
      saved: data ?? null,
      currency: data?.currency ?? '₦',
      version: data?.version ?? 0,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    a.href = url
    a.download = `pricing-${ts}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    toast.success('Exported', 'Pricing configuration downloaded.')
  }

  const numRegister = (
    name: keyof FareFormValues,
  ): UseFormRegisterReturn =>
    register(name, { valueAsNumber: true }) as UseFormRegisterReturn

  /* ---------------------------- diff ---------------------------- */

  const diff = useMemo(() => {
    if (!data) return null
    const fields: Array<keyof FareFormValues> = [
      'baseFare', 'perKm', 'perMinute', 'minimumFare', 'cashSurcharge', 'nightSurcharge',
    ]
    const changes: Array<{
      field: keyof FareFormValues
      label: string
      before: number
      after: number
      delta: number
    }> = []

    for (const field of fields) {
      const before = data[field]
      const after = watchedValues[field] ?? before
      if (before !== after) {
        changes.push({
          field,
          label: FIELD_LABELS[field],
          before,
          after,
          delta: after - before,
        })
      }
    }

    return changes
  }, [data, watchedValues])

  /* ---------------------------- error state ---------------------------- */

  if (isError) {
    return (
      <AppShell title="Settings">
        <style>{ANIMATIONS}</style>
        <div className="rounded-xl bg-surface border border-border">
          <ErrorState
            title="Could not load pricing"
            description={error instanceof Error ? error.message : 'Please try again.'}
            onRetry={() => refetch()}
          />
        </div>
      </AppShell>
    )
  }

  /* ---------------------------- render ---------------------------- */

  return (
    <AppShell title="Settings">
      <style>{ANIMATIONS}</style>

      {/* -------------------- Settings tabs -------------------- */}
      <div className="mb-4 flex flex-wrap items-center gap-1.5 sp-fade-up">
        {SETTINGS_TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id
          const isPricing = id === 'pricing'
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              disabled={!isPricing}
              title={
                !isPricing ? 'Coming soon — contact dev to enable' : undefined
              }
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all',
                active
                  ? 'border-emerald bg-emerald text-white shadow-sm shadow-emerald/20'
                  : isPricing
                    ? 'border-border bg-surface text-ink-secondary hover:border-emerald/50 hover:text-emerald'
                    : 'border-border bg-surface text-ink-muted/60 cursor-not-allowed',
              ].join(' ')}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
              {!isPricing ? (
                <Lock size={9} className="opacity-60" aria-hidden="true" />
              ) : null}
            </button>
          )
        })}
      </div>

      {tab !== 'pricing' ? (
        <div className="rounded-xl bg-surface border border-border p-10 text-center sp-fade-up">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
            <Layers size={22} aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-ink mb-1">
            {SETTINGS_TABS.find((t) => t.id === tab)?.label}
          </h3>
          <p className="mx-auto max-w-md text-xs text-ink-secondary">
            {SETTINGS_TABS.find((t) => t.id === tab)?.description}
          </p>
          <p className="mt-4 text-[11px] text-ink-muted">
            Coming in the next release. Pricing & tariffs is fully live now.
          </p>
          <button
            type="button"
            onClick={() => setTab('pricing')}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors"
          >
            <ArrowRight size={12} aria-hidden="true" />
            Go to Pricing
          </button>
        </div>
      ) : (
        <PricingTab
          data={data}
          isLoading={isLoading}
          isError={isError}
          error={error}
          refetch={refetch}
          numRegister={numRegister}
          errors={errors}
          watchedValues={watchedValues}
          isDirty={isDirty}
          isSubmitting={isSubmitting}
          onReset={handleReset}
          onSubmit={handleSubmit(onSubmit)}
          onApplyPreset={handleApplyPreset}
          onExport={handleExportJSON}
          onShowPreview={() => setShowPreview(true)}
          onShowVersions={() => setShowVersions(true)}
          showCalculator={showCalculator}
          onToggleCalculator={() => setShowCalculator((v) => !v)}
          showDiff={showDiff}
          onToggleDiff={() => setShowDiff((v) => !v)}
          diff={diff}
          versions={versions}
        />
      )}

      {/* -------------------- Modals -------------------- */}
      {showPreview ? (
        <RiderAppPreview
          values={watchedValues}
          currency={data?.currency ?? '₦'}
          onClose={() => setShowPreview(false)}
        />
      ) : null}

      {showVersions ? (
        <VersionHistoryDrawer
          versions={versions}
          onRestore={handleRestoreVersion}
          onClose={() => setShowVersions(false)}
        />
      ) : null}
    </AppShell>
  )
}

/* ==========================================================================
   CONSTANTS
   ========================================================================== */

const FIELD_LABELS: Record<keyof FareFormValues, string> = {
  baseFare: 'Base fare',
  perKm: 'Per-km rate',
  perMinute: 'Per-minute rate',
  minimumFare: 'Minimum fare',
  cashSurcharge: 'Cash surcharge',
  nightSurcharge: 'Night surcharge',
}

/* ==========================================================================
   PRICING TAB — the full-featured view
   ========================================================================== */

type PricingTabProps = {
  data: BackendPricing | undefined
  isLoading: boolean
  isError: boolean
  error: unknown
  refetch: () => void
  numRegister: (name: keyof FareFormValues) => UseFormRegisterReturn
  errors: ReturnType<typeof useForm<FareFormValues>>['formState']['errors']
  watchedValues: FareFormValues
  isDirty: boolean
  isSubmitting: boolean
  onReset: () => void
  onSubmit: () => void
  onApplyPreset: (preset: Preset) => void
  onExport: () => void
  onShowPreview: () => void
  onShowVersions: () => void
  showCalculator: boolean
  onToggleCalculator: () => void
  showDiff: boolean
  onToggleDiff: () => void
  diff: Array<{
    field: keyof FareFormValues
    label: string
    before: number
    after: number
    delta: number
  }> | null
  versions: PricingVersion[]
}

function PricingTab({
  data,
  isLoading,
  numRegister,
  errors,
  watchedValues,
  isDirty,
  isSubmitting,
  onReset,
  onSubmit,
  onApplyPreset,
  onExport,
  onShowPreview,
  onShowVersions,
  showCalculator,
  onToggleCalculator,
  showDiff,
  onToggleDiff,
  diff,
  versions,
}: PricingTabProps) {
  const [confirmedSave, setConfirmedSave] = useState(false)
  const [diffExpanded, setDiffExpanded] = useState(true)

  const handleSaveClick = () => {
    if (diff && diff.length > 0) {
      setConfirmedSave(true)
    } else {
      onSubmit()
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        handleSaveClick()
      }}
      className="space-y-4"
    >
      {/* Bootstrap warning (preserved) */}
      {data?.isBootstrapDefault ? (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 flex items-start gap-3 sp-fade-up">
          <AlertTriangle size={18} className="text-warning flex-shrink-0 mt-0.5" />
          <div className="text-sm text-ink">
            <strong>Bootstrap pricing active.</strong> Production ride booking is
            blocked until a real tariff is saved here.
          </div>
        </div>
      ) : null}

      {/* Header (preserved) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-2 sp-fade-up">
        <div>
          <h2 className="text-lg font-semibold text-ink">Fare & Tariff</h2>
          <p className="text-xs text-ink-secondary mt-0.5">
            Live pricing policy. Changes apply to new rides only.
            {data ? (
              <>
                {' '}· Version {data.version} · Updated{' '}
                {new Date(data.updatedAt).toLocaleString()}
              </>
            ) : null}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onShowVersions}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <History size={12} aria-hidden="true" />
            <span className="hidden sm:inline">History</span>
            {versions.length > 0 ? (
              <span className="rounded-full bg-surface-alt px-1.5 text-[10px] font-bold text-ink-muted">
                {versions.length}
              </span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-2 text-xs font-medium text-ink hover:border-emerald hover:text-emerald transition-colors"
          >
            <Download size={12} aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={!isDirty || isSubmitting}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} aria-hidden="true" />
            Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={14} aria-hidden="true" />
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      {/* Loading (preserved) */}
      {isLoading && !data ? (
        <div className="rounded-xl bg-surface border border-border p-6 space-y-3">
          <Skeleton className="h-4 w-40 mb-4" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : (
        <>
          {/* Presets */}
          <div className="sp-fade-up">
            <div className="mb-2 flex items-center gap-1.5">
              <Bookmark size={12} className="text-ink-muted" aria-hidden="true" />
              <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                Quick presets
              </h3>
              <span className="text-[10px] text-ink-muted/70">
                — one click to test a common scenario
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {PRESETS.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  onApply={() => onApplyPreset(preset)}
                />
              ))}
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {/* LEFT: form + preview */}
            <div className="lg:col-span-2 space-y-4">
              {/* Base pricing (preserved) */}
              <SettingsSection
                icon={DollarSign}
                title="Base pricing"
                description="Core per-ride rate structure"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Base fare"
                    prefix="₦"
                    type="number"
                    step="1"
                    error={errors.baseFare?.message}
                    {...numRegister('baseFare')}
                  />
                  <FormField
                    label="Minimum fare"
                    prefix="₦"
                    type="number"
                    step="1"
                    error={errors.minimumFare?.message}
                    {...numRegister('minimumFare')}
                  />
                  <FormField
                    label="Per km rate"
                    prefix="₦"
                    type="number"
                    step="0.01"
                    error={errors.perKm?.message}
                    {...numRegister('perKm')}
                  />
                  <FormField
                    label="Per minute rate"
                    prefix="₦"
                    type="number"
                    step="0.01"
                    error={errors.perMinute?.message}
                    {...numRegister('perMinute')}
                  />
                </div>
              </SettingsSection>

              {/* Surcharges (preserved) */}
              <SettingsSection
                icon={Moon}
                title="Surcharges"
                description="Applied on top of the base fare under specific conditions"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    label="Cash surcharge"
                    prefix="₦"
                    type="number"
                    step="1"
                    hint="Added when rider pays in cash"
                    error={errors.cashSurcharge?.message}
                    {...numRegister('cashSurcharge')}
                  />
                  <FormField
                    label="Night surcharge"
                    prefix="₦"
                    type="number"
                    step="1"
                    hint="Added during night hours"
                    error={errors.nightSurcharge?.message}
                    {...numRegister('nightSurcharge')}
                  />
                </div>
              </SettingsSection>

              {/* Fare preview (upgraded — now uses LIVE values) */}
              <SettingsSection
                icon={Wallet}
                title="Fare preview"
                description="Sample calculation with your current inputs"
              >
                <FarePreview values={watchedValues} />
                <div className="mt-3 flex items-center justify-between">
                  <p className="text-[11px] text-ink-muted">
                    5 km sample trip · 12 min duration
                  </p>
                  <button
                    type="button"
                    onClick={onShowPreview}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                  >
                    <Eye size={11} aria-hidden="true" />
                    See in rider app
                  </button>
                </div>
              </SettingsSection>
            </div>

            {/* RIGHT: calculator + diff + insights */}
            <div className="space-y-4">
              {/* Live calculator */}
              <div className="rounded-xl bg-surface border border-border overflow-hidden sp-fade-up">
                <button
                  type="button"
                  onClick={onToggleCalculator}
                  className="flex w-full items-center justify-between gap-2 px-4 py-3 hover:bg-surface-alt transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <Calculator size={13} className="text-emerald" aria-hidden="true" />
                    <span className="text-xs font-semibold text-ink">
                      Live calculator
                    </span>
                  </div>
                  <ChevronDown
                    size={13}
                    className={`text-ink-muted transition-transform ${
                      showCalculator ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>
                {showCalculator ? (
                  <div className="border-t border-border px-4 py-3 sp-fade-in">
                    <FareCalculator values={watchedValues} />
                  </div>
                ) : null}
              </div>

              {/* Change diff */}
              {isDirty && diff && diff.length > 0 ? (
                <div className="rounded-xl bg-amber-50 border border-amber-200 overflow-hidden sp-fade-up">
                  <button
                    type="button"
                    onClick={() => {
                      onToggleDiff()
                      setDiffExpanded((v) => !v)
                    }}
                    className="flex w-full items-center justify-between gap-2 px-4 py-3 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <AlertCircle size={13} className="text-amber-700" aria-hidden="true" />
                      <span className="text-xs font-semibold text-amber-800">
                        {diff.length} unsaved change{diff.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <ChevronDown
                      size={13}
                      className={`text-amber-700 transition-transform ${
                        diffExpanded && showDiff ? 'rotate-180' : ''
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                  {diffExpanded && showDiff ? (
                    <div className="border-t border-amber-200 px-4 py-3 space-y-1.5 sp-fade-in">
                      {diff.map((change) => (
                        <div
                          key={change.field}
                          className="flex items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="text-amber-800">{change.label}</span>
                          <span className="flex items-center gap-1.5 tabular-nums">
                            <span className="text-ink-muted line-through">
                              {fmt(change.before)}
                            </span>
                            <ArrowRight size={9} className="text-amber-700" aria-hidden="true" />
                            <span className="font-semibold text-amber-900">
                              {fmt(change.after)}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1 rounded ${
                                change.delta > 0
                                  ? 'bg-red-100 text-danger'
                                  : 'bg-emerald-light text-emerald-dark'
                              }`}
                            >
                              {change.delta > 0 ? '+' : ''}
                              {fmt(change.delta)}
                            </span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Sensitivity panel */}
              <SensitivityPanel values={watchedValues} />

              {/* Market benchmark */}
              <BenchmarkPanel values={watchedValues} />
            </div>
          </div>

          {/* Bottom info (preserved) */}
          <div className="rounded-xl bg-navy text-white p-4 flex items-start gap-3 text-xs sp-fade-up">
            <Lock size={16} className="text-emerald flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div className="text-white/70 leading-relaxed">
              <strong className="text-white">Important:</strong> Distance is a
              straight-line estimate and duration assumes 30 km/h. Changes to
              pricing affect <strong className="text-white">new rides only</strong> —
              rides already created keep their locked fare.
            </div>
          </div>
        </>
      )}

      {/* Save confirmation modal */}
      {confirmedSave && diff && diff.length > 0 ? (
        <ConfirmChangesModal
          diff={diff}
          currency={data?.currency ?? '₦'}
          onConfirm={() => {
            setConfirmedSave(false)
            onSubmit()
          }}
          onClose={() => setConfirmedSave(false)}
          loading={isSubmitting}
        />
      ) : null}
    </form>
  )
}

/* ==========================================================================
   PRESET CARD
   ========================================================================== */

function PresetCard({
  preset,
  onApply,
}: {
  preset: Preset
  onApply: () => void
}) {
  const toneClass: Record<Preset['tone'], string> = {
    emerald: 'bg-emerald-light text-emerald-dark',
    sky: 'bg-sky-50 text-sky-700',
    amber: 'bg-amber-50 text-amber-700',
    violet: 'bg-violet-50 text-violet-700',
  }
  const Icon = preset.icon
  return (
    <button
      type="button"
      onClick={onApply}
      className="group rounded-lg border border-border bg-surface p-3 text-left transition-all hover:border-emerald/50 hover:shadow-sm"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`flex h-6 w-6 items-center justify-center rounded ${toneClass[preset.tone]}`}>
          <Icon size={12} aria-hidden="true" />
        </div>
        <span className="text-xs font-semibold text-ink">{preset.label}</span>
      </div>
      <div className="text-[10px] text-ink-muted leading-tight">
        {preset.hint}
      </div>
      <div className="mt-1 text-[9px] text-ink-muted/70 tabular-nums">
        {fmt(preset.values.baseFare)} base · {fmt(preset.values.perKm)}/km
      </div>
    </button>
  )
}

/* ==========================================================================
   FARE PREVIEW (upgraded — LIVE)
   ========================================================================== */

function FarePreview({ values }: { values: FareFormValues }) {
  const distanceKm = 5
  const minutes = 12
  const fare =
    values.baseFare +
    values.perKm * distanceKm +
    values.perMinute * minutes
  const total = Math.max(fare, values.minimumFare)

  return (
    <div className="rounded-lg border border-border divide-y divide-border text-sm">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">Base fare</span>
        <span className="text-ink font-medium">{fmt(values.baseFare)}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">
          Distance ({distanceKm} km × {fmtPrecise(values.perKm)})
        </span>
        <span className="text-ink font-medium">
          {fmt(values.perKm * distanceKm)}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">
          Time ({minutes} min × {fmtPrecise(values.perMinute)})
        </span>
        <span className="text-ink font-medium">
          {fmt(values.perMinute * minutes)}
        </span>
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-light/40">
        <span className="text-ink font-semibold">Sample total</span>
        <span className="text-emerald-dark font-bold text-base">
          {fmt(total)}
        </span>
      </div>
    </div>
  )
}

/* ==========================================================================
   LIVE FARE CALCULATOR
   ========================================================================== */

function FareCalculator({ values }: { values: FareFormValues }) {
  const [distance, setDistance] = useState(5)
  const [minutes, setMinutes] = useState(12)
  const [cash, setCash] = useState(false)
  const [night, setNight] = useState(false)

  const calc = useMemo(() => {
    const base = values.baseFare
    const distCharge = values.perKm * distance
    const timeCharge = values.perMinute * minutes
    const subtotal = base + distCharge + timeCharge
    const surcharges =
      (cash ? values.cashSurcharge : 0) + (night ? values.nightSurcharge : 0)
    const minClamp = Math.max(subtotal, values.minimumFare)
    const total = minClamp + surcharges
    return { base, distCharge, timeCharge, subtotal, surcharges, minClamp, total }
  }, [values, distance, minutes, cash, night])

  return (
    <div className="space-y-3">
      {/* Distance slider */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-ink-secondary flex items-center gap-1">
            <Zap size={10} aria-hidden="true" />
            Distance
          </span>
          <span className="font-semibold text-ink tabular-nums">{distance} km</span>
        </div>
        <input
          type="range"
          min={1}
          max={30}
          step={1}
          value={distance}
          onChange={(e) => setDistance(Number(e.target.value))}
          className="w-full accent-emerald"
          aria-label="Trip distance in kilometers"
        />
      </div>

      {/* Time slider */}
      <div>
        <div className="mb-1 flex items-center justify-between text-[11px]">
          <span className="text-ink-secondary flex items-center gap-1">
            <Clock size={10} aria-hidden="true" />
            Duration
          </span>
          <span className="font-semibold text-ink tabular-nums">{minutes} min</span>
        </div>
        <input
          type="range"
          min={1}
          max={60}
          step={1}
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="w-full accent-emerald"
          aria-label="Trip duration in minutes"
        />
      </div>

      {/* Toggles */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setCash((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            cash
              ? 'border-emerald bg-emerald text-white'
              : 'border-border bg-surface text-ink-secondary hover:border-emerald/50'
          }`}
        >
          <Wallet size={9} aria-hidden="true" />
          Cash
        </button>
        <button
          type="button"
          onClick={() => setNight((v) => !v)}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
            night
              ? 'border-emerald bg-emerald text-white'
              : 'border-border bg-surface text-ink-secondary hover:border-emerald/50'
          }`}
        >
          <Moon size={9} aria-hidden="true" />
          Night
        </button>
      </div>

      {/* Breakdown */}
      <div className="rounded-lg bg-surface-alt/40 p-2.5 space-y-1 text-[11px]">
        <div className="flex justify-between">
          <span className="text-ink-muted">Base</span>
          <span className="text-ink tabular-nums">{fmt(calc.base)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Distance</span>
          <span className="text-ink tabular-nums">{fmt(calc.distCharge)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-muted">Time</span>
          <span className="text-ink tabular-nums">{fmt(calc.timeCharge)}</span>
        </div>
        {calc.surcharges > 0 ? (
          <div className="flex justify-between">
            <span className="text-ink-muted">Surcharges</span>
            <span className="text-ink tabular-nums">+{fmt(calc.surcharges)}</span>
          </div>
        ) : null}
        <div className="flex items-center justify-between border-t border-border pt-1.5 mt-1">
          <span className="font-semibold text-ink">Total</span>
          <span className="font-bold text-emerald-dark text-base tabular-nums">
            {fmt(calc.total)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   SENSITIVITY PANEL
   ========================================================================== */

function SensitivityPanel({ values }: { values: FareFormValues }) {
  const sampleDist = 5
  const sampleMin = 12
  const baseFare = Math.max(
    values.baseFare + values.perKm * sampleDist + values.perMinute * sampleMin,
    values.minimumFare,
  )
  const raised = Math.max(
    values.baseFare + 10 + values.perKm * sampleDist + values.perMinute * sampleMin,
    values.minimumFare,
  )
  const perKmRaised = Math.max(
    values.baseFare + (values.perKm + 10) * sampleDist + values.perMinute * sampleMin,
    values.minimumFare,
  )

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sp-fade-up">
      <div className="mb-2 flex items-center gap-1.5">
        <Lightbulb size={12} className="text-amber-500" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-ink">Sensitivity</h3>
      </div>
      <p className="text-[10px] text-ink-muted mb-2.5">
        On a 5 km / 12 min trip, this is how much fare changes for small
        adjustments.
      </p>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex items-center justify-between rounded-md bg-surface-alt/40 px-2 py-1.5">
          <span className="text-ink-secondary">+₦10 base fare</span>
          <span className="font-semibold text-ink tabular-nums">
            {fmt(baseFare)} → {fmt(raised)}
          </span>
        </div>
        <div className="flex items-center justify-between rounded-md bg-surface-alt/40 px-2 py-1.5">
          <span className="text-ink-secondary">+₦10 / km</span>
          <span className="font-semibold text-ink tabular-nums">
            {fmt(baseFare)} → {fmt(perKmRaised)}
          </span>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   BENCHMARK PANEL
   ========================================================================== */

const MARKET_RATES = {
  minBase: 300,
  maxBase: 700,
  avgBase: 450,
  minPerKm: 120,
  maxPerKm: 280,
  avgPerKm: 180,
}

function BenchmarkPanel({ values }: { values: FareFormValues }) {
  const basePct = Math.min(100, (values.baseFare / MARKET_RATES.maxBase) * 100)
  const perKmPct = Math.min(100, (values.perKm / MARKET_RATES.maxPerKm) * 100)
  const baseInRange =
    values.baseFare >= MARKET_RATES.minBase &&
    values.baseFare <= MARKET_RATES.maxBase
  const perKmInRange =
    values.perKm >= MARKET_RATES.minPerKm && values.perKm <= MARKET_RATES.maxPerKm

  return (
    <div className="rounded-xl bg-surface border border-border p-4 sp-fade-up">
      <div className="mb-2 flex items-center gap-1.5">
        <TrendingUp size={12} className="text-emerald" aria-hidden="true" />
        <h3 className="text-xs font-semibold text-ink">Market position</h3>
      </div>
      <p className="text-[10px] text-ink-muted mb-2.5">
        Compared to typical Ibadan ride-hailing rates.
      </p>

      <div className="space-y-3">
        <BenchmarkRow
          label="Base fare"
          value={values.baseFare}
          min={MARKET_RATES.minBase}
          max={MARKET_RATES.maxBase}
          avg={MARKET_RATES.avgBase}
          pct={basePct}
          inRange={baseInRange}
        />
        <BenchmarkRow
          label="Per-km rate"
          value={values.perKm}
          min={MARKET_RATES.minPerKm}
          max={MARKET_RATES.maxPerKm}
          avg={MARKET_RATES.avgPerKm}
          pct={perKmPct}
          inRange={perKmInRange}
        />
      </div>
    </div>
  )
}

function BenchmarkRow({
  label,
  value,
  min,
  max,
  avg,
  pct,
  inRange,
}: {
  label: string
  value: number
  min: number
  max: number
  avg: number
  pct: number
  inRange: boolean
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px]">
        <span className="text-ink-secondary">{label}</span>
        <span className="flex items-center gap-1">
          <span className="font-semibold text-ink tabular-nums">
            {fmt(value)}
          </span>
          {inRange ? (
            <CheckCircle2 size={10} className="text-emerald" aria-hidden="true" />
          ) : (
            <AlertTriangle size={10} className="text-amber-500" aria-hidden="true" />
          )}
        </span>
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-alt">
        <div
          className={`h-full rounded-full ${inRange ? 'bg-emerald' : 'bg-amber-500'}`}
          style={{ width: `${pct}%` }}
        />
        {/* Avg marker */}
        <div
          className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 bg-ink-muted/50"
          style={{ left: `${(avg / max) * 100}%` }}
          title={`Market avg ${fmt(avg)}`}
        />
      </div>
      <div className="mt-0.5 flex justify-between text-[9px] text-ink-muted">
        <span>{fmt(min)}</span>
        <span>avg {fmt(avg)}</span>
        <span>{fmt(max)}</span>
      </div>
    </div>
  )
}

/* ==========================================================================
   SAVE CONFIRMATION MODAL
   ========================================================================== */

function ConfirmChangesModal({
  diff,
  currency,
  onConfirm,
  onClose,
  loading,
}: {
  diff: Array<{
    field: keyof FareFormValues
    label: string
    before: number
    after: number
    delta: number
  }>
  currency: string
  onConfirm: () => void
  onClose: () => void
  loading: boolean
}) {
  return (
    <div
      className="sp-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-save-title"
      onClick={onClose}
    >
      <div
        className="sp-pop w-full max-w-md rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 id="confirm-save-title" className="text-sm font-bold text-ink">
              Publish {diff.length} price change{diff.length === 1 ? '' : 's'}?
            </h3>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              This applies to all new rides on both apps immediately.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-muted hover:bg-surface-alt"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mb-4 space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3">
          {diff.map((c) => (
            <div
              key={c.field}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span className="text-amber-800">{c.label}</span>
              <span className="flex items-center gap-1.5 tabular-nums">
                <span className="text-ink-muted line-through">
                  {currency}
                  {c.before.toFixed(0)}
                </span>
                <ArrowRight size={9} className="text-amber-700" aria-hidden="true" />
                <span className="font-semibold text-amber-900">
                  {currency}
                  {c.after.toFixed(0)}
                </span>
                <span
                  className={`text-[9px] font-bold px-1 rounded ${
                    c.delta > 0
                      ? 'bg-red-100 text-danger'
                      : 'bg-emerald-light text-emerald-dark'
                  }`}
                >
                  {c.delta > 0 ? '+' : ''}
                  {currency}
                  {c.delta.toFixed(0)}
                </span>
              </span>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Publishing…' : 'Publish changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   RIDER APP PREVIEW
   ========================================================================== */

function RiderAppPreview({
  values,
  currency,
  onClose,
}: {
  values: FareFormValues
  currency: string
  onClose: () => void
}) {
  const distance = 5
  const minutes = 12
  const fare = Math.max(
    values.baseFare + values.perKm * distance + values.perMinute * minutes,
    values.minimumFare,
  )

  return (
    <div
      className="sp-fade-in fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-title"
      onClick={onClose}
    >
      <div
        className="sp-pop w-full max-w-lg rounded-xl border border-border bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div>
            <h2 id="preview-title" className="text-sm font-bold text-ink">
              How riders will see this fare
            </h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Live preview — updates as you edit
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex justify-center">
            <div className="relative rounded-[2rem] border-[6px] border-navy bg-canvas p-1.5 w-full max-w-[260px]">
              <div className="rounded-[1.5rem] bg-gradient-to-b from-canvas to-surface p-3 min-h-[340px]">
                {/* Status bar */}
                <div className="flex items-center justify-between text-[9px] text-ink-muted mb-3">
                  <span>9:41</span>
                  <span className="font-semibold">Ride fare</span>
                </div>

                {/* Destination */}
                <div className="mb-3 rounded-lg bg-white border border-border p-2.5">
                  <div className="text-[9px] uppercase tracking-wide text-ink-muted">
                    To
                  </div>
                  <div className="text-[11px] font-semibold text-ink">
                    Palms Mall, Ring Road
                  </div>
                </div>

                {/* Fare card */}
                <div className="rounded-xl bg-white border border-border p-3 shadow-sm">
                  <div className="text-[9px] uppercase tracking-wide text-ink-muted mb-1">
                    Estimated fare
                  </div>
                  <div className="text-2xl font-bold text-ink tabular-nums">
                    {currency}
                    {fare.toFixed(0)}
                  </div>
                  <div className="mt-2 border-t border-border pt-2 space-y-1 text-[10px]">
                    <div className="flex justify-between text-ink-muted">
                      <span>Base fare</span>
                      <span>{currency}{values.baseFare.toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-ink-muted">
                      <span>{distance} km</span>
                      <span>
                        {currency}
                        {(values.perKm * distance).toFixed(0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-ink-muted">
                      <span>{minutes} min</span>
                      <span>
                        {currency}
                        {(values.perMinute * minutes).toFixed(0)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-1 text-[9px] text-emerald-dark bg-emerald-light/40 rounded px-1.5 py-1">
                    <Percent size={9} aria-hidden="true" />
                    Min fare {currency}{values.minimumFare.toFixed(0)} applies
                  </div>
                </div>

                {/* CTA */}
                <button
                  type="button"
                  disabled
                  className="mt-3 w-full rounded-lg bg-emerald py-2 text-[11px] font-semibold text-white"
                >
                  Confirm ride
                </button>
              </div>
            </div>
          </div>

          <p className="mt-3 text-center text-[11px] text-ink-muted">
            Riders see the breakdown and the total before confirming.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ==========================================================================
   VERSION HISTORY DRAWER
   ========================================================================== */

function VersionHistoryDrawer({
  versions,
  onRestore,
  onClose,
}: {
  versions: PricingVersion[]
  onRestore: (v: PricingVersion) => void
  onClose: () => void
}) {
  return (
    <div
      className="sp-fade-in fixed inset-0 z-50 flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Version history"
      onClick={onClose}
    >
      <div
        className="sp-slide-in flex h-full w-full max-w-md flex-col bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-sm font-bold text-ink">Version history</h2>
            <p className="mt-0.5 text-[11px] text-ink-muted">
              Recent saved configurations
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-ink-muted hover:bg-surface-alt hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {versions.length === 0 ? (
            <div className="text-center py-12">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-alt text-ink-muted">
                <History size={20} aria-hidden="true" />
              </div>
              <p className="text-xs text-ink-secondary">
                No saved versions yet.
              </p>
              <p className="mt-1 text-[11px] text-ink-muted">
                Every save creates a restore point here.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="rounded-lg border border-border bg-surface p-3 hover:border-emerald/40 transition-colors"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-ink">
                        Version {v.version}
                      </span>
                      <span className="text-[10px] text-ink-muted">
                        · {fmtRelative(v.savedAt)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRestore(v)}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold text-ink-secondary hover:border-emerald hover:text-emerald transition-colors"
                    >
                      <RotateCcw size={9} aria-hidden="true" />
                      Restore
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-ink-secondary">
                    <div>Base: {fmt(v.values.baseFare)}</div>
                    <div>Per km: {fmt(v.values.perKm)}</div>
                    <div>Per min: {fmt(v.values.perMinute)}</div>
                    <div>Min fare: {fmt(v.values.minimumFare)}</div>
                    <div>Cash: {fmt(v.values.cashSurcharge)}</div>
                    <div>Night: {fmt(v.values.nightSurcharge)}</div>
                  </div>
                  <div className="mt-1.5 text-[9px] text-ink-muted">
                    Saved by {v.savedBy}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}