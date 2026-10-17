import { z } from 'zod'

export const fareSchema = z.object({
  baseFare: z.number({ error: 'Base fare is required' }).min(0).max(10000),
  perKm: z.number({ error: 'Per-km rate is required' }).min(0).max(5000),
  perMinute: z.number({ error: 'Per-minute rate is required' }).min(0).max(1000),
  minimumFare: z.number({ error: 'Minimum fare is required' }).min(0).max(20000),
  cashSurcharge: z.number({ error: 'Cash surcharge is required' }).min(0).max(5000),
  nightSurcharge: z.number({ error: 'Night surcharge is required' }).min(0).max(5000),
})

export type FareFormValues = z.infer<typeof fareSchema>

export const DEFAULT_FARE_VALUES: FareFormValues = {
  baseFare: 500,
  perKm: 150,
  perMinute: 20,
  minimumFare: 800,
  cashSurcharge: 100,
  nightSurcharge: 50,
}