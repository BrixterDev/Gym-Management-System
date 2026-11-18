import { Link, Outlet } from 'react-router-dom'
import { Dumbbell, ShieldCheck, Sparkles } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="ambient-orb -left-48 -top-48 size-[36rem] bg-brand-500/20" />
        <div className="ambient-orb -right-40 top-1/3 size-[32rem] bg-violet-500/15" />
        <div className="ambient-orb -bottom-56 left-1/3 size-[34rem] bg-teal-500/10" />
      </div>

      <div className="relative hidden overflow-hidden border-r border-white/[0.06] bg-slate-950/40 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,129,255,0.28),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.18),transparent_40%)]"
        />
        <Link to="/" className="relative flex items-center gap-2.5 text-white">
          <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-[0_14px_30px_-14px_rgba(47,129,255,0.9)]">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">GymTrack</span>
        </Link>

        <div className="relative max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-brand-200 backdrop-blur">
            <Sparkles className="size-3" aria-hidden />
            Gym operations, elevated
          </span>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight text-white">
            Run your gym with clarity.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Attendance, memberships, payments, and member progress — in one secure workspace for
            staff and members.
          </p>
          <ul className="glass-panel mt-8 space-y-3 rounded-2xl p-5 text-sm text-slate-300">
            {[
              'QR-powered check-in with server-side validation',
              'Membership lifecycle: active, paused, expired, cancelled',
              'Timezone-aware attendance and revenue analytics',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="size-3.5" aria-hidden />
          Secure by default — row level security on every table.
        </p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 text-white">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-100">GymTrack</span>
          </Link>
          <div className="glass-panel rounded-3xl p-6 sm:p-7">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
