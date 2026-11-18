import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  QrCode,
  Ticket,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PageHeader, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, AccountStatusBadge, MembershipStatusBadge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { getReportSummary, presetRange, reportErrorMessage } from '@/features/reports/reportsApi'
import { listActivePlans } from '@/features/memberships/plansApi'
import { AssignSubscriptionDialog } from '@/features/memberships/SubscriptionDialogs'

const quickLinks = [
  {
    to: '/admin/clients',
    title: 'Client management',
    description: 'Search members, review profiles, and manage identities.',
    icon: Users,
  },
  {
    to: '/admin/approvals',
    title: 'Approvals',
    description: 'Review pending self-registrations before granting access.',
    icon: CalendarCheck,
  },
  {
    to: '/admin/reports',
    title: 'Reports & analytics',
    description: 'Revenue, attendance trends, and CSV exports.',
    icon: BarChart3,
  },
  {
    to: '/admin/settings',
    title: 'Settings & QR codes',
    description: 'Timezone, gym QR codes, and portal configuration.',
    icon: QrCode,
  },
]

export function AdminDashboardPage() {
  const { profile, clientDetail } = useAuth()
  const range = presetRange('30d')
  const [dayPassOpen, setDayPassOpen] = useState(false)

  const summaryQuery = useQuery({
    queryKey: ['report-summary', range],
    queryFn: () => getReportSummary(range),
  })

  const plansQuery = useQuery({
    queryKey: ['active-plans'],
    queryFn: listActivePlans,
  })

  const dayPassPlan = useMemo(
    () =>
      (plansQuery.data ?? []).find((plan) => plan.name.trim().toLowerCase() === 'day pass'),
    [plansQuery.data],
  )

  const summary = summaryQuery.data

  return (
    <div>
      <PageHeader
        title={`Welcome back${clientDetail?.display_name ? `, ${clientDetail.display_name}` : ''}`}
        description="Gym operations, revenue, and attendance at a glance."
        action={<Badge tone="blue">Administrator</Badge>}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Your account" description="Provisioned by seed script" />
          <CardBody className="space-y-3 text-sm">
            <Row label="Email" value={profile?.email ?? '—'} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Account status</span>
              {profile && <AccountStatusBadge status={profile.account_status} />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-400">Membership</span>
              {profile && <MembershipStatusBadge status={profile.membership_status} />}
            </div>
            <Row label="Since" value={formatDate(profile?.created_at)} />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Last 30 days"
            description="Live operational summary"
            action={
              <Link
                to="/admin/reports"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-300 hover:text-brand-100"
              >
                Full reports
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          <CardBody>
            {summaryQuery.isError ? (
              <Alert tone="error" title="Could not load summary">
                {reportErrorMessage(summaryQuery.error)}
              </Alert>
            ) : summaryQuery.isLoading || !summary ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-white/[0.07] px-3 py-3">
                    <div className="h-3 w-16 animate-pulse rounded bg-white/[0.06]" />
                    <div className="mt-2 h-6 w-20 animate-pulse rounded bg-white/[0.06]" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat
                  label="Revenue"
                  value={formatCurrency(summary.revenue_paid)}
                  icon={<Wallet className="size-3.5" aria-hidden />}
                />
                <Stat
                  label="Visits"
                  value={String(summary.visits)}
                  icon={<CalendarCheck className="size-3.5" aria-hidden />}
                />
                <Stat
                  label="New members"
                  value={String(summary.new_members)}
                  icon={<UserPlus className="size-3.5" aria-hidden />}
                />
                <Stat
                  label="Active members"
                  value={String(summary.active_members)}
                  icon={<Users className="size-3.5" aria-hidden />}
                />
                <p className="col-span-2 text-xs text-slate-400 sm:col-span-4">
                  {summary.expiring_soon > 0
                    ? `${summary.expiring_soon} membership${
                        summary.expiring_soon === 1 ? '' : 's'
                      } expiring within 7 days.`
                    : 'No memberships expiring in the next 7 days.'}
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6 border-brand-400/25">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Ticket className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-100">Walk-in day pass</p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-300">
                Sell single-day access. The pass is valid until closing on the selected date.
              </p>
              {plansQuery.isLoading ? (
                <p className="mt-1 text-xs text-slate-400">Loading plan…</p>
              ) : dayPassPlan ? (
                <p className="mt-1 text-xs font-medium text-brand-300">
                  {formatCurrency(dayPassPlan.price)} · 1 day
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-300">
                  No active “Day Pass” plan. Create one in{' '}
                  <Link to="/admin/plans" className="underline">
                    Plans
                  </Link>
                  .
                </p>
              )}
            </div>
          </div>
          <Button
            className="shrink-0"
            onClick={() => setDayPassOpen(true)}
            disabled={!dayPassPlan}
          >
            <Ticket className="size-4" aria-hidden />
            Sell day pass
          </Button>
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group glass-panel glass-hover rounded-2xl p-5"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-500/10 text-brand-400">
              <link.icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-100">
              {link.title}
              <ArrowRight className="size-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">{link.description}</p>
          </Link>
        ))}
      </div>

      <AssignSubscriptionDialog
        open={dayPassOpen}
        onClose={() => setDayPassOpen(false)}
        defaultPlanId={dayPassPlan?.id}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-400">{label}</span>
      <span className="truncate font-medium text-slate-100">{value}</span>
    </div>
  )
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string
  value: string
  icon: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-white/[0.04] px-3 py-3">
      <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-slate-100">{value}</p>
    </div>
  )
}
