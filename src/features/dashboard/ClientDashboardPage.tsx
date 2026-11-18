import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { QrCode, TrendingUp } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PageHeader, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import {
  AccountStatusBadge,
  MembershipStatusBadge,
} from '@/components/ui/Badge'
import { Link } from 'react-router-dom'
import { calculateBmi, formatDate } from '@/lib/utils'
import { listMyMetrics } from '@/features/metrics/metricsApi'

export function ClientDashboardPage() {
  const { profile, clientDetail } = useAuth()
  const location = useLocation()
  const notice = (location.state as { notice?: string } | null)?.notice

  const metricsQuery = useQuery({
    queryKey: ['metrics', 'mine', profile?.id],
    queryFn: () => listMyMetrics(profile!.id),
    enabled: Boolean(profile?.id),
  })
  const latestMetric = metricsQuery.data?.[0] ?? null
  const latestBmi =
    latestMetric?.bmi ??
    calculateBmi(latestMetric?.weight_kg, latestMetric?.height_cm ?? clientDetail?.height_cm ?? null)

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
              <span className="text-slate-400">Email</span>
              <span className="truncate font-medium text-slate-100">{profile?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Member code</span>
              <span className="font-medium text-slate-100">{clientDetail?.member_code ?? 'Not assigned'}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Account status</span>
              {profile && <AccountStatusBadge status={profile.account_status} />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Membership</span>
              {profile && <MembershipStatusBadge status={profile.membership_status} />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Member since</span>
              <span className="font-medium text-slate-100">{formatDate(profile?.created_at)}</span>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Check in at the gym" description="Scan the gym's Client QR code" />
          <CardBody>
            <span className="flex size-11 items-center justify-center rounded-xl bg-brand-500/10 text-brand-400">
              <QrCode className="size-6" aria-hidden />
            </span>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
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
        <CardHeader
          title="Fitness progress"
          description="Your latest body measurements"
          action={
            <Link
              to="/app/progress"
              className="text-sm font-medium text-brand-300 hover:text-brand-100"
            >
              View all
            </Link>
          }
        />
        <CardBody>
          {metricsQuery.isLoading ? (
            <div className="space-y-2">
              <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
              <div className="h-4 w-56 animate-pulse rounded bg-white/[0.03]" />
            </div>
          ) : latestMetric ? (
            <div className="grid grid-cols-3 gap-3">
              <MetricTile
                label="Weight"
                value={latestMetric.weight_kg != null ? `${latestMetric.weight_kg} kg` : '—'}
              />
              <MetricTile
                label="Waist"
                value={latestMetric.waist_cm != null ? `${latestMetric.waist_cm} cm` : '—'}
              />
              <MetricTile label="BMI" value={latestBmi != null ? String(latestBmi) : '—'} />
              <p className="col-span-3 flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp className="size-3.5" aria-hidden />
                Last measured {formatDate(latestMetric.measured_at)}
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400">
                <TrendingUp className="size-5" aria-hidden />
              </span>
              <div>
                <p className="text-sm leading-relaxed text-slate-300">
                  Track your weight, height, and waist to see progress over time.
                </p>
                <Link
                  to="/app/progress"
                  className="mt-2 inline-flex text-sm font-medium text-brand-300 hover:text-brand-100"
                >
                  Add your first measurement
                </Link>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-100">{value}</p>
    </div>
  )
}
