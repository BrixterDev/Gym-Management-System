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
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
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

  const pendingQuery = useQuery({
    queryKey: ['pending-count'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pending_approval_count')
      if (error) throw error
      return data ?? 0
    },
    refetchInterval: 60_000,
  })

  const nav = adminNav.map((item) =>
    item.to === '/admin/approvals'
      ? { ...item, badge: pendingQuery.data ?? 0 }
      : item,
  )

  return (
    <PortalLayout
      nav={nav}
      portalLabel="Admin"
      identityName={name}
      identityMeta={profile?.email ?? ''}
    />
  )
}
