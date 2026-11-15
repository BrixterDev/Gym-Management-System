import { useLocation } from 'react-router-dom'
import { QrCode, TrendingUp } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PageHeader, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import {
  AccountStatusBadge,
  MembershipStatusBadge,
} from '@/components/ui/Badge'
import { Link } from 'react-router-dom'
import { formatDate } from '@/lib/utils'

export function ClientDashboardPage() {
  const { profile, clientDetail } = useAuth()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice

  return (
    <div>
      <PageHeader
        title={`Hello${clientDetail?.display_name ? `, ${clientDetail.display_name}` : ''}`}
        description="Your membership and attendance at a glance."
      />

      {notice && (
        <div className="mb-5">
          <Alert tone="warning">{notice}</Alert>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader title="My account" description="Managed by the gym" />
          <CardBody className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Email</span>
              <span className="truncate font-medium text-slate-900">{profile?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Member code</span>
              <span className="font-medium text-slate-900">{clientDetail?.member_code ?? 'Not assigned'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Account status</span>
              {profile && <AccountStatusBadge status={profile.account_status} />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Membership</span>
              {profile && <MembershipStatusBadge status={profile.membership_status} />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Member since</span>
              <span className="font-medium text-slate-900">{formatDate(profile?.created_at)}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Check in at the gym" description="Scan the gym's Client QR code" />
          <CardBody>
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
              <QrCode className="size-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Time in and time out in one tap. Your session is validated against your account and
              membership status on the server.
            </p>
            <Link
              to="/checkin"
              className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 sm:w-auto"
            >
              <QrCode className="size-4" aria-hidden />
              Open check-in
            </Link>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Fitness progress" description="Weight, height, and waist trends" />
        <CardBody className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <TrendingUp className="size-5" aria-hidden />
          </span>
          <p className="text-sm leading-relaxed text-slate-600">
            Progress tracking and charts arrive in Phase 5. You'll be able to record weight, height,
            and waist measurements and review your trend over time.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
