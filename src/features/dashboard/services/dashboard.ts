// 🟡 BACKEND REQUIRED — Oladayo's endpoints
// GET /admin/dashboard/kpis
// GET /admin/dashboard/activity
// GET /admin/dashboard/rides-chart?range=7d
import { api } from '../../../lib/apiClient'
export type KpiMetric = {
  id: string
  label: string
  value: string
  delta: number
  deltaLabel: string
  positive: boolean
  icon: 'rides' | 'revenue' | 'drivers' | 'sos'
}

export type ActivityItem = {
  id: string
  type: 'ride_completed' | 'driver_approved' | 'sos_triggered' | 'payout' | 'cancellation'
  title: string
  meta: string
  timestamp: string
}

export type RidesChartPoint = {
  day: string
  rides: number
  revenue: number
}

const now = Date.now()
const minAgo = (m: number) => new Date(now - m * 60 * 1000).toISOString()

export const MOCK_KPIS: KpiMetric[] = [
  {
    id: 'rides_today',
    label: 'Rides Today',
    value: '247',
    delta: 12.4,
    deltaLabel: 'vs yesterday',
    positive: true,
    icon: 'rides',
  },
  {
    id: 'revenue_today',
    label: 'Revenue Today',
    value: '₦386,500',
    delta: 8.1,
    deltaLabel: 'vs yesterday',
    positive: true,
    icon: 'revenue',
  },
  {
    id: 'active_drivers',
    label: 'Active Drivers',
    value: '84',
    delta: -3.2,
    deltaLabel: 'vs yesterday',
    positive: false,
    icon: 'drivers',
  },
  {
    id: 'sos_open',
    label: 'SOS Open',
    value: '2',
    delta: 0,
    deltaLabel: 'right now',
    positive: true,
    icon: 'sos',
  },
]

export const MOCK_ACTIVITY: ActivityItem[] = [
  {
    id: 'act_1',
    type: 'sos_triggered',
    title: 'SOS triggered — Ride #4821',
    meta: 'Rider: Seyi A. · Driver: John S.',
    timestamp: minAgo(2),
  },
  {
    id: 'act_2',
    type: 'ride_completed',
    title: 'Ride completed — ₦1,200',
    meta: 'Bodija → Sweet Sensation',
    timestamp: minAgo(7),
  },
  {
    id: 'act_3',
    type: 'driver_approved',
    title: 'Driver approved — Musa I.',
    meta: 'Approved by Damilare O.',
    timestamp: minAgo(18),
  },
  {
    id: 'act_4',
    type: 'payout',
    title: 'Driver payout processed',
    meta: 'Wema · ₦45,200 · 12 drivers',
    timestamp: minAgo(41),
  },
  {
    id: 'act_5',
    type: 'cancellation',
    title: 'Cancellation fee charged — ₦200',
    meta: 'Rider: Tunde B. · Over 4-min window',
    timestamp: minAgo(58),
  },
  {
    id: 'act_6',
    type: 'ride_completed',
    title: 'Ride completed — ₦900',
    meta: 'Ring Road → Palms Mall',
    timestamp: minAgo(72),
  },
]

export const MOCK_CHART: RidesChartPoint[] = [
  { day: 'Mon', rides: 182, revenue: 284000 },
  { day: 'Tue', rides: 214, revenue: 331000 },
  { day: 'Wed', rides: 198, revenue: 298000 },
  { day: 'Thu', rides: 231, revenue: 356000 },
  { day: 'Fri', rides: 289, revenue: 441000 },
  { day: 'Sat', rides: 312, revenue: 478000 },
  { day: 'Sun', rides: 247, revenue: 386500 },
]

export async function getKpis(): Promise<KpiMetric[]> {
  await new Promise((r) => setTimeout(r, 300))
  return MOCK_KPIS
}

export async function getActivity(): Promise<ActivityItem[]> {
  await new Promise((r) => setTimeout(r, 400))
  return MOCK_ACTIVITY
}

export async function getRidesChart(): Promise<RidesChartPoint[]> {
  await new Promise((r) => setTimeout(r, 350))
  return MOCK_CHART
}
// ---------- Aggregated fetch (used by TanStack Query) ----------

export type DashboardOverview = {
  kpis: KpiMetric[]
  activity: ActivityItem[]
  chart: RidesChartPoint[]
}

// 🟡 BACKEND REQUIRED — GET /admin/dashboard/overview
export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  await new Promise((r) => setTimeout(r, 500))
  return {
    kpis: MOCK_KPIS,
    activity: MOCK_ACTIVITY,
    chart: MOCK_CHART,
  }
}

// ---------- Real API branch ----------

type BackendDashboard = {
  users: number
  riders: number
  drivers: number
  rides: number
  activeDrivers: number
  completedRides: number
  pendingDrivers: number
  openSos: number
  pendingWithdrawals: number
  pendingDocuments: number
  activeSubscriptions: number
  totalRevenue: number
  totalPayouts: number
}

export async function fetchDashboardOverviewReal(): Promise<DashboardOverview> {
  const [dashboard, analytics] = await Promise.all([
    api.get<BackendDashboard>('/admin/dashboard'),
    api
      .get<{
        rides: { byDay: { date: string; count: number }[] }
        revenue: { byDay: { date: string; amount: number }[] }
      }>('/admin/analytics', { query: { from: new Date(Date.now() - 7 * 86400000).toISOString() } })
      .catch(() => null),
  ])

  // Build KPIs from real numbers
  const kpis: KpiMetric[] = [
    {
      id: 'rides',
      label: 'Total Rides',
      value: dashboard.rides.toLocaleString(),
      delta: 0,
      deltaLabel: 'all time',
      positive: true,
      icon: 'rides',
    },
    {
      id: 'revenue',
      label: 'Total Revenue',
      value: `₦${dashboard.totalRevenue.toLocaleString()}`,
      delta: 0,
      deltaLabel: 'all time',
      positive: true,
      icon: 'revenue',
    },
    {
      id: 'drivers',
      label: 'Active Drivers',
      value: dashboard.activeDrivers.toString(),
      delta: 0,
      deltaLabel: `of ${dashboard.drivers}`,
      positive: true,
      icon: 'drivers',
    },
    {
      id: 'sos',
      label: 'Open SOS',
      value: dashboard.openSos.toString(),
      delta: 0,
      deltaLabel: 'right now',
      positive: true,
      icon: 'sos',
    },
  ]

  // Build chart data from analytics byDay
  const chart: RidesChartPoint[] = (analytics?.rides.byDay ?? [])
    .slice(-7)
    .map((d) => ({
      day: new Date(d.date).toLocaleDateString('en-NG', { weekday: 'short' }),
      rides: d.count,
      revenue: 0,
    }))

  // Fallback to empty chart if no data
  const finalChart = chart.length > 0 ? chart : MOCK_CHART.map((c) => ({ ...c, rides: 0, revenue: 0 }))

  return {
    kpis,
    activity: [],
    chart: finalChart,
  }
}