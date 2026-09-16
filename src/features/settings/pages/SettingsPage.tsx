import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  DollarSign,
  Zap,
  Lock,
  Leaf,
  AlertTriangle,
  Percent,
  Save,
  RotateCcw,
} from 'lucide-react'

import { AppShell } from '../../../components/layout/AppShell'
import { FormField } from '../components/FormField'
import { SettingsSection } from '../components/SettingsSection'
import { Toggle } from '../components/Toggle'
import { toast } from '../../../lib/toast'
import {
  DEFAULT_FARE_VALUES,
  fareSchema,
  type FareFormValues,
} from '../schemas/fareSchema'

export function SettingsPage() {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FareFormValues>({
    resolver: zodResolver(fareSchema),
    defaultValues: DEFAULT_FARE_VALUES,
  })

  const lockedFareEnabled = watch('lockedFareEnabled')

  const onSubmit = async (data: FareFormValues) => {
    // 🟡 BACKEND REQUIRED — PATCH /admin/settings/fare
    // Payload shape matches FareFormValues
    await new Promise((r) => setTimeout(r, 700))
    console.log('Fare settings saved:', data)
    toast.success('Fare settings saved', 'New policy applies to future rides.')
  }

  const handleReset = () => {
    reset(DEFAULT_FARE_VALUES)
    toast.info('Form reset', 'Values restored to defaults.')
  }

  const numRegister = (name: keyof FareFormValues) =>
    register(name, { valueAsNumber: true })

  return (
    <AppShell title="Settings">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Header bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">
              Fare & Geotherm Parameters
            </h2>
            <p className="text-xs text-ink-secondary mt-0.5">
              Admin fare policy engine. Changes apply to new ride requests only.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!isDirty || isSubmitting}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-ink hover:bg-surface-alt transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isDirty}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald text-sm font-semibold text-white hover:bg-emerald-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Save size={14} />
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>

        {/* Section 1: Base pricing */}
        <SettingsSection
          icon={DollarSign}
          title="Base pricing"
          description="Core rate structure for CNG Economy rides"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              label="Base fare"
              prefix="₦"
              type="number"
              step="1"
              placeholder="500"
              error={errors.baseFare?.message}
              {...numRegister('baseFare')}
            />
            <FormField
              label="Per km rate"
              prefix="₦"
              type="number"
              step="0.01"
              placeholder="187"
              error={errors.perKmRate?.message}
              {...numRegister('perKmRate')}
            />
            <FormField
              label="Per minute rate"
              prefix="₦"
              type="number"
              step="0.01"
              placeholder="12.5"
              error={errors.perMinuteRate?.message}
              {...numRegister('perMinuteRate')}
            />
          </div>
        </SettingsSection>

        {/* Section 2: Surge */}
        <SettingsSection
          icon={Zap}
          title="Surge pricing"
          description="Multiplier applied during peak hours or high demand"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              label="Surge multiplier"
              suffix="×"
              type="number"
              step="0.1"
              placeholder="1.0"
              hint="1.0 = no surge. Max 3.0"
              error={errors.surgeMultiplier?.message}
              {...numRegister('surgeMultiplier')}
            />
            <FormField
              label="CNG discount"
              suffix="%"
              type="number"
              step="0.1"
              placeholder="10"
              hint="Discount for CNG vehicle rides"
              error={errors.cngDiscountPercent?.message}
              {...numRegister('cngDiscountPercent')}
            />
            <FormField
              label="Platform commission"
              suffix="%"
              type="number"
              step="0.1"
              placeholder="20"
              hint="Deducted from driver earnings"
              error={errors.commissionPercent?.message}
              {...numRegister('commissionPercent')}
            />
          </div>
        </SettingsSection>

        {/* Section 3: Locked Fare Guarantee */}
        <SettingsSection
          icon={Lock}
          title="Locked Fare Guarantee"
          description="Ensure the quoted fare never changes, regardless of traffic or route"
        >
          <div className="space-y-3">
            <Toggle
              checked={lockedFareEnabled}
              onChange={(v) => setValue('lockedFareEnabled', v, { shouldDirty: true })}
              label="Enable Locked Fare Guarantee"
              description="Displayed fare is final — no adjustments mid-trip"
            />

            {lockedFareEnabled ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
                <FormField
                  label="Lock duration"
                  suffix="min"
                  type="number"
                  step="1"
                  placeholder="5"
                  hint="Quote expires after this window"
                  error={errors.lockedFareMinutes?.message}
                  {...numRegister('lockedFareMinutes')}
                />
              </div>
            ) : null}
          </div>
        </SettingsSection>

        {/* Section 4: Cancellations */}
        <SettingsSection
          icon={AlertTriangle}
          title="Cancellation policy"
          description="Fee applied when rider cancels after the free window"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Cancellation fee"
              prefix="₦"
              type="number"
              step="1"
              placeholder="200"
              hint="Charged from wallet after grace period"
              error={errors.cancellationFee?.message}
              {...numRegister('cancellationFee')}
            />
            <FormField
              label="Free cancel window"
              suffix="min"
              type="number"
              step="1"
              placeholder="4"
              hint="Rider can cancel free within this window"
              error={errors.freeCancelMinutes?.message}
              {...numRegister('freeCancelMinutes')}
            />
          </div>
        </SettingsSection>

        {/* Section 5: Geotherm */}
        <SettingsSection
          icon={Leaf}
          title="Geotherm & environmental"
          description="CNG-specific policy and emission tracking"
        >
          <div className="rounded-lg bg-emerald-light border border-emerald/20 p-4 text-xs text-ink-secondary">
            <div className="flex items-start gap-2">
              <Leaf size={14} className="text-emerald flex-shrink-0 mt-0.5" />
              <div>
                CNG vehicles receive a <strong className="text-ink">10% discount</strong> on
                every trip. This is applied automatically at fare calculation and shown as
                a separate line item on the rider's receipt.
              </div>
            </div>
          </div>
        </SettingsSection>

        {/* Section 6: Preview */}
        <SettingsSection
          icon={Percent}
          title="Fare preview"
          description="Sample breakdown with current values"
        >
          <FarePreview values={watch()} />
        </SettingsSection>

        {/* Sticky save bar (mobile) */}
        <div className="sticky bottom-4 lg:hidden">
          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald text-sm font-semibold text-white hover:bg-emerald-dark shadow-lg transition-colors disabled:opacity-40"
          >
            <Save size={16} />
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
    </AppShell>
  )
}

function FarePreview({ values }: { values: FareFormValues }) {
  const distanceKm = 3.2
  const minutes = 8

  const distance = values.perKmRate * distanceKm
  const time = values.perMinuteRate * minutes
  const subtotal = values.baseFare + distance + time
  const cngDiscount = subtotal * (values.cngDiscountPercent / 100)
  const total = subtotal - cngDiscount

  const fmt = (n: number) =>
    Number.isFinite(n) ? `₦${n.toFixed(0)}` : '₦—'

  return (
    <div className="rounded-lg border border-border divide-y divide-border text-sm">
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">Base fare</span>
        <span className="text-ink font-medium">{fmt(values.baseFare)}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">
          Distance ({distanceKm} km × ₦{values.perKmRate})
        </span>
        <span className="text-ink font-medium">{fmt(distance)}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">
          Time ({minutes} min × ₦{values.perMinuteRate})
        </span>
        <span className="text-ink font-medium">{fmt(time)}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-2.5">
        <span className="text-ink-secondary">
          CNG discount ({values.cngDiscountPercent}%)
        </span>
        <span className="text-emerald font-medium">-{fmt(cngDiscount)}</span>
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-emerald-light/40">
        <span className="text-ink font-semibold">Sample total</span>
        <span className="text-emerald-dark font-bold text-base">{fmt(total)}</span>
      </div>
    </div>
  )
}