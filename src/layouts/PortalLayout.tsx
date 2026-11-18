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
  badge?: number
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

  useEffect(() => {
    if (!drawerOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [drawerOpen])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const primaryMobile = nav.slice(0, 4)

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="ambient-orb -left-40 -top-48 size-[34rem] bg-brand-500/20" />
        <div className="ambient-orb -right-40 top-1/4 size-[30rem] bg-violet-500/15" />
        <div className="ambient-orb -bottom-48 left-1/3 size-[32rem] bg-teal-500/10" />
      </div>

      <a
        href="#main-content"
        className="sr-only z-[60] rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="glass-bar fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex">
        <div className="flex h-16 items-center gap-2.5 border-b border-white/[0.07] px-5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-[0_10px_24px_-12px_rgba(47,129,255,0.9)]">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight tracking-tight text-slate-100">
              GymTrack
            </p>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {portalLabel}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
          {nav.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </nav>

        <div className="border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-slate-100 ring-1 ring-white/15">
              {getInitials(identityName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">{identityName}</p>
              <p className="truncate text-xs text-slate-400">{identityMeta}</p>
            </div>
          </div>
          <Button variant="ghost" className="mt-1 w-full justify-start" size="sm" onClick={handleSignOut}>
            <LogOut className="size-4" aria-hidden />
            Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="glass-bar sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 to-brand-600 text-white">
            <Dumbbell className="size-4" aria-hidden />
          </span>
          <span className="text-sm font-semibold tracking-tight text-slate-100">GymTrack</span>
        </Link>
        <div className="flex items-center gap-2">
          <Badge tone="slate">{portalLabel}</Badge>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex size-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
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
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="glass-bar absolute inset-y-0 right-0 flex w-72 max-w-[85%] flex-col border-l shadow-2xl"
          >
            <div className="flex h-14 items-center justify-between border-b border-white/[0.07] px-4">
              <span className="text-sm font-semibold text-slate-100">Menu</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-9 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Mobile navigation">
              {nav.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </nav>
            <div className="safe-bottom border-t border-white/[0.07] p-3">
              <div className="mb-2 px-2">
                <p className="truncate text-sm font-medium text-slate-100">{identityName}</p>
                <p className="truncate text-xs text-slate-400">{identityMeta}</p>
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
      <main id="main-content" className="min-w-0 lg:pl-64">
        <div className="mx-auto w-full max-w-7xl min-w-0 px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        className="glass-bar safe-bottom fixed inset-x-0 bottom-0 z-30 border-t lg:hidden"
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
                  'flex min-w-0 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand-300' : 'text-slate-400 hover:text-slate-200',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className={cn('size-5', isActive && 'stroke-[2.25]')} aria-hidden />
                  <span className="w-full truncate px-1 text-center">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-slate-400 transition-colors hover:text-slate-200"
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
          'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-brand-500/15 text-brand-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_0_0_1px_rgba(89,164,255,0.2)]'
            : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100',
        )
      }
    >
      <item.icon className="size-4.5 shrink-0" aria-hidden />
      <span className="flex-1">{item.label}</span>
      {item.badge ? (
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/25">
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </NavLink>
  )
}
