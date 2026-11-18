import type {
  AccountStatus,
  MembershipStatus,
  PaymentStatus,
  SubscriptionStatus,
} from '@/types/database'
import { cn } from '@/lib/utils'

type BadgeTone = 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'violet'

const tones: Record<BadgeTone, string> = {
  green: 'bg-emerald-500/15 text-emerald-300 ring-emerald-400/25',
  amber: 'bg-amber-500/15 text-amber-300 ring-amber-400/25',
  red: 'bg-rose-500/15 text-rose-300 ring-rose-400/25',
  slate: 'bg-white/[0.07] text-slate-300 ring-white/15',
  blue: 'bg-brand-500/15 text-brand-300 ring-brand-400/25',
  violet: 'bg-violet-500/15 text-violet-300 ring-violet-400/25',
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

const paymentTone: Record<PaymentStatus, BadgeTone> = {
  paid: 'green',
  pending: 'amber',
  failed: 'red',
  refunded: 'violet',
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge tone={paymentTone[status]} dot>
      {status}
    </Badge>
  )
}
