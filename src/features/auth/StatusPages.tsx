import { Link } from 'react-router-dom'
import { Clock, ShieldAlert, ShieldX, LogOut } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/Button'
import { AccountStatusBadge } from '@/components/ui/Badge'

export function PendingApprovalPage() {
  const { profile, refresh, signOut } = useAuth()

  return (
    <div className="text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
        <Clock className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-slate-900">Approval pending</h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        Your account is waiting for the gym administrator to approve it and set up your member
        profile. You'll be able to check in and view your progress once approved.
      </p>

      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-600">
        <span>Account status:</span>
        {profile && <AccountStatusBadge status={profile.account_status} />}
      </div>

      <div className="mt-7 space-y-2.5">
        <Button className="w-full" onClick={() => void refresh()}>
          Check again
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      </div>
    </div>
  )
}

export function BlockedAccountPage() {
  const { profile, signOut } = useAuth()
  const suspended = profile?.account_status === 'suspended'
  const Icon = suspended ? ShieldX : ShieldAlert

  return (
    <div className="text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
        <Icon className="size-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-xl font-semibold text-slate-900">
        {suspended ? 'Account suspended' : 'Registration not approved'}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">
        {suspended
          ? 'Your account has been suspended. Please contact the gym front desk for assistance.'
          : 'Your registration was not approved. Please contact the gym front desk if you believe this is a mistake.'}
      </p>

      <div className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-600">
        <span>Account status:</span>
        {profile && <AccountStatusBadge status={profile.account_status} />}
      </div>

      <div className="mt-7 space-y-2.5">
        <Button variant="outline" className="w-full" onClick={() => void signOut()}>
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
        <p className="text-xs text-slate-400">
          Need help?{' '}
          <Link to="/login" className="underline">
            Return to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
