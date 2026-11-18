import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CalendarDays, Search, Wallet, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, todayIsoDate } from '@/lib/utils'
import type {
  PaymentMethod,
  PaymentStatus,
  SubscriptionDirectoryRow,
} from '@/types/database'
import { listClients } from '@/features/clients/api'
import { listActivePlans } from './plansApi'
import {
  assignSubscription,
  assignSubscriptionWithPayment,
  changeSubscriptionPlan,
  renewSubscription,
  renewSubscriptionWithPayment,
  subscriptionErrorMessage,
  type SubscriptionPaymentInput,
} from './subscriptionsApi'

export interface PickedClient {
  id: string
  label: string
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`)
  value.setDate(value.getDate() + days)
  const offset = value.getTimezoneOffset() * 60_000
  return new Date(value.getTime() - offset).toISOString().slice(0, 10)
}

function invalidateBilling(queryClient: ReturnType<typeof useQueryClient>, clientId?: string) {
  queryClient.invalidateQueries({ queryKey: ['subscriptions'] })
  queryClient.invalidateQueries({ queryKey: ['subscription-summary'] })
  queryClient.invalidateQueries({ queryKey: ['plans'] })
  queryClient.invalidateQueries({ queryKey: ['clients'] })
  if (clientId) {
    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    queryClient.invalidateQueries({ queryKey: ['client-memberships', clientId] })
  }
}

const paymentDefaults = {
  record_payment: true,
  amount: '',
  payment_date: todayIsoDate(),
  payment_method: 'cash' as PaymentMethod,
  payment_status: 'paid' as PaymentStatus,
  reference_number: '',
}

type PaymentValues = {
  record_payment: boolean
  amount: string
  payment_date: string
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  reference_number: string
}

function toPaymentInput(values: PaymentValues): SubscriptionPaymentInput | null {
  if (!values.record_payment) return null
  return {
    amount: Number(values.amount),
    payment_method: values.payment_method,
    payment_status: values.payment_status,
    payment_date: values.payment_date,
    reference_number: values.reference_number.trim() || null,
  }
}

function PaymentFields({
  register,
  enabled,
  selectedPrice,
  amount,
  errors,
}: {
  register: (name: keyof PaymentValues) => UseFormRegisterReturn
  enabled: boolean
  selectedPrice?: number
  amount: string
  errors: Partial<Record<keyof PaymentValues, string | undefined>>
}) {
  const parsed = Number(amount)
  const recorded = Number.isFinite(parsed) ? parsed : 0
  const balance = selectedPrice != null ? Math.max(selectedPrice - recorded, 0) : null

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-0.5 size-4 rounded border-slate-300 accent-brand-600"
          {...register('record_payment')}
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-slate-900">
            <Wallet className="size-4 text-slate-400" aria-hidden />
            Record payment now
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
            Optional. Turn off for unpaid, trial, or comped memberships.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Amount (PHP)"
              type="number"
              min="0"
              step="0.01"
              hint={selectedPrice != null ? `Plan price ${formatCurrency(selectedPrice)}` : undefined}
              error={errors.amount}
              {...register('amount')}
            />
            <Input
              label="Payment date"
              type="date"
              error={errors.payment_date}
              {...register('payment_date')}
            />
            <Select label="Method" error={errors.payment_method} {...register('payment_method')}>
              <option value="cash">Cash</option>
              <option value="gcash">GCash</option>
              <option value="card">Card</option>
              <option value="bank_transfer">Bank transfer</option>
            </Select>
            <Select label="Status" error={errors.payment_status} {...register('payment_status')}>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="refunded">Refunded</option>
            </Select>
          </div>

          <Input
            label="Reference number"
            placeholder="Optional receipt or transaction reference"
            error={errors.reference_number}
            {...register('reference_number')}
          />

          {selectedPrice != null && (
            <p className="text-xs text-slate-500">
              Recording {formatCurrency(recorded)} of {formatCurrency(selectedPrice)}
              {balance != null && balance > 0 ? ` · ${formatCurrency(balance)} balance` : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

function ClientPicker({
  selected,
  onSelect,
}: {
  selected: PickedClient | null
  onSelect: (client: PickedClient | null) => void
}) {
  const [term, setTerm] = useState('')
  const deferred = useDeferredValue(term)

  const query = useQuery({
    queryKey: ['client-picker', deferred],
    queryFn: () =>
      listClients({
        search: deferred,
        accountStatus: 'all',
        membershipStatus: 'all',
        sort: 'name',
        page: 1,
        pageSize: 6,
      }),
    enabled: deferred.trim().length > 0,
  })

  if (selected) {
    return (
      <div>
        <span className="mb-1.5 block text-sm font-medium text-slate-700">Client</span>
        <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2">
          <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{selected.label}</span>
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex size-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200"
            aria-label="Clear selected client"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative">
      <Input
        label="Client"
        placeholder="Search name, email, or member code"
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
            <p className="px-3 py-2 text-xs text-slate-500">No clients found.</p>
          ) : (
            <ul>
              {query.data?.rows.map((client) => (
                <li key={client.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect({
                        id: client.id,
                        label: `${client.display_name ?? 'Unnamed member'} · ${client.email}`,
                      })
                      setTerm('')
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  >
                    <span className="block truncate font-medium text-slate-900">
                      {client.display_name ?? 'Unnamed member'}
                    </span>
                    <span className="block truncate text-xs text-slate-500">{client.email}</span>
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

const paymentFields = {
  record_payment: z.boolean(),
  amount: z.string().trim(),
  payment_date: z.string(),
  payment_method: z.enum(['cash', 'gcash', 'card', 'bank_transfer']),
  payment_status: z.enum(['paid', 'pending', 'failed', 'refunded']),
  reference_number: z.string().trim().max(80, 'Keep it under 80 characters'),
}

const assignSchema = z
  .object({
    plan_id: z.string().min(1, 'Choose a plan'),
    start_date: z.string().min(1, 'Choose a start date'),
    ...paymentFields,
  })
  .superRefine((values, ctx) => {
    if (!values.record_payment) return
    const amount = Number(values.amount)
    if (!values.amount || Number.isNaN(amount) || amount < 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a valid amount' })
    }
    if (!values.payment_date) {
      ctx.addIssue({ code: 'custom', path: ['payment_date'], message: 'Choose a payment date' })
    }
  })

type AssignValues = z.infer<typeof assignSchema>

export function AssignSubscriptionDialog({
  open,
  onClose,
  defaultClient,
  defaultPlanId,
}: {
  open: boolean
  onClose: () => void
  defaultClient?: PickedClient
  defaultPlanId?: string
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [client, setClient] = useState<PickedClient | null>(defaultClient ?? null)
  const [formError, setFormError] = useState<string | null>(null)

  const plansQuery = useQuery({
    queryKey: ['active-plans'],
    queryFn: listActivePlans,
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AssignValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: { plan_id: '', start_date: todayIsoDate(), ...paymentDefaults },
  })

  useEffect(() => {
    if (!open) return
    setClient(defaultClient ?? null)
    reset({
      plan_id: defaultPlanId ?? '',
      start_date: todayIsoDate(),
      ...paymentDefaults,
      payment_date: todayIsoDate(),
    })
    setFormError(null)
  }, [open, defaultClient?.id, defaultPlanId, reset])

  const planId = watch('plan_id')
  const startDate = watch('start_date')
  const recordPayment = watch('record_payment')
  const amount = watch('amount')
  const selectedPlan = plansQuery.data?.find((plan) => plan.id === planId)
  const selectedPlanPrice = selectedPlan?.price

  useEffect(() => {
    if (!open || !recordPayment || selectedPlanPrice == null) return
    setValue('amount', String(selectedPlanPrice), { shouldValidate: false })
  }, [open, recordPayment, selectedPlanPrice, setValue])

  const mutation = useMutation({
    mutationFn: (values: AssignValues) => {
      if (!client) throw new Error('Choose a client first')
      const payment = toPaymentInput(values)
      if (payment) {
        return assignSubscriptionWithPayment(
          client.id,
          values.plan_id,
          values.start_date,
          payment,
        )
      }
      return assignSubscription(client.id, values.plan_id, values.start_date)
    },
    onSuccess: (_data, values) => {
      invalidateBilling(queryClient, client?.id)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
      toast.success(
        'Subscription activated',
        values.record_payment
          ? `The client is now a member and ${formatCurrency(Number(values.amount))} was recorded as ${values.payment_status}.`
          : 'The client is now a member. No payment was recorded.',
      )
      onClose()
    },
    onError: (error) => setFormError(subscriptionErrorMessage(error)),
  })

  const plans = useMemo(() => plansQuery.data ?? [], [plansQuery.data])

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title="New subscription"
      description="A client can hold one active or paused subscription at a time."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="assign-subscription-form" loading={mutation.isPending}>
            Activate subscription
          </Button>
        </>
      }
    >
      <form
        id="assign-subscription-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}
        {!defaultClient && <ClientPicker selected={client} onSelect={setClient} />}

        <Select
          label="Plan"
          error={errors.plan_id?.message}
          {...register('plan_id')}
          disabled={plansQuery.isLoading}
        >
          <option value="">{plansQuery.isLoading ? 'Loading plans…' : 'Choose a plan'}</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.duration_days} {plan.duration_days === 1 ? 'day' : 'days'} —{' '}
              {formatCurrency(plan.price)}
            </option>
          ))}
        </Select>

        <Input
          label="Start date"
          type="date"
          error={errors.start_date?.message}
          {...register('start_date')}
        />

        {selectedPlan && startDate && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
            <p className="flex items-center gap-2 font-medium">
              <CalendarDays className="size-4" aria-hidden />
              {formatDate(startDate)} → {formatDate(addDays(startDate, selectedPlan.duration_days - 1))}
            </p>
            <p className="mt-1 text-xs text-brand-700">
              {selectedPlan.duration_days}{' '}
              {selectedPlan.duration_days === 1 ? 'day' : 'days'} ·{' '}
              {formatCurrency(selectedPlan.price)} recorded as
              the subscription price.
            </p>
          </div>
        )}

        <PaymentFields
          register={register}
          enabled={recordPayment}
          selectedPrice={selectedPlan?.price}
          amount={amount}
          errors={{
            amount: errors.amount?.message,
            payment_date: errors.payment_date?.message,
            payment_method: errors.payment_method?.message,
            payment_status: errors.payment_status?.message,
            reference_number: errors.reference_number?.message,
          }}
        />
      </form>
    </Modal>
  )
}

const renewSchema = z
  .object({
    plan_id: z.string().min(1, 'Choose a plan'),
    start_date: z.string().min(1, 'Choose a start date'),
    ...paymentFields,
  })
  .superRefine((values, ctx) => {
    if (!values.record_payment) return
    const amount = Number(values.amount)
    if (!values.amount || Number.isNaN(amount) || amount < 0) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: 'Enter a valid amount' })
    }
    if (!values.payment_date) {
      ctx.addIssue({ code: 'custom', path: ['payment_date'], message: 'Choose a payment date' })
    }
  })

type RenewValues = z.infer<typeof renewSchema>

export function RenewSubscriptionDialog({
  open,
  onClose,
  subscription,
}: {
  open: boolean
  onClose: () => void
  subscription: SubscriptionDirectoryRow | null
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const plansQuery = useQuery({
    queryKey: ['active-plans'],
    queryFn: listActivePlans,
    enabled: open,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RenewValues>({
    resolver: zodResolver(renewSchema),
    defaultValues: { plan_id: '', start_date: todayIsoDate(), ...paymentDefaults },
  })

  useEffect(() => {
    if (!open || !subscription) return
    const defaultStart =
      subscription.end_date >= todayIsoDate() ? addDays(subscription.end_date, 1) : todayIsoDate()
    reset({
      plan_id: subscription.plan_id,
      start_date: defaultStart,
      ...paymentDefaults,
      payment_date: todayIsoDate(),
    })
    setFormError(null)
  }, [open, subscription, reset])

  const planId = watch('plan_id')
  const startDate = watch('start_date')
  const recordPayment = watch('record_payment')
  const amount = watch('amount')
  const selectedPlan = plansQuery.data?.find((plan) => plan.id === planId)
  const selectedPlanPrice = selectedPlan?.price

  useEffect(() => {
    if (!open || !recordPayment || selectedPlanPrice == null) return
    setValue('amount', String(selectedPlanPrice), { shouldValidate: false })
  }, [open, recordPayment, selectedPlanPrice, setValue])

  const mutation = useMutation({
    mutationFn: (values: RenewValues) => {
      if (!subscription) throw new Error('No subscription selected')
      const payment = toPaymentInput(values)
      if (payment) {
        return renewSubscriptionWithPayment(
          subscription.id,
          values.plan_id,
          values.start_date,
          payment,
        )
      }
      return renewSubscription(subscription.id, values.plan_id, values.start_date)
    },
    onSuccess: (_data, values) => {
      invalidateBilling(queryClient, subscription?.client_id)
      queryClient.invalidateQueries({ queryKey: ['payments'] })
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] })
      toast.success(
        'Subscription renewed',
        values.record_payment
          ? `${formatCurrency(Number(values.amount))} was recorded as ${values.payment_status}.`
          : 'No payment was recorded.',
      )
      onClose()
    },
    onError: (error) => setFormError(subscriptionErrorMessage(error)),
  })

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title="Renew subscription"
      description={
        subscription
          ? `Current period: ${formatDate(subscription.start_date)} → ${formatDate(subscription.end_date)}`
          : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="renew-form" loading={mutation.isPending}>
            Renew
          </Button>
        </>
      }
    >
      <form
        id="renew-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}
        <p className="text-sm leading-relaxed text-slate-600">
          The current subscription is retired as <strong>expired</strong> and a new subscription is
          created. History is preserved for reporting.
        </p>

        <Select label="Plan" error={errors.plan_id?.message} {...register('plan_id')}>
          {(plansQuery.data ?? []).map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.duration_days} {plan.duration_days === 1 ? 'day' : 'days'} —{' '}
              {formatCurrency(plan.price)}
            </option>
          ))}
        </Select>

        <Input label="New start date" type="date" error={errors.start_date?.message} {...register('start_date')} />

        {selectedPlan && startDate && (
          <div className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
            <p className="font-medium">
              {formatDate(startDate)} → {formatDate(addDays(startDate, selectedPlan.duration_days - 1))}
            </p>
            <p className="mt-1 text-xs text-brand-700">{formatCurrency(selectedPlan.price)}</p>
          </div>
        )}

        <PaymentFields
          register={register}
          enabled={recordPayment}
          selectedPrice={selectedPlan?.price}
          amount={amount}
          errors={{
            amount: errors.amount?.message,
            payment_date: errors.payment_date?.message,
            payment_method: errors.payment_method?.message,
            payment_status: errors.payment_status?.message,
            reference_number: errors.reference_number?.message,
          }}
        />
      </form>
    </Modal>
  )
}

export function ChangePlanDialog({
  open,
  onClose,
  subscription,
}: {
  open: boolean
  onClose: () => void
  subscription: SubscriptionDirectoryRow | null
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [planId, setPlanId] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  const plansQuery = useQuery({
    queryKey: ['active-plans'],
    queryFn: listActivePlans,
    enabled: open,
  })

  useEffect(() => {
    if (open) {
      setPlanId('')
      setFormError(null)
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => {
      if (!subscription) throw new Error('No subscription selected')
      if (!planId) throw new Error('Choose a new plan')
      return changeSubscriptionPlan(subscription.id, planId)
    },
    onSuccess: () => {
      invalidateBilling(queryClient, subscription?.client_id)
      toast.success('Plan changed', 'The previous subscription was cancelled.')
      onClose()
    },
    onError: (error) => setFormError(subscriptionErrorMessage(error)),
  })

  const options = (plansQuery.data ?? []).filter((plan) => plan.id !== subscription?.plan_id)

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title="Change plan"
      description="The current subscription is cancelled and a new one starts today."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!planId}
          >
            Change plan
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {formError && <Alert tone="error">{formError}</Alert>}
        <Select label="New plan" value={planId} onChange={(event) => setPlanId(event.target.value)}>
          <option value="">Choose a plan</option>
          {options.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.duration_days} {plan.duration_days === 1 ? 'day' : 'days'} —{' '}
              {formatCurrency(plan.price)}
            </option>
          ))}
        </Select>
        <p className="text-xs leading-relaxed text-slate-500">
          Cancellation is terminal. Remaining days on the old subscription are not carried over.
        </p>
      </div>
    </Modal>
  )
}
