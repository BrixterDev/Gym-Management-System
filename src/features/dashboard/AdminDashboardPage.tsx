import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, QrCode, Users } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PageHeader } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Badge, AccountStatusBadge, MembershipStatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

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
    to: '/admin/settings',
    title: 'Settings & QR codes',
    description: 'Timezone, gym QR codes, and portal configuration.',
    icon: QrCode,
  },
]

export function AdminDashboardPage() {
  const { profile, clientDetail } = useAuth()

  return (
    <div>
      <PageHeader
        title={`Welcome back${clientDetail?.display_name ? `, ${clientDetail.display_name}` : ''}`}
        description="Gym operations overview. Full analytics arrive in Phase 6."
        action={<Badge tone="blue">Administrator</Badge>}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader title="Your account" description="Provisioned by seed script" />
          <CardBody className="space-y-3 text-sm">
            <Row label="Email" value={profile?.email ?? '—'} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Account status</span>
              {profile && <AccountStatusBadge status={profile.account_status} />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Membership</span>
              {profile && <MembershipStatusBadge status={profile.membership_status} />}
            </div>
            <Row label="Since" value={formatDate(profile?.created_at)} />
          </CardBody>
        </Card>

        <Card className="sm:col-span-1 lg:col-span-2">
          <CardHeader
            title="Phase 1 — Foundation deployed"
            description="Database, RLS, and authentication are live"
          />
          <CardBody>
            <ul className="space-y-2.5 text-sm text-slate-600">
              {[
                'Nine tables with constraints, partial unique indexes, and updated-at triggers',
                'Row Level Security on every application table',
                'Admin provisioning via seed — public signup creates pending clients only',
                'Role-based routing with a single sign-in page',
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="group rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <link.icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
              {link.title}
              <ArrowRight className="size-3.5 text-slate-400 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="truncate font-medium text-slate-900">{value}</span>
    </div>
  )
}
