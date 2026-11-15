import { Link, Outlet } from 'react-router-dom'
import { Dumbbell } from 'lucide-react'

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-slate-950 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(47,129,255,0.25),transparent_45%),radial-gradient(circle_at_80%_70%,rgba(16,185,129,0.18),transparent_40%)]"
        />
        <Link to="/" className="relative flex items-center gap-2.5 text-white">
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-600">
            <Dumbbell className="size-5" aria-hidden />
          </span>
          <span className="text-lg font-semibold tracking-tight">GymTrack</span>
        </Link>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-white">
            Run your gym with clarity.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-300">
            Attendance, memberships, payments, and member progress — in one secure workspace for
            staff and members.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
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
        <p className="relative text-xs text-slate-500">
          Secure by default — row level security on every table.
        </p>
      </div>

      <div className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-9 items-center justify-center rounded-xl bg-brand-600 text-white">
              <Dumbbell className="size-5" aria-hidden />
            </span>
            <span className="text-lg font-semibold tracking-tight text-slate-900">GymTrack</span>
          </Link>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
