import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Check, RotateCcw, ShieldOff, UserCheck } from 'lucide-react'
import type { AccountStatus } from '@/types/database'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { clientErrorMessage, setAccountStatus } from './api'
import { getInitials } from '@/lib/utils'

export function ClientAvatar({
  name,
  email,
  size = 'md',
}: {
  name: string | null
  email: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = { sm: 'size-8 text-[11px]', md: 'size-10 text-xs', lg: 'size-14 text-base' }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-semibold text-white ${sizes[size]}`}
      aria-hidden
    >
      {getInitials(name ?? email.split('@')[0] ?? null)}
    </span>
  )
}

interface StatusAction {
  label: string
  status: AccountStatus
  tone: 'primary' | 'danger' | 'neutral'
  icon: typeof Check
  destructive: boolean
  description: string
}

function actionsFor(status: AccountStatus): StatusAction[] {
  switch (status) {
    case 'pending':
      return [
        {
          label: 'Approve',
          status: 'approved',
          tone: 'primary',
          icon: Check,
          destructive: false,
          description: 'Grant this member access to the client portal and check-in.',
        },
        {
          label: 'Reject',
          status: 'rejected',
          tone: 'danger',
          icon: ShieldOff,
          destructive: true,
          description: 'Reject this registration. The member will be blocked from the portal.',
        },
      ]
    case 'approved':
      return [
        {
          label: 'Suspend',
          status: 'suspended',
          tone: 'danger',
          icon: ShieldOff,
          destructive: true,
          description: 'Suspend access immediately. Existing attendance history is preserved.',
        },
      ]
    case 'rejected':
      return [
        {
          label: 'Approve',
          status: 'approved',
          tone: 'primary',
          icon: Check,
          destructive: false,
          description: 'Approve this account and restore client portal access.',
        },
      ]
    case 'suspended':
      return [
        {
          label: 'Reactivate',
          status: 'approved',
          tone: 'primary',
          icon: RotateCcw,
          destructive: false,
          description: 'Restore this account to approved status.',
        },
      ]
  }
}

export function ClientStatusActions({
  client,
  fullWidth = false,
}: {
  client: { id: string; account_status: AccountStatus; display_name: string | null; email: string }
  fullWidth?: boolean
}) {
  const [pendingAction, setPendingAction] = useState<StatusAction | null>(null)
  const toast = useToast()
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (status: AccountStatus) => setAccountStatus(client.id, status),
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
      toast.success(
        `Account ${profile.account_status}`,
        `${client.display_name ?? client.email} is now ${profile.account_status}.`,
      )
      setPendingAction(null)
    },
    onError: (error) => {
      toast.error('Could not update account', clientErrorMessage(error))
    },
  })

  const actions = actionsFor(client.account_status)

  return (
    <>
      <div className={`flex flex-wrap gap-2 ${fullWidth ? 'w-full' : ''}`}>
        {actions.map((action) => (
          <Button
            key={action.status}
            variant={action.tone === 'danger' ? 'danger' : action.tone === 'primary' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setPendingAction(action)}
            className={fullWidth ? 'flex-1' : ''}
          >
            <action.icon className="size-3.5" aria-hidden />
            {action.label}
          </Button>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(pendingAction)}
        onClose={() => setPendingAction(null)}
        onConfirm={() => pendingAction && mutation.mutate(pendingAction.status)}
        title={pendingAction ? `${pendingAction.label} account` : 'Update account'}
        description={
          pendingAction
            ? `${pendingAction.description} ${client.display_name ?? client.email}`
            : ''
        }
        confirmLabel={pendingAction?.label}
        tone={pendingAction?.destructive ? 'danger' : 'primary'}
        loading={mutation.isPending}
      />
    </>
  )
}

export function ApproveInlineButton({
  clientId,
  label = 'Approve',
}: {
  clientId: string
  label?: string
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => setAccountStatus(clientId, 'approved'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
      toast.success('Registration approved')
    },
    onError: (error) => toast.error('Could not approve', clientErrorMessage(error)),
  })

  return (
    <Button size="sm" loading={mutation.isPending} onClick={() => mutation.mutate()}>
      <UserCheck className="size-3.5" aria-hidden />
      {label}
    </Button>
  )
}
