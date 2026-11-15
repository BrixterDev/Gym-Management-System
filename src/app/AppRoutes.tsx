import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '@/layouts/AuthLayout'
import { AdminLayout } from '@/layouts/AdminLayout'
import { ClientLayout } from '@/layouts/ClientLayout'
import { LoginPage } from '@/features/auth/LoginPage'
import { RegisterPage } from '@/features/auth/RegisterPage'
import { PendingApprovalPage, BlockedAccountPage } from '@/features/auth/StatusPages'
import { RequireAuth, RequireRole, RequireSession, RootRedirect } from './guards'
import { AdminDashboardPage } from '@/features/dashboard/AdminDashboardPage'
import { ClientDashboardPage } from '@/features/dashboard/ClientDashboardPage'
import { ClientsPage } from '@/features/clients/ClientsPage'
import { ClientDetailPage } from '@/features/clients/ClientDetailPage'
import { ApprovalsPage } from '@/features/clients/ApprovalsPage'
import { MembershipPlansPage } from '@/features/memberships/MembershipPlansPage'
import { SubscriptionsPage } from '@/features/memberships/SubscriptionsPage'
import { PaymentsPage } from '@/features/payments/PaymentsPage'
import { ComingSoonPage, NotFoundPage } from '@/pages/PlaceholderPages'
import { CheckInPage } from '@/pages/CheckInPage'

export function AppRoutes() {
  return (
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
            <Route
              path="attendance"
              element={<ComingSoonPage title="Attendance" phase="Phase 4" />}
            />
            <Route path="payments" element={<PaymentsPage />} />
            <Route
              path="reports"
              element={<ComingSoonPage title="Reports" phase="Phase 6" />}
            />
            <Route
              path="settings"
              element={<ComingSoonPage title="Settings" phase="Phase 4" />}
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="client" />}>
          <Route path="/app" element={<ClientLayout />}>
            <Route index element={<ClientDashboardPage />} />
            <Route
              path="attendance"
              element={<ComingSoonPage title="My Attendance" phase="Phase 4" />}
            />
            <Route
              path="progress"
              element={<ComingSoonPage title="My Progress" phase="Phase 5" />}
            />
            <Route
              path="profile"
              element={<ComingSoonPage title="My Profile" phase="Phase 5" />}
            />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Route>
          <Route path="/checkin" element={<CheckInPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
