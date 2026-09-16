import { createBrowserRouter } from 'react-router-dom'

import { RouteErrorBoundary } from '../components/shared/RouteErrorBoundary'
import { AuditPage } from '../features/audit/pages/AuditPage'
import { LoginPage } from '../features/auth/pages/LoginPage'
import { ChatPage } from '../features/chat/pages/ChatPage'
import { DashboardPage } from '../features/dashboard/pages/DashboardPage'
import { DriverDetailPage } from '../features/drivers/pages/DriverDetailPage'
import { DriversPage } from '../features/drivers/pages/DriversPage'
import { FinancialsPage } from '../features/financials/pages/FinancialsPage'
import { RiderDetailPage } from '../features/riders/pages/RiderDetailPage'
import { RidersPage } from '../features/riders/pages/RidersPage'
import { RideDetailPage } from '../features/rides/pages/RideDetailPage'
import { RidesPage } from '../features/rides/pages/RidesPage'
import { SettingsPage } from '../features/settings/pages/SettingsPage'
import { NotFoundPage } from '../features/shared/pages/NotFoundPage'
import { SosPage } from '../features/sos/pages/SosPage'
import { ProtectedRoute } from './ProtectedRoute'

export const router = createBrowserRouter([
  { path: '/', element: <LoginPage /> },
  { path: '/login', element: <LoginPage /> },

  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/dashboard',
        element: (
          <RouteErrorBoundary title="Overview">
            <DashboardPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/riders',
        element: (
          <RouteErrorBoundary title="Riders">
            <RidersPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/riders/:id',
        element: (
          <RouteErrorBoundary title="Rider Detail">
            <RiderDetailPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/drivers',
        element: (
          <RouteErrorBoundary title="Drivers">
            <DriversPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/drivers/:id',
        element: (
          <RouteErrorBoundary title="Driver Detail">
            <DriverDetailPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/rides',
        element: (
          <RouteErrorBoundary title="Rides">
            <RidesPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/rides/:id',
        element: (
          <RouteErrorBoundary title="Ride Detail">
            <RideDetailPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/financials',
        element: (
          <RouteErrorBoundary title="Financials">
            <FinancialsPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/sos',
        element: (
          <RouteErrorBoundary title="SOS Desk">
            <SosPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/chat',
        element: (
          <RouteErrorBoundary title="Team Chat">
            <ChatPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/audit',
        element: (
          <RouteErrorBoundary title="Audit Log">
            <AuditPage />
          </RouteErrorBoundary>
        ),
      },
      {
        path: '/settings',
        element: (
          <RouteErrorBoundary title="Settings">
            <SettingsPage />
          </RouteErrorBoundary>
        ),
      },
    ],
  },

  { path: '*', element: <NotFoundPage /> },
])