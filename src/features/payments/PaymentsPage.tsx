import { useDeferredValue, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  RotateCcw,
  Search,
  Wallet,
} from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge, PaymentStatusBadge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, pluralize } from '@/lib/utils'
import type { PaymentDirectoryRow, PaymentStatus } from '@/types/database'
import {
  defaultPaymentFilters,
  getPaymentSummary,
  listPayments,
  paymentErrorMessage,
  setPaymentStatus,
  type PaymentFilters,
} from './paymentsApi'
import { RecordPaymentDialog } from './RecordPaymentDialog'

type ConfirmAction = { type: 'paid' | 'refunded'; row: PaymentDirectoryRow }

const summaryOrder: { status: PaymentStatus; label: string; tone: 'green' | 'amber' | 'red' | 'violet' }[] = [
  { status: 'paid', label: 'Collected', tone: 'green' },
  { status: 'pending', label: 'Pending', tone: 'amber' },
  { status: 'failed', label: 'Failed', tone: 'red' },
  { status: 'refunded', label: 'Refunded', tone: 'violet' },
]

const methodLabels: Record<PaymentDirectoryRow['payment_method'], string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
}

export function PaymentsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<PaymentFilters>(defaultPaymentFilters)
  const [recordOpen, setRecordOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const deferredSearch = useDeferredValue(filters.search)

  const query = useQuery({
    queryKey: ['payments', { ...filters, search: deferredSearch }],
    queryFn: () => listPayments({ ...filters, search: deferredSearch }),
    placeholderData: keepPreviousData,
  })

  const summaryQuery = useQuery({
    queryKey: ['payment-summary'],
    queryFn: getPaymentSummary,
  })

  const summaryMap = new Map(
    (summaryQuery.data ?? []).map((row) => [row.payment_status, row]),
  )

  const rows = query.data?.rows ?? []
  const count = query.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / filters.pageSize))

  useEffect(() => {
    if (filters.page > totalPages) {
      setFilters((current) => ({ ...current, page: totalPages }))
    }
  }, [filters.page, totalPages])

  const update = (patch: Partial<PaymentFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))

  const hasActiveFilters = Boolean(filters.search) || filters.status !== 'all' || filters.method !== 'all'

  const statusMutation = useMutation({
    mutationFn: ({ type, row }: ConfirmAction) => setPaymentStatus(row.id, type),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['client-memberships', variables.row.client_id] })
      toast.success(variables.type === 'paid' ? 'Payment marked as paid' : 'Payment refunded')
      setConfirmAction(null)
    },
    onError: (error) => {
      toast.error('Could not update payment', paymentErrorMessage(error))
      setConfirmAction(null)
    },
  })

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Record manual payments and track collection status per subscription."
        action={
          <Button onClick={() => setRecordOpen(true)}>
            <Plus className="size-4" aria-hidden />
            Record payment
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryOrder.map((entry) => {
          const summary = summaryMap.get(entry.status)
          return (
            <Card key={entry.status}>
              <CardBody className="py-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    {entry.label}
                  </p>
                  <Badge tone={entry.tone} dot>
                    {summary?.payment_count ?? 0}
                  </Badge>
                </div>
                <p className="mt-1 text-xl font-semibold text-slate-100">
                  {formatCurrency(summary?.total_amount ?? 0)}
                </p>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load payments">
            {paymentErrorMessage(query.error)}
          </Alert>
        </div>
      )}

      <div className="glass-panel rounded-2xl">
        <div className="grid gap-3 border-b border-white/[0.07] p-4 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px]">
          <Input
            type="search"
            placeholder="Search client, member code, or reference"
            aria-label="Search payments"
            leadingIcon={<Search className="size-4" />}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
          <Select
            aria-label="Filter by payment status"
            value={filters.status}
            onChange={(event) => update({ status: event.target.value as PaymentFilters['status'] })}
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
          <Select
            aria-label="Filter by payment method"
            value={filters.method}
            onChange={(event) => update({ method: event.target.value as PaymentFilters['method'] })}
          >
            <option value="all">All methods</option>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-white/[0.03]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Wallet className="size-8" aria-hidden />}
            title="No payments found"
            description={
              hasActiveFilters
                ? 'Try a different search, status, or method filter.'
                : 'Record a payment against a subscription to see it here.'
            }
            action={
              hasActiveFilters ? (
                <Button variant="outline" size="sm" onClick={() => setFilters(defaultPaymentFilters)}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setRecordOpen(true)}>
                  <Plus className="size-3.5" aria-hidden />
                  Record payment
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden min-w-0 xl:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">Client</th>
                    <th scope="col" className="px-4 py-3 font-medium">Subscription</th>
                    <th scope="col" className="px-4 py-3 font-medium">Date</th>
                    <th scope="col" className="px-4 py-3 font-medium">Method</th>
                    <th scope="col" className="px-4 py-3 font-medium">Amount</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {rows.map((row) => (
                    <tr key={row.id} className="align-top hover:bg-white/[0.04]">
                      <td className="px-4 py-3">
                        <Link
                          to={`/admin/clients/${row.client_id}`}
                          className="font-medium text-slate-100 hover:text-brand-200"
                        >
                          {row.display_name ?? 'Unnamed member'}
                        </Link>
                        <p className="text-xs text-slate-400">{row.member_code ?? row.email}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        <p className="text-slate-200">{row.plan_name}</p>
                        <p className="mt-0.5 text-slate-400">
                          {formatDate(row.start_date)} → {formatDate(row.end_date)}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">{formatDate(row.payment_date)}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {methodLabels[row.payment_method]}
                        {row.reference_number && (
                          <p className="mt-0.5 max-w-32 truncate text-slate-400">{row.reference_number}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-100">
                        {formatCurrency(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <PaymentStatusBadge status={row.payment_status} />
                      </td>
                      <td className="px-4 py-3">
                        <PaymentActions
                          row={row}
                          onConfirm={(type) => setConfirmAction({ type, row })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-white/[0.07] xl:hidden">
              {rows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/admin/clients/${row.client_id}`}
                        className="truncate text-sm font-semibold text-slate-100"
                      >
                        {row.display_name ?? 'Unnamed member'}
                      </Link>
                      <p className="truncate text-xs text-slate-400">{row.email}</p>
                    </div>
                    <PaymentStatusBadge status={row.payment_status} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                    <Badge tone="slate">{row.plan_name}</Badge>
                    <span>{formatDate(row.payment_date)}</span>
                    <span>{methodLabels[row.payment_method]}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-100">{formatCurrency(row.amount)}</p>
                  <div className="mt-3">
                    <PaymentActions
                      row={row}
                      onConfirm={(type) => setConfirmAction({ type, row })}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/[0.07] px-4 py-3">
            <p className="text-xs text-slate-400">{pluralize(count, 'payment')}</p>
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
              <span className="whitespace-nowrap text-xs text-slate-400">
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

      <RecordPaymentDialog open={recordOpen} onClose={() => setRecordOpen(false)} />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && statusMutation.mutate(confirmAction)}
        title={confirmAction?.type === 'paid' ? 'Mark payment as paid' : 'Refund payment'}
        description={
          confirmAction?.type === 'paid'
            ? `This will mark ${formatCurrency(confirmAction.row.amount)} from ${confirmAction.row.display_name ?? confirmAction.row.email} as paid.`
            : `This will mark ${formatCurrency(confirmAction?.row.amount ?? 0)} as refunded. Amounts stay visible for reporting.`
        }
        confirmLabel={confirmAction?.type === 'paid' ? 'Mark as paid' : 'Refund'}
        tone={confirmAction?.type === 'refunded' ? 'danger' : 'primary'}
        loading={statusMutation.isPending}
      />

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Only admins can record or change payments. Every change is written to the audit log with
        the acting user and timestamp.
      </p>
    </div>
  )
}

function PaymentActions({
  row,
  onConfirm,
}: {
  row: PaymentDirectoryRow
  onConfirm: (type: 'paid' | 'refunded') => void
}) {
  const canMarkPaid = row.payment_status === 'pending' || row.payment_status === 'failed'
  const canRefund = row.payment_status === 'paid'

  if (!canMarkPaid && !canRefund) {
    return <p className="text-right text-xs text-slate-400">No actions</p>
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {canMarkPaid && (
        <Button variant="outline" size="sm" onClick={() => onConfirm('paid')}>
          <CheckCircle2 className="size-3.5" aria-hidden />
          Mark paid
        </Button>
      )}
      {canRefund && (
        <Button
          variant="ghost"
          size="sm"
          className="text-rose-400 hover:bg-rose-500/10"
          onClick={() => onConfirm('refunded')}
        >
          <RotateCcw className="size-3.5" aria-hidden />
          Refund
        </Button>
      )}
    </div>
  )
}
