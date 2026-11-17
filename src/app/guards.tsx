import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { PageLoader } from '@/components/ui/Feedback'
import type { UserRole } from '@/types/database'

export function RequireSession() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  return <Outlet />
}

export function RequireAuth() {
  const { session, profile, loading } = useAuth()
  const location = useLocation()

  if (loading) return <PageLoader />
  if (!session) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />
  }
  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Profile unavailable</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            We couldn't load your profile. Please refresh, or contact the gym administrator.
          </p>
        </div>
      </div>
    )
  }
  if (profile.account_status === 'pending') return <Navigate to="/pending" replace />
  if (profile.account_status === 'rejected' || profile.account_status === 'suspended') {
    return <Navigate to="/blocked" replace />
  }
  return <Outlet />
}

export function RequireRole({ role }: { role: UserRole }) {
  const { profile } = useAuth()

  if (!profile) return <Navigate to="/login" replace />
  if (profile.role !== role) {
    // Admins scanning a client QR land in the admin portal instead of looping on /app.
    if (profile.role === 'admin') return <Navigate to="/admin" replace />
    // Non-admins scanning the Admin QR code land in the client portal with a notice.
    return (
      <Navigate
        to="/app"
        replace
        state={{ notice: 'That link is for gym staff. You have been redirected to your portal.' }}
      />
    )
  }
  return <Outlet />
}

export function RootRedirect() {
  const { session, profile, loading, profileError } = useAuth()

  if (loading) return <PageLoader />
  if (!session) return <Navigate to="/login" replace />
  if (!profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6 text-center">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Profile unavailable</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-500">
            {profileError ?? 'We could not load your profile. Please contact the gym administrator.'}
          </p>
        </div>
      </div>
    )
  }
  if (profile.account_status === 'pending') return <Navigate to="/pending" replace />
  if (profile.account_status === 'rejected' || profile.account_status === 'suspended') {
    return <Navigate to="/blocked" replace />
  }
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/app'} replace />
}
