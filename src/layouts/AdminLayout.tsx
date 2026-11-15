import {
  BarChart3,
  CalendarCheck,
  ClipboardCheck,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Settings,
  Users,
  UserCheck,
} from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PortalLayout, type NavItem } from './PortalLayout'

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/clients', label: 'Clients', icon: Users },
  { to: '/admin/approvals', label: 'Approvals', icon: UserCheck },
  { to: '/admin/plans', label: 'Membership Plans', icon: ClipboardCheck },
  { to: '/admin/subscriptions', label: 'Subscriptions', icon: CreditCard },
  { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
  { to: '/admin/payments', label: 'Payments', icon: Receipt },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
]

export function AdminLayout() {
  const { profile, clientDetail } = useAuth()
  const name = clientDetail?.display_name ?? 'Administrator'

  return (
    <PortalLayout
      nav={adminNav}
      portalLabel="Admin"
      identityName={name}
      identityMeta={profile?.email ?? ''}
    />
  )
}
