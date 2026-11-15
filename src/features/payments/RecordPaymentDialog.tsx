import { useDeferredValue, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { SubscriptionStatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, todayIsoDate } from '@/lib/utils'
import type { PaymentMethod, PaymentStatus, SubscriptionDirectoryRow } from '@/types/database'
import { listSubscriptions } from '@/features/memberships/subscriptionsApi'
import { paymentErrorMessage, recordPayment } from './paymentsApi'

const schema = z.object({
  amount: z
    .string()
    .trim()
    .min(1, 'Enter an amount')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Enter a valid amount'),
  payment_method: z.enum(['cash', 'gcash', 'card', 'bank_transfer']),
  payment_status: z.enum(['paid', 'pending', 'failed', 'refunded']),
  payment_date: z.string().min(1, 'Choose a date'),
  reference_number: z.string().trim().max(80, 'Keep it under 80 characters').optional(),
})

type FormValues = z.infer<typeof schema>

function SubscriptionPicker({
  selected,
  onSelect,
}: {
  selected: SubscriptionDirectoryRow | null
  onSelect: (row: SubscriptionDirectoryRow | null) => void
}) {
  const [term, setTerm] = useState('')
  const deferred = useDeferredValue(term)

  const query = useQuery({
    queryKey: ['payment-subscription-picker', deferred],
    queryFn: () => listSubscriptions({ search: deferred, status: 'all', page: 1, pageSize: 6 }),
    enabled: deferred.trim().length > 0,
  })

  if (selected) {
    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Subscription</span>
        <div className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">
                {selected.display_name ?? 'Unnamed member'} · {selected.plan_name}
              </p>
              <p className="truncate text-xs text-slate-500">
                {selected.email} · {formatDate(selected.start_date)} → {formatDate(selected.end_date)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <SubscriptionStatusBadge status={selected.subscription_status} />
              <button
                type="button"
                onClick={() => onSelect(null)}
                className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200"
                aria-label="Clear subscription"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        label="Subscription"
        placeholder="Search client, member code, or plan"
        leadingIcon={<Search className="size-4" />}
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        autoComplete="off"
      />
      {deferred.trim().length > 0 && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {query.isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Searching…</p>
          ) : (query.data?.rows.length ?? 0) === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No subscriptions found.</p>
          ) : (
            <ul>
              {query.data?.rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(row)
                      setTerm('')
                    }}
                    className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {row.display_name ?? 'Unnamed member'} · {row.plan_name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {row.email} · ends {formatDate(row.end_date)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

export function RecordPaymentDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [subscription, setSubscription] = useState<SubscriptionDirectoryRow | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: '',
      payment_method: 'cash',
      payment_status: 'paid',
      payment_date: todayIsoDate(),
      reference_number: '',
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      amount: '',
      payment_method: 'cash',
      payment_status: 'paid',
      payment_date: todayIsoDate(),
      reference_number: '',
    })
    setSubscription(null)
    setFormError(null)
  }, [open, reset])

  const handleSelect = (row: SubscriptionDirectoryRow | null) => {
    setSubscription(row)
    if (row) setValue('amount', String(row.plan_price))
  }

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!subscription) throw new Error('Choose a subscription first')
      return recordPayment({
        membership_id: subscription.id,
        amount: Number(values.amount),
        payment_method: values.payment_method as PaymentMethod,
        payment_status: values.payment_status as PaymentStatus,
        payment_date: values.payment_date,
        reference_number: values.reference_number?.trim() || null,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
      queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
      queryClient.invalidateQueries({ queryKey: ['client-memberships', subscription?.client_id] })
      toast.success('Payment recorded')
      onClose()
    },
    onError: (error) => setFormError(paymentErrorMessage(error)),
  })

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title="Record payment"
      description="Manual payments are recorded against a subscription and audited."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="payment-form" loading={mutation.isPending}>
            Save payment
          </Button>
        </>
      }
    >
      <form
        id="payment-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}

        <SubscriptionPicker selected={subscription} onSelect={handleSelect} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Amount (PHP)"
            type="number"
            min="0"
            step="0.01"
            error={errors.amount?.message}
            {...register('amount')}
          />
          <Input
            label="Payment date"
            type="date"
            error={errors.payment_date?.message}
            {...register('payment_date')}
          />
          <Select label="Method" error={errors.payment_method?.message} {...register('payment_method')}>
            <option value="cash">Cash</option>
            <option value="gcash">GCash</option>
            <option value="card">Card</option>
            <option value="bank_transfer">Bank transfer</option>
          </Select>
          <Select label="Status" error={errors.payment_status?.message} {...register('payment_status')}>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </Select>
        </div>

        <Input
          label="Reference number"
          placeholder="Optional receipt or transaction reference"
          error={errors.reference_number?.message}
          {...register('reference_number')}
        />

        {subscription && (
          <p className="text-xs text-slate-500">
            Current plan price: {formatCurrency(subscription.plan_price)} · already paid{' '}
            {formatCurrency(subscription.paid_amount)}
          </p>
        )}
      </form>
    </Modal>
  )
}
