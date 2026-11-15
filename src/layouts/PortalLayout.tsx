import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { Dumbbell, LogOut, Menu, X } from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthProvider'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface PortalLayoutProps {
  nav: NavItem[]
  portalLabel: string
  identityName: string
  identityMeta: string
}

export function PortalLayout({ nav, portalLabel, identityName, identityMeta }: PortalLayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const primaryMobile = nav.slice(0, 4)

  return (
    <div className="min-h-dvh bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-100 px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight tracking-tight text-slate-900">GymTrack</p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {portalLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {nav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {getInitials(identityName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">{identityName}</p>
              <p className="truncate text-xs text-slate-500">{identityMeta}</p>
            </div>
          </div>
          <Button variant="ghost" className="mt-1 w-full justify-start" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand-600 text-white">
            <Dumbbell className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-900">GymTrack</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="slate">{portalLabel}</Badge>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="Open menu"
          >
            <Menu className="size-5" aria-hidden />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-slate-100 px-4">
              <span className="text-sm font-semibold text-slate-900">Menu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-0.5 overflow-y-auto p-3" aria-label="Mobile navigation">
              {nav.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </nav>
            <div className="safe-bottom border-t border-slate-100 p-3">
              <div className="mb-2 px-2">
                <p className="truncate text-sm font-medium text-slate-900">{identityName}</p>
                <p className="truncate text-xs text-slate-500">{identityMeta}</p>
              </div>
              <Button variant="ghost" className="w-full justify-start" size="sm" onClick={handleSignOut}>
                <LogOut className="size-4" aria-hidden />
                Sign out
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-7xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Bottom navigation"
      >
        <div className="grid grid-cols-5">
          {primaryMobile.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex flex-col items-center gap-1 py-2 text-[11px] font-medium',
                  isActive ? 'text-brand-600' : 'text-slate-500',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-5', isActive && 'stroke-[2.25]')} aria-hidden />
                  <span className="truncate px-1">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-slate-500"
          >
            <Menu className="size-5" aria-hidden />
            <span>More</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

function SidebarLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
        )
      }
    >
      <item.icon className="size-4.5 shrink-0" aria-hidden />
      {item.label}
    </NavLink>
  )
}
