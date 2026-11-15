import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarClock, Pencil, Plus, Power, Users } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, pluralize } from '@/lib/utils'
import type { PlanDirectoryRow } from '@/types/database'
import { listPlans, planErrorMessage, setPlanActive } from './plansApi'
import { PlanDialog } from './PlanDialog'

export function MembershipPlansPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<PlanDirectoryRow | null>(null)
  const [toggleTarget, setToggleTarget] = useState<PlanDirectoryRow | null>(null)

  const query = useQuery({ queryKey: ['plans'], queryFn: listPlans })
  const plans = query.data ?? []

  const toggleMutation = useMutation({
    mutationFn: (plan: PlanDirectoryRow) => setPlanActive(plan.id, !plan.is_active),
    onSuccess: (_data, plan) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['active-plans'] })
      toast.success(plan.is_active ? 'Plan deactivated' : 'Plan reactivated')
      setToggleTarget(null)
    },
    onError: (error) => toast.error('Could not update plan', planErrorMessage(error)),
  })

  const activePlans = plans.filter((plan) => plan.is_active)
  const liveSubscribers = plans.reduce((sum, plan) => sum + plan.live_subscribers, 0)

  return (
    <div>
      <PageHeader
        title="Membership Plans"
        description="Define pricing and durations. Deactivate plans instead of deleting them."
        action={
          <Button
            onClick={() => {
              setEditing(null)
              setDialogOpen(true)
            }}
          >
            <Plus className="size-4" aria-hidden />
            New plan
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card>
          <CardBody className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Active plans</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{activePlans.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Total plans</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{plans.length}</p>
          </CardBody>
        </Card>
        <Card className="col-span-2 sm:col-span-1">
          <CardBody className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Live subscribers</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{liveSubscribers}</p>
          </CardBody>
        </Card>
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardBody className="space-y-3">
                <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-40 animate-pulse rounded bg-slate-50" />
                <div className="h-8 w-20 animate-pulse rounded bg-slate-100" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : plans.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<CalendarClock className="size-8" aria-hidden />}
              title="No membership plans yet"
              description="Create your first plan to start enrolling members."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setEditing(null)
                    setDialogOpen(true)
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  New plan
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={plan.is_active ? '' : 'bg-slate-50/70'}>
              <CardHeader
                title={plan.name}
                description={pluralize(plan.duration_days, 'day')}
                action={
                  <Badge tone={plan.is_active ? 'green' : 'slate'} dot>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                }
              />
              <CardBody>
                <p className="text-2xl font-semibold tracking-tight text-slate-900">
                  {formatCurrency(plan.price)}
                </p>
                {plan.description && (
                  <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-500">
                    {plan.description}
                  </p>
                )}
                <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="size-3.5" aria-hidden />
                  {pluralize(plan.live_subscribers, 'active subscriber')}
                  <span className="text-slate-300">•</span>
                  {plan.total_subscribers} all-time
                </p>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setEditing(plan)
                      setDialogOpen(true)
                    }}
                  >
                    <Pencil className="size-3.5" aria-hidden />
                    Edit
                  </Button>
                  <Button
                    variant={plan.is_active ? 'ghost' : 'secondary'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setToggleTarget(plan)}
                  >
                    <Power className="size-3.5" aria-hidden />
                    {plan.is_active ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Plans referenced by subscriptions cannot be deleted — the database restricts it. Deactivate
        a plan to stop new enrollments while keeping membership history intact.
      </p>

      <PlanDialog open={dialogOpen} onClose={() => setDialogOpen(false)} plan={editing} />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={() => toggleTarget && toggleMutation.mutate(toggleTarget)}
        title={toggleTarget?.is_active ? 'Deactivate plan' : 'Reactivate plan'}
        description={
          toggleTarget?.is_active
            ? `${toggleTarget.name} will no longer be assignable to new subscriptions. Existing subscriptions are unaffected.`
            : `${toggleTarget?.name ?? ''} will be available for new subscriptions again.`
        }
        confirmLabel={toggleTarget?.is_active ? 'Deactivate' : 'Reactivate'}
        tone={toggleTarget?.is_active ? 'danger' : 'primary'}
        loading={toggleMutation.isPending}
      />
    </div>
  )
}
