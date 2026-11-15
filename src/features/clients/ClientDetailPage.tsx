import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, CalendarCheck, CreditCard, Mail, Save, TrendingUp } from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import {
  AccountStatusBadge,
  MembershipStatusBadge,
  SubscriptionStatusBadge,
} from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatDateTime } from '@/lib/utils'
import {
  clientErrorMessage,
  getClient,
  listClientMemberships,
  updateClientDetails,
} from './api'
import { ClientAvatar, ClientStatusActions } from './ClientStatusActions'

const schema = z.object({
  display_name: z.string().trim().max(120, 'Keep it under 120 characters').optional(),
  member_code: z
    .string()
    .trim()
    .max(60, 'Keep it under 60 characters')
    .regex(/^[A-Za-z0-9._-]*$/, 'Letters, numbers, dot, dash and underscore only')
    .optional(),
  phone: z.string().trim().max(30, 'Too long').optional(),
  date_of_birth: z
    .string()
    .optional()
    .refine(
      (value) => !value || (!Number.isNaN(Date.parse(value)) && new Date(value) < new Date()),
      'Enter a valid past date',
    ),
  emergency_contact: z.string().trim().max(160, 'Too long').optional(),
  height_cm: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || (Number(value) >= 30 && Number(value) <= 350),
      'Enter a height between 30 and 350 cm',
    ),
  notes: z.string().trim().max(2000, 'Keep notes under 2000 characters').optional(),
})

type FormValues = z.infer<typeof schema>

export function ClientDetailPage() {
  const { clientId = '' } = useParams()
  const toast = useToast()
  const queryClient = useQueryClient()

  const clientQuery = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => getClient(clientId),
    enabled: Boolean(clientId),
  })

  const membershipsQuery = useQuery({
    queryKey: ['client-memberships', clientId],
    queryFn: () => listClientMemberships(clientId),
    enabled: Boolean(clientId),
  })

  const client = clientQuery.data ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      display_name: '',
      member_code: '',
      phone: '',
      date_of_birth: '',
      emergency_contact: '',
      height_cm: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (!client) return
    reset({
      display_name: client.display_name ?? '',
      member_code: client.member_code ?? '',
      phone: client.phone ?? '',
      date_of_birth: client.date_of_birth ?? '',
      emergency_contact: client.emergency_contact ?? '',
      height_cm: client.height_cm != null ? String(client.height_cm) : '',
      notes: client.notes ?? '',
    })
  }, [client, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      updateClientDetails(clientId, {
        display_name: values.display_name?.trim() || null,
        member_code: values.member_code?.trim() || null,
        phone: values.phone?.trim() || null,
        date_of_birth: values.date_of_birth?.trim() || null,
        emergency_contact: values.emergency_contact?.trim() || null,
        height_cm: values.height_cm?.trim() ? Number(values.height_cm) : null,
        notes: values.notes?.trim() || null,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['client', clientId] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
      ])
      toast.success('Client details saved')
    },
    onError: (error) => toast.error('Could not save details', clientErrorMessage(error)),
  })

  if (clientQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-200" />
        <div className="h-32 animate-pulse rounded-xl bg-white" />
        <div className="h-64 animate-pulse rounded-xl bg-white" />
      </div>
    )
  }

  if (clientQuery.isError) {
    return (
      <Alert tone="error" title="Could not load this client">
        {(clientQuery.error as Error).message}
      </Alert>
    )
  }

  if (!client) {
    return (
      <div>
        <PageHeader title="Client not found" />
        <Card>
          <CardBody>
            <EmptyState
              title="This client does not exist"
              description="The account may have been removed, or you may not have access to it."
              action={
                <Link
                  to="/admin/clients"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  Back to clients
                </Link>
              }
            />
          </CardBody>
        </Card>
      </div>
    )
  }

  const memberships = membershipsQuery.data ?? []
  const activeMembership = memberships.find((m) =>
    ['active', 'paused'].includes(m.subscription_status),
  )

  return (
    <div>
      <Link
        to="/admin/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Clients
      </Link>

      <Card className="mb-5">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ClientAvatar name={client.display_name} email={client.email} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-900">
                {client.display_name ?? 'Unnamed member'}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-500">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {client.email}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <AccountStatusBadge status={client.account_status} />
                <MembershipStatusBadge status={client.membership_status} />
                {client.member_code && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-xs text-slate-600">
                    {client.member_code}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ClientStatusActions client={client} />
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <CardHeader
              title="Member details"
              description="Admin-managed identity. Clients cannot edit these fields."
            />
            <CardBody>
              <form
                onSubmit={handleSubmit((values) => mutation.mutate(values))}
                className="space-y-4"
                noValidate
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="Display name"
                    placeholder="Juan Dela Cruz"
                    error={errors.display_name?.message}
                    {...register('display_name')}
                  />
                  <Input
                    label="Member code"
                    placeholder="GT-0001"
                    error={errors.member_code?.message}
                    {...register('member_code')}
                  />
                  <Input
                    label="Phone"
                    type="tel"
                    placeholder="+63 900 000 0000"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                  <Input
                    label="Date of birth"
                    type="date"
                    max={new Date().toISOString().slice(0, 10)}
                    error={errors.date_of_birth?.message}
                    {...register('date_of_birth')}
                  />
                  <Input
                    label="Height (cm)"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="30"
                    max="350"
                    placeholder="170"
                    error={errors.height_cm?.message}
                    {...register('height_cm')}
                  />
                  <Input
                    label="Emergency contact"
                    placeholder="Name — relationship — phone"
                    error={errors.emergency_contact?.message}
                    {...register('emergency_contact')}
                  />
                </div>

                <Textarea
                  label="Notes"
                  rows={3}
                  placeholder="Injuries, preferences, or other notes for staff"
                  error={errors.notes?.message}
                  {...register('notes')}
                />

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!isDirty || mutation.isPending}
                    onClick={() => reset()}
                  >
                    Reset
                  </Button>
                  <Button type="submit" loading={mutation.isPending} disabled={!isDirty}>
                    <Save className="size-4" aria-hidden />
                    Save changes
                  </Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Subscriptions"
              description="Membership history for this client"
              action={
                activeMembership && (
                  <SubscriptionStatusBadge status={activeMembership.subscription_status} />
                )
              }
            />
            <CardBody className="p-0">
              {membershipsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-56 animate-pulse rounded bg-slate-50" />
                </div>
              ) : memberships.length === 0 ? (
                <EmptyState
                  icon={<CreditCard className="size-7" aria-hidden />}
                  title="No subscriptions yet"
                  description="Assign a plan to this client from the Subscriptions page."
                />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {memberships.map((membership) => (
                    <li
                      key={membership.id}
                      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {membership.plan?.name ?? 'Plan removed'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {formatDate(membership.start_date)} → {formatDate(membership.end_date)}
                        </p>
                      </div>
                      <SubscriptionStatusBadge status={membership.subscription_status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Account" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Account status</span>
                <AccountStatusBadge status={client.account_status} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Membership</span>
                <MembershipStatusBadge status={client.membership_status} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Role</span>
                <span className="font-medium capitalize text-slate-900">{client.role}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Registered</span>
                <span className="text-right font-medium text-slate-900">
                  {formatDate(client.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Details updated</span>
                <span className="text-right text-xs text-slate-600">
                  {client.detail_updated_at ? formatDateTime(client.detail_updated_at) : '—'}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Email address" description="Read-only for the member" />
            <CardBody>
              <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                {client.email}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500">
                Members cannot change their own email. Email changes must be handled by an
                administrator through Supabase Authentication.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2.5 text-slate-600">
                <CalendarCheck className="size-4 text-slate-400" aria-hidden />
                <span>Attendance history</span>
                <span className="ml-auto text-xs text-slate-400">Phase 4</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-600">
                <TrendingUp className="size-4 text-slate-400" aria-hidden />
                <span>Body metrics</span>
                <span className="ml-auto text-xs text-slate-400">Phase 5</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
