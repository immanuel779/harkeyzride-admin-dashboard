import { z } from 'zod'

export const fareSchema = z.object({
  baseFare: z
    .number({ error: 'Base fare is required' })
    .min(0, 'Must be 0 or more')
    .max(5000, 'Too high'),

  perKmRate: z
    .number({ error: 'Per-km rate is required' })
    .min(0, 'Must be 0 or more')
    .max(1000, 'Too high'),

  perMinuteRate: z
    .number({ error: 'Per-minute rate is required' })
    .min(0, 'Must be 0 or more')
    .max(500, 'Too high'),

  surgeMultiplier: z
    .number({ error: 'Surge multiplier is required' })
    .min(1, 'Minimum 1.0')
    .max(3, 'Maximum 3.0'),

  lockedFareEnabled: z.boolean(),
  lockedFareMinutes: z
    .number({ error: 'Lock duration is required' })
    .min(1, 'At least 1 minute')
    .max(60, 'Maximum 60 minutes'),

  cngDiscountPercent: z
    .number({ error: 'CNG discount is required' })
    .min(0, 'Must be 0 or more')
    .max(50, 'Maximum 50%'),

  cancellationFee: z
    .number({ error: 'Cancellation fee is required' })
    .min(0, 'Must be 0 or more')
    .max(2000, 'Too high'),

  freeCancelMinutes: z
    .number({ error: 'Free cancel window is required' })
    .min(0, 'Must be 0 or more')
    .max(15, 'Maximum 15 minutes'),

  commissionPercent: z
    .number({ error: 'Commission is required' })
    .min(0, 'Must be 0 or more')
    .max(50, 'Maximum 50%'),
})

export type FareFormValues = z.infer<typeof fareSchema>

export const DEFAULT_FARE_VALUES: FareFormValues = {
  baseFare: 500,
  perKmRate: 187,
  perMinuteRate: 12.5,
  surgeMultiplier: 1.0,
  lockedFareEnabled: true,
  lockedFareMinutes: 5,
  cngDiscountPercent: 10,
  cancellationFee: 200,
  freeCancelMinutes: 4,
  commissionPercent: 20,
}