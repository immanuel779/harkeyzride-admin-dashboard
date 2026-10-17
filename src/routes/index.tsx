import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { RouteErrorBoundary } from '../components/shared/RouteErrorBoundary'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { NotFoundPage } from '../features/shared/pages/NotFoundPage'
import { ProtectedRoute } from './ProtectedRoute'

// Lazy-loaded protected pages
const DashboardPage = lazy(() =>
  import('../features/dashboard/pages/DashboardPage').then((m) => ({
    default: m.DashboardPage,
  })),
)

const RidersPage = lazy(() =>
  import('../features/riders/pages/RidersPage').then((m) => ({
    default: m.RidersPage,
  })),
)
const RiderDetailPage = lazy(() =>
  import('../features/riders/pages/RiderDetailPage').then((m) => ({
    default: m.RiderDetailPage,
  })),
)

const DriversPage = lazy(() =>
  import('../features/drivers/pages/DriversPage').then((m) => ({
    default: m.DriversPage,
  })),
)
const DriverDetailPage = lazy(() =>
  import('../features/drivers/pages/DriverDetailPage').then((m) => ({
    default: m.DriverDetailPage,
  })),
)

const RidesPage = lazy(() =>
  import('../features/rides/pages/RidesPage').then((m) => ({
    default: m.RidesPage,
  })),
)
const RideDetailPage = lazy(() =>
  import('../features/rides/pages/RideDetailPage').then((m) => ({
    default: m.RideDetailPage,
  })),
)

const FinancialsPage = lazy(() =>
  import('../features/financials/pages/FinancialsPage').then((m) => ({
    default: m.FinancialsPage,
  })),
)

const SubscriptionPage = lazy(() =>
  import('../features/subscription/pages/SubscriptionPage').then((m) => ({
    default: m.SubscriptionPage,
  })),
)

const CancellationsPage = lazy(() =>
  import('../features/cancellations/pages/CancellationsPage').then((m) => ({
    default: m.CancellationsPage,
  })),
)

const CngRebatePage = lazy(() =>
  import('../features/cng/pages/CngRebatePage').then((m) => ({
    default: m.CngRebatePage,
  })),
)

const SosPage = lazy(() =>
  import('../features/sos/pages/SosPage').then((m) => ({
    default: m.SosPage,
  })),
)

const ChatPage = lazy(() =>
  import('../features/chat/pages/ChatPage').then((m) => ({
    default: m.ChatPage,
  })),
)

const TeamPage = lazy(() =>
  import('../features/team/pages/TeamPage').then((m) => ({
    default: m.TeamPage,
  })),
)

const AuditPage = lazy(() =>
  import('../features/audit/pages/AuditPage').then((m) => ({
    default: m.AuditPage,
  })),
)

const SettingsPage = lazy(() =>
  import('../features/settings/pages/SettingsPage').then((m) => ({
    default: m.SettingsPage,
  })),
)
const WithdrawalsPage = lazy(() =>
  import('../features/withdrawals/pages/WithdrawalsPage').then((m) => ({
    default: m.WithdrawalsPage,
  })),
)

const PromotionsPage = lazy(() =>
  import('../features/promotions/pages/PromotionsPage').then((m) => ({
    default: m.PromotionsPage,
  })),
)

const ComplaintsPage = lazy(() =>
  import('../features/complaints/pages/ComplaintsPage').then((m) => ({
    default: m.ComplaintsPage,
  })),
)

// ─── NEW ─── KYC document review queue
const DocumentsReviewPage = lazy(() =>
  import('../features/documents/pages/DocumentsReviewPage').then((m) => ({
    default: m.DocumentsReviewPage,
  })),
)
// ─── END NEW ───

// Suspense fallback while lazy chunks load
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-emerald border-t-transparent animate-spin" />
        <p className="text-xs text-ink-muted">Loading…</p>
      </div>
    </div>
  )
}

function withSuspense(node: React.ReactNode, title: string) {
  return (
    <RouteErrorBoundary title={title}>
      <Suspense fallback={<PageLoader />}>{node}</Suspense>
    </RouteErrorBoundary>
  )
}

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },

  {
    element: <ProtectedRoute />,
    children: [
      { path: '/dashboard', element: withSuspense(<DashboardPage />, 'Overview') },
      { path: '/riders', element: withSuspense(<RidersPage />, 'Riders') },
      { path: '/riders/:id', element: withSuspense(<RiderDetailPage />, 'Rider Detail') },
      { path: '/drivers', element: withSuspense(<DriversPage />, 'Drivers') },
      { path: '/drivers/:id', element: withSuspense(<DriverDetailPage />, 'Driver Detail') },

      // ─── NEW ─── KYC review queue lives right after drivers
      { path: '/documents', element: withSuspense(<DocumentsReviewPage />, 'Document Review') },
      // ─── END NEW ───

      { path: '/rides', element: withSuspense(<RidesPage />, 'Rides') },
      { path: '/rides/:id', element: withSuspense(<RideDetailPage />, 'Ride Detail') },
      { path: '/financials', element: withSuspense(<FinancialsPage />, 'Financials') },
      { path: '/subscriptions', element: withSuspense(<SubscriptionPage />, 'Subscriptions') },
      { path: '/cancellations', element: withSuspense(<CancellationsPage />, 'Cancellations') },
      { path: '/cng-rebate', element: withSuspense(<CngRebatePage />, 'CNG Rebate') },
      { path: '/sos', element: withSuspense(<SosPage />, 'SOS Desk') },
      { path: '/chat', element: withSuspense(<ChatPage />, 'Team Chat') },
      { path: '/team', element: withSuspense(<TeamPage />, 'Admin Team') },
      { path: '/audit', element: withSuspense(<AuditPage />, 'Audit Export') },
      { path: '/settings', element: withSuspense(<SettingsPage />, 'Settings') },
      { path: '/withdrawals', element: withSuspense(<WithdrawalsPage />, 'Withdrawals') },
      { path: '/promotions', element: withSuspense(<PromotionsPage />, 'Promotions') },
      { path: '/complaints', element: withSuspense(<ComplaintsPage />, 'Complaints') },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])