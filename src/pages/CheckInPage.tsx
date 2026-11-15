import { Link } from 'react-router-dom'
import { ArrowLeft, QrCode } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { MembershipStatusBadge } from '@/components/ui/Badge'

export function CheckInPage() {
  const { profile } = useAuth()

  return (
    <div className="min-h-dvh bg-slate-950 px-4 py-6 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Dashboard
          </Link>
          {profile && <MembershipStatusBadge status={profile.membership_status} />}
        </div>

        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <QrCode className="size-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Gym check-in</h1>
          <p className="mt-1 text-sm text-slate-400">
            One tap to time in or out. Arriving in Phase 4.
          </p>
        </div>

        <Card className="mt-8 border-slate-800 bg-slate-900">
          <CardBody>
            <Alert tone="info" title="Database-ready">
              Attendance rules, the single-open-session constraint, and server-timestamp recording
              are already enforced in PostgreSQL. The check-in interface and trusted RPCs ship in
              Phase 4.
            </Alert>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
