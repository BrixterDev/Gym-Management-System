import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { PendingApprovalPage, BlockedAccountPage } from '@/features/auth/StatusPages'
import { RequireAuth, RequireRole, RequireSession, RootRedirect } from './guards'
import { PageLoader } from '@/components/ui/Feedback'
import { NotFoundPage } from '@/pages/PlaceholderPages'

// Route-level code splitting keeps the initial bundle small; each portal page
// (and its charts/QR dependencies) loads only when visited.
const AdminDashboardPage = lazy(() =>
  import('@/features/dashboard/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  })),
)
const ClientDashboardPage = lazy(() =>
  import('@/features/dashboard/ClientDashboardPage').then((m) => ({
    default: m.ClientDashboardPage,
  })),
)
const ClientsPage = lazy(() =>
  import('@/features/clients/ClientsPage').then((m) => ({ default: m.ClientsPage })),
)
const ClientDetailPage = lazy(() =>
  import('@/features/clients/ClientDetailPage').then((m) => ({
    default: m.ClientDetailPage,
  })),
)
const ApprovalsPage = lazy(() =>
  import('@/features/clients/ApprovalsPage').then((m) => ({ default: m.ApprovalsPage })),
)
const MembershipPlansPage = lazy(() =>
  import('@/features/memberships/MembershipPlansPage').then((m) => ({
    default: m.MembershipPlansPage,
  })),
)
const SubscriptionsPage = lazy(() =>
  import('@/features/memberships/SubscriptionsPage').then((m) => ({
    default: m.SubscriptionsPage,
  })),
)
const PaymentsPage = lazy(() =>
  import('@/features/payments/PaymentsPage').then((m) => ({ default: m.PaymentsPage })),
)
const AttendancePage = lazy(() =>
  import('@/features/attendance/AttendancePage').then((m) => ({
    default: m.AttendancePage,
  })),
)
const ClientAttendancePage = lazy(() =>
  import('@/features/attendance/ClientAttendancePage').then((m) => ({
    default: m.ClientAttendancePage,
  })),
)
const ProgressPage = lazy(() =>
  import('@/features/metrics/ProgressPage').then((m) => ({ default: m.ProgressPage })),
)
const ProfilePage = lazy(() =>
  import('@/features/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })),
)
const ReportsPage = lazy(() =>
  import('@/features/reports/ReportsPage').then((m) => ({ default: m.ReportsPage })),
)
const SettingsPage = lazy(() =>
  import('@/features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const CheckInPage = lazy(() =>
  import('@/pages/CheckInPage').then((m) => ({ default: m.CheckInPage })),
)

export function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<RootRedirect />} />

        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireSession />}>
            <Route path="/pending" element={<PendingApprovalPage />} />
            <Route path="/blocked" element={<BlockedAccountPage />} />
          </Route>
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<RequireRole role="admin" />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboardPage />} />
              <Route path="clients" element={<ClientsPage />} />
              <Route path="clients/:clientId" element={<ClientDetailPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="plans" element={<MembershipPlansPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="payments" element={<PaymentsPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/admin" replace />} />
            </Route>
          </Route>

          <Route element={<RequireRole role="client" />}>
            <Route path="/app" element={<ClientLayout />}>
              <Route index element={<ClientDashboardPage />} />
              <Route path="attendance" element={<ClientAttendancePage />} />
              <Route path="progress" element={<ProgressPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Route>
            <Route path="/checkin" element={<CheckInPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  )
}
