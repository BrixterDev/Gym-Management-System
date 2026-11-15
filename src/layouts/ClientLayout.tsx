import { CalendarCheck, LayoutDashboard, QrCode, TrendingUp, User } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { PortalLayout, type NavItem } from './PortalLayout'

const clientNav: NavItem[] = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/checkin', label: 'QR Check-in', icon: QrCode },
  { to: '/app/attendance', label: 'My Attendance', icon: CalendarCheck },
  { to: '/app/progress', label: 'My Progress', icon: TrendingUp },
  { to: '/app/profile', label: 'My Profile', icon: User },
]

export function ClientLayout() {
  const { profile, clientDetail } = useAuth()

  return (
    <PortalLayout
      nav={clientNav}
      portalLabel="Member"
      identityName={clientDetail?.display_name ?? 'Member'}
      identityMeta={clientDetail?.member_code ?? profile?.email ?? ''}
    />
  )
}
