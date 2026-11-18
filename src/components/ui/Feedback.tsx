import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center gap-2 py-8', className)}>
      <span className="size-5 animate-spin rounded-full border-2 border-white/20 border-t-brand-400" />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div role="status" className="flex flex-col items-center gap-3">
        <span className="size-8 animate-spin rounded-full border-[3px] border-white/15 border-t-brand-400" />
        <p className="text-sm text-slate-400">Loading…</p>
      </div>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  icon,
  action,
}: {
  title: string
  description?: string
  icon?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      {icon && <div className="mb-1 text-slate-500">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {description && <p className="max-w-sm text-sm text-slate-400">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-100 sm:text-2xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-400">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  )
}

export function Alert({
  tone = 'info',
  title,
  children,
}: {
  tone?: 'info' | 'success' | 'warning' | 'error'
  title?: string
  children: ReactNode
}) {
  const styles = {
    info: 'border-brand-400/25 bg-brand-500/10 text-brand-200',
    success: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
    warning: 'border-amber-400/25 bg-amber-500/10 text-amber-200',
    error: 'border-rose-400/25 bg-rose-500/10 text-rose-200',
  } as const

  return (
    <div role="alert" className={cn('rounded-xl border px-4 py-3 text-sm', styles[tone])}>
      {title && <p className="mb-0.5 font-semibold">{title}</p>}
      <div className="[&>p]:leading-relaxed">{children}</div>
    </div>
  )
}
