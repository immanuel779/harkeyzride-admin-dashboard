import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { RidesChartPoint } from '../services/dashboard'

type Props = {
  data: RidesChartPoint[]
}

export function RidesChart({ data }: Props) {
  return (
    <div className="rounded-xl bg-surface border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">Rides · Last 7 days</h3>
          <p className="text-xs text-ink-secondary mt-0.5">
            Daily trip volume across Ibadan
          </p>
        </div>
      </div>

      <div className="h-56 -ml-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="ridesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1E9A46" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#1E9A46" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E3E6EB" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="day"
              stroke="#8A929E"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="#8A929E"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 10,
                border: '1px solid #E3E6EB',
                fontSize: 12,
              }}
            />
            <Area
              type="monotone"
              dataKey="rides"
              stroke="#1E9A46"
              strokeWidth={2}
              fill="url(#ridesFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}