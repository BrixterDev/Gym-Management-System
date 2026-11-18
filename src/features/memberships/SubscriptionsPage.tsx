import { useDeferredValue, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Wallet,
  XCircle,
} from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge, SubscriptionStatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { daysBetween, formatCurrency, formatDate, todayIsoDate } from '@/lib/utils'
import type { SubscriptionDirectoryRow, SubscriptionStatus } from '@/types/database'
import {
  cancelSubscription,
  defaultSubscriptionFilters,
  getSubscriptionSummary,
  listSubscriptions,
  pauseSubscription,
  refreshSubscriptions,
  resumeSubscription,
  subscriptionErrorMessage,
  type SubscriptionFilters,
} from './subscriptionsApi'
import {
  AssignSubscriptionDialog,
  ChangePlanDialog,
  RenewSubscriptionDialog,
} from './SubscriptionDialogs'
import { RecordPaymentDialog } from '@/features/payments/RecordPaymentDialog'

type ConfirmAction = { type: 'pause' | 'resume' | 'cancel'; row: SubscriptionDirectoryRow }

export function SubscriptionsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<SubscriptionFilters>(defaultSubscriptionFilters)
  const [assignOpen, setAssignOpen] = useState(false)
  const [renewTarget, setRenewTarget] = useState<SubscriptionDirectoryRow | null>(null)
  const [changeTarget, setChangeTarget] = useState<SubscriptionDirectoryRow | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<SubscriptionDirectoryRow | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const deferredSearch = useDeferredValue(filters.search)

  const query = useQuery({
    queryKey: ['subscriptions', { ...filters, search: deferredSearch }],
    queryFn: async () => {
      await refreshSubscriptions()
      return listSubscriptions({ ...filters, search: deferredSearch })
    },
    placeholderData: keepPreviousData,
  })

  const summaryQuery = useQuery({
    queryKey: ['subscription-summary'],
    queryFn: getSubscriptionSummary,
  })

  const summaryMap = new Map(
    (summaryQuery.data ?? []).map((row) => [row.subscription_status, row.subscription_count]),
  )

  const rows = query.data?.rows ?? []
  const count = query.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / filters.pageSize))

  useEffect(() => {
    if (filters.page > totalPages) {
      setFilters((current) => ({ ...current, page: totalPages }))
    }
  }, [filters.page, totalPages])

  const update = (patch: Partial<SubscriptionFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))

  const actionMutation = useMutation({
    mutationFn: async ({ type, row }: ConfirmAction) => {
      if (type === 'pause') return pauseSubscription(row.id)
      if (type === 'resume') return resumeSubscription(row.id)
      return cancelSubscription(row.id)
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['subscription-summary'] })
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['client', variables.row.client_id] })
      queryClient.invalidateQueries({ queryKey: ['client-memberships', variables.row.client_id] })
      toast.success(
        variables.type === 'pause'
          ? 'Subscription paused'
          : variables.type === 'resume'
            ? 'Subscription resumed'
            : 'Subscription cancelled',
        variables.type === 'pause'
          ? 'Remaining days are frozen until you resume it.'
          : undefined,
      )
      setConfirmAction(null)
    },
    onError: (error) => {
      toast.error('Could not update subscription', subscriptionErrorMessage(error))
      setConfirmAction(null)
    },
  })

  const statusOrder: SubscriptionStatus[] = ['active', 'expired', 'paused', 'cancelled']

  return (
    <div>
      <PageHeader
        title="Subscriptions"
        description="Assign plans, renew, pause, or cancel memberships."
        action={
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden />
              Refresh
            </Button>
            <Button onClick={() => setAssignOpen(true)}>
              <Plus className="size-4" aria-hidden />
              New subscription
            </Button>
          </div>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {statusOrder.map((status) => (
          <Card key={status}>
            <CardBody className="flex items-center justify-between py-3.5">
              <div>
                <p className="text-xs font-medium capitalize text-slate-500">{status}</p>
                <p className="mt-0.5 text-xl font-semibold text-slate-900">
                  {summaryMap.get(status) ?? 0}
                </p>
              </div>
              <SubscriptionStatusBadge status={status} />
            </CardBody>
          </Card>
        ))}
      </div>

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load subscriptions">
            {subscriptionErrorMessage(query.error)}
          </Alert>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2">
          <Input
            type="search"
            placeholder="Search client, member code, or plan"
            aria-label="Search subscriptions"
            leadingIcon={<Search className="size-4" />}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
          <Select
            aria-label="Filter by subscription status"
            value={filters.status}
            onChange={(event) =>
              update({ status: event.target.value as SubscriptionFilters['status'] })
            }
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
            <option value="paused">Paused</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No subscriptions found"
            description={
              filters.search || filters.status !== 'all'
                ? 'Try a different search or status filter.'
                : 'Assign a plan to a client to get started.'
            }
            action={
              !filters.search && filters.status === 'all' ? (
                <Button size="sm" onClick={() => setAssignOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  New subscription
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setFilters(defaultSubscriptionFilters)}>
                  Clear filters
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">Client</th>
                    <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Period</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Paid</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/clients/${row.client_id}`}
                          className="font-medium text-slate-900 hover:text-brand-700"
                        >
                          {row.display_name ?? 'Unnamed member'}
                        </Link>
                        <p className="text-xs text-slate-500">{row.member_code ?? row.email}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-slate-800">{row.plan_name}</p>
                        <p className="text-xs text-slate-500">{formatCurrency(row.price_at_assignment)}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>{formatDate(row.start_date)} → {formatDate(row.end_date)}</p>
                        <p className="mt-0.5 text-slate-400">{remainingLabel(row)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <SubscriptionStatusBadge status={row.subscription_status} />
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p className="font-medium text-slate-800">{formatCurrency(row.paid_amount)}</p>
                        {row.pending_amount > 0 && (
                          <p className="text-amber-600">{formatCurrency(row.pending_amount)} pending</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SubscriptionsActions
                          row={row}
                          onRenew={() => setRenewTarget(row)}
                          onChange={() => setChangeTarget(row)}
                          onPayment={() => setPaymentTarget(row)}
                          onConfirm={(type) => setConfirmAction({ type, row })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 lg:hidden">
              {rows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/clients/${row.client_id}`}
                        className="truncate text-sm font-semibold text-slate-900"
                      >
                        {row.display_name ?? 'Unnamed member'}
                      </Link>
                      <p className="truncate text-xs text-slate-500">{row.email}</p>
                    </div>
                    <SubscriptionStatusBadge status={row.subscription_status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    <Badge tone="slate">{row.plan_name}</Badge>
                    <span>{formatDate(row.start_date)} → {formatDate(row.end_date)}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    <span className="text-slate-400">{remainingLabel(row)}</span>
                    <span className="font-medium text-slate-700">{formatCurrency(row.paid_amount)} paid</span>
                  </div>
                  <div className="mt-3">
                    <SubscriptionsActions
                      row={row}
                      onRenew={() => setRenewTarget(row)}
                      onChange={() => setChangeTarget(row)}
                      onPayment={() => setPaymentTarget(row)}
                      onConfirm={(type) => setConfirmAction({ type, row })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">
              {count} subscription{count === 1 ? '' : 's'}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                Previous
              </Button>
              <span className="text-xs text-slate-500">
                Page {filters.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={filters.page >= totalPages}
                onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))}
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <AssignSubscriptionDialog open={assignOpen} onClose={() => setAssignOpen(false)} />
      <RenewSubscriptionDialog
        open={Boolean(renewTarget)}
        onClose={() => setRenewTarget(null)}
        subscription={renewTarget}
      />
      <ChangePlanDialog
        open={Boolean(changeTarget)}
        onClose={() => setChangeTarget(null)}
        subscription={changeTarget}
      />
      <RecordPaymentDialog
        open={Boolean(paymentTarget)}
        onClose={() => setPaymentTarget(null)}
        defaultSubscription={paymentTarget}
        lockedSubscription
      />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && actionMutation.mutate(confirmAction)}
        title={
          confirmAction?.type === 'pause'
            ? 'Pause subscription'
            : confirmAction?.type === 'resume'
              ? 'Resume subscription'
              : 'Cancel subscription'
        }
        description={
          confirmAction?.type === 'pause'
            ? `Remaining days will be frozen. ${confirmAction.row.display_name ?? confirmAction.row.email} cannot check in until resumed.`
            : confirmAction?.type === 'resume'
              ? `Access resumes today and the end date is extended by the frozen remaining days.`
              : `Cancellation is terminal. Re-enrolling requires a brand-new subscription. ${confirmAction?.row.display_name ?? confirmAction?.row.email ?? ''}`
        }
        confirmLabel={
          confirmAction?.type === 'pause'
            ? 'Pause'
            : confirmAction?.type === 'resume'
              ? 'Resume'
              : 'Cancel subscription'
        }
        tone={confirmAction?.type === 'cancel' ? 'danger' : 'primary'}
        loading={actionMutation.isPending}
      />

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Active subscriptions that pass their end date are automatically marked expired when this
        page loads. Status is also re-validated server-side at check-in.
      </p>
    </div>
  )
}

function remainingLabel(row: SubscriptionDirectoryRow) {
  if (row.subscription_status === 'paused') {
    return `${row.paused_remaining_days ?? 0} days frozen`
  }
  if (row.subscription_status === 'cancelled') return 'Terminal'
  const days = daysBetween(todayIsoDate(), row.end_date) + 1
  if (days < 0) return `Ended ${Math.abs(days)} days ago`
  if (days === 0) return 'Ends today'
  return `${days} day${days === 1 ? '' : 's'} left`
}

function SubscriptionsActions({
  row,
  onRenew,
  onChange,
  onPayment,
  onConfirm,
}: {
  row: SubscriptionDirectoryRow
  onRenew: () => void
  onChange: () => void
  onPayment: () => void
  onConfirm: (type: 'pause' | 'resume' | 'cancel') => void
}) {
  const isCancelled = row.subscription_status === 'cancelled'
  const isPaused = row.subscription_status === 'paused'

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      <Button variant="outline" size="sm" onClick={onPayment}>
        <Wallet className="size-3.5" aria-hidden />
        Payment
      </Button>
      {!isCancelled && (
        <Button variant="outline" size="sm" onClick={onRenew}>
          <Repeat className="size-3.5" aria-hidden />
          Renew
        </Button>
      )}
      {row.subscription_status === 'active' && (
        <Button variant="outline" size="sm" onClick={() => onConfirm('pause')}>
          <CirclePause className="size-3.5" aria-hidden />
          Pause
        </Button>
      )}
      {isPaused && (
        <Button variant="outline" size="sm" onClick={() => onConfirm('resume')}>
          <CirclePlay className="size-3.5" aria-hidden />
          Resume
        </Button>
      )}
      {!isCancelled && (
        <Button variant="ghost" size="sm" onClick={onChange}>
          Change plan
        </Button>
      )}
      {!isCancelled && (
        <Button variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50" onClick={() => onConfirm('cancel')}>
          <XCircle className="size-3.5" aria-hidden />
          Cancel
        </Button>
      )}
    </div>
  )
}
