import type { AccountStatus, MembershipStatus, SubscriptionStatus } from '@/types/database'
import { cn } from '@/lib/utils'

type BadgeTone = 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'violet'

const tones: Record<BadgeTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  violet: 'bg-violet-50 text-violet-700 ring-violet-600/20',
}

export function Badge({
  tone = 'slate',
  children,
  className,
  dot = false,
}: {
  tone?: BadgeTone
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}

const accountTone: Record<AccountStatus, BadgeTone> = {
  approved: 'green',
  pending: 'amber',
  rejected: 'red',
  suspended: 'red',
}

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return (
    <Badge tone={accountTone[status]} dot>
      {status}
    </Badge>
  )
}

const subscriptionTone: Record<SubscriptionStatus, BadgeTone> = {
  active: 'green',
  expired: 'amber',
  cancelled: 'red',
  paused: 'violet',
}

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge tone={subscriptionTone[status]} dot>
      {status}
    </Badge>
  )
}

export function MembershipStatusBadge({ status }: { status: MembershipStatus }) {
  return (
    <Badge tone={status === 'member' ? 'blue' : 'slate'} dot>
      {status}
    </Badge>
  )
}
