import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Activity, CalendarCheck, CreditCard, Mail, Plus, RefreshCw, Save, TrendingUp } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/Modal'
import {
  AccountStatusBadge,
  Badge,
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
import { AssignSubscriptionDialog } from '@/features/memberships/SubscriptionDialogs'
import { regenerateQrToken } from '@/features/attendance/attendanceApi'
import { listClientMetrics } from '@/features/metrics/metricsApi'
import { MetricFormDialog } from '@/features/metrics/MetricFormDialog'
import type { BodyMetricsDirectoryRow } from '@/types/database'

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
  const [assignOpen, setAssignOpen] = useState(false)
  const [qrConfirmOpen, setQrConfirmOpen] = useState(false)
  const [metricOpen, setMetricOpen] = useState(false)
  const [editingMetric, setEditingMetric] = useState<BodyMetricsDirectoryRow | null>(null)

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

  const metricsQuery = useQuery({
    queryKey: ['client-metrics', clientId],
    queryFn: () => listClientMetrics(clientId),
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

  const qrMutation = useMutation({
    mutationFn: () => regenerateQrToken(clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      await queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('QR code regenerated', 'The old code no longer checks this member in.')
      setQrConfirmOpen(false)
    },
    onError: (error) => toast.error('Could not regenerate QR code', clientErrorMessage(error)),
  })

  if (clientQuery.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
        <div className="h-32 animate-pulse rounded-2xl bg-white/[0.04]" />
        <div className="h-64 animate-pulse rounded-2xl bg-white/[0.04]" />
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
                  className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10"
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
  const metrics = metricsQuery.data ?? []
  const activeMembership = memberships.find((m) =>
    ['active', 'paused'].includes(m.subscription_status),
  )

  return (
    <div>
      <Link
        to="/admin/clients"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-400 hover:text-slate-100"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Clients
      </Link>

      <Card className="mb-5">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <ClientAvatar name={client.display_name} email={client.email} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-slate-100">
                {client.display_name ?? 'Unnamed member'}
              </h1>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-slate-400">
                <Mail className="size-3.5 shrink-0" aria-hidden />
                {client.email}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                <AccountStatusBadge status={client.account_status} />
                <MembershipStatusBadge status={client.membership_status} />
                {client.member_code && (
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-0.5 font-mono text-xs text-slate-300">
                    {client.member_code}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ClientStatusActions client={client} />
        </CardBody>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
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
                <div className="flex items-center gap-2">
                  {activeMembership && (
                    <SubscriptionStatusBadge status={activeMembership.subscription_status} />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAssignOpen(true)}
                    disabled={Boolean(activeMembership)}
                    title={
                      activeMembership
                        ? 'Renew or cancel the current subscription first'
                        : undefined
                    }
                  >
                    <CreditCard className="size-3.5" aria-hidden />
                    Assign plan
                  </Button>
                </div>
              }
            />
            <CardBody className="p-0">
              {membershipsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-56 animate-pulse rounded bg-white/[0.03]" />
                </div>
              ) : memberships.length === 0 ? (
                <EmptyState
                  icon={<CreditCard className="size-7" aria-hidden />}
                  title="No subscriptions yet"
                  description="Assign a plan to this client to activate their membership."
                  action={
                    <Button size="sm" onClick={() => setAssignOpen(true)}>
                      Assign plan
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-white/[0.07]">
                  {memberships.map((membership) => (
                    <li
                      key={membership.id}
                      className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-100">
                          {membership.plan?.name ?? 'Plan removed'}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
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

          <Card>
            <CardHeader
              title="Body metrics"
              description="Latest measurements and BMI"
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingMetric(null)
                    setMetricOpen(true)
                  }}
                >
                  <Plus className="size-3.5" aria-hidden />
                  Record
                </Button>
              }
            />
            <CardBody className="p-0">
              {metricsQuery.isLoading ? (
                <div className="space-y-2 p-5">
                  <div className="h-4 w-40 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-4 w-52 animate-pulse rounded bg-white/[0.03]" />
                </div>
              ) : metrics.length === 0 ? (
                <EmptyState
                  icon={<Activity className="size-7" aria-hidden />}
                  title="No measurements yet"
                  description="Record the member's first weight, height, or waist measurement."
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        setEditingMetric(null)
                        setMetricOpen(true)
                      }}
                    >
                      Record measurement
                    </Button>
                  }
                />
              ) : (
                <ul className="divide-y divide-white/[0.07]">
                  {metrics.slice(0, 6).map((metric) => (
                    <li
                      key={metric.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100">
                          {formatDate(metric.measured_at)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          {metric.weight_kg != null ? `${metric.weight_kg} kg` : '—'} ·{' '}
                          {metric.waist_cm != null ? `${metric.waist_cm} cm waist` : 'no waist'}
                          {metric.bmi != null ? ` · BMI ${metric.bmi}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge tone={metric.recorded_by === client.id ? 'blue' : 'violet'} dot>
                          {metric.recorded_by === client.id ? 'Self' : 'Gym'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingMetric(metric)
                            setMetricOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Check-in QR" description="Scan at the front desk or show to the member" />
            <CardBody className="text-center">
              {client.qr_token ? (
                <>
                  <div className="mx-auto inline-flex rounded-xl border border-white/10 bg-white p-3">
                    <QRCodeSVG
                      value={client.qr_token}
                      size={148}
                      level="M"
                      marginSize={0}
                      title={`QR code for ${client.display_name ?? client.email}`}
                    />
                  </div>
                  <p className="mt-2 break-all font-mono text-[11px] text-slate-400">
                    {client.qr_token}
                  </p>
                </>
              ) : (
                <p className="py-6 text-sm text-slate-400">QR code is not available yet.</p>
              )}
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full"
                onClick={() => setQrConfirmOpen(true)}
                loading={qrMutation.isPending}
                disabled={!client.qr_token}
              >
                <RefreshCw className="size-3.5" aria-hidden />
                Regenerate QR
              </Button>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Account status</span>
                <AccountStatusBadge status={client.account_status} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Membership</span>
                <MembershipStatusBadge status={client.membership_status} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Role</span>
                <span className="font-medium capitalize text-slate-100">{client.role}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Registered</span>
                <span className="text-right font-medium text-slate-100">
                  {formatDate(client.created_at)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400">Details updated</span>
                <span className="text-right text-xs text-slate-300">
                  {client.detail_updated_at ? formatDateTime(client.detail_updated_at) : '—'}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Email address" description="Read-only for the member" />
            <CardBody>
              <p className="break-all rounded-lg bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                {client.email}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">
                Members cannot change their own email. Email changes must be handled by an
                administrator through Supabase Authentication.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Activity" />
            <CardBody className="space-y-2.5 text-sm">
              <Link
                to="/admin/attendance"
                className="flex items-center gap-2.5 text-slate-300 hover:text-brand-200"
              >
                <CalendarCheck className="size-4 text-slate-400" aria-hidden />
                <span>Attendance history</span>
                <span className="ml-auto text-xs text-slate-400">Open</span>
              </Link>
              <div className="flex items-center gap-2.5 text-slate-300">
                <TrendingUp className="size-4 text-slate-400" aria-hidden />
                <span>Body metrics</span>
                <span className="ml-auto text-xs text-slate-400">Shown above</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <AssignSubscriptionDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        defaultClient={{
          id: client.id,
          label: `${client.display_name ?? 'Unnamed member'} · ${client.email}`,
        }}
      />

      <ConfirmDialog
        open={qrConfirmOpen}
        onClose={() => setQrConfirmOpen(false)}
        onConfirm={() => qrMutation.mutate()}
        title="Regenerate check-in QR"
        description="The member's current QR code will stop working immediately. Use this if the old code was shared or lost."
        confirmLabel="Regenerate QR"
        loading={qrMutation.isPending}
      />

      <MetricFormDialog
        open={metricOpen}
        onClose={() => setMetricOpen(false)}
        clientId={client.id}
        metric={editingMetric}
        defaultHeight={client.height_cm}
        scope="admin"
      />
    </div>
  )
}
