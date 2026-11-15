import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle2, Lock, Mail, QrCode, Save, Shield, User } from 'lucide-react'
import { PageHeader, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge, MembershipStatusBadge, SubscriptionStatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate } from '@/lib/utils'
import { listClientMemberships } from '@/features/clients/api'

const schema = z.object({
  phone: z
    .string()
    .trim()
    .max(30, 'Keep it under 30 characters')
    .regex(/^[0-9+()\-\s]*$/, 'Use digits, spaces, and + ( ) - only')
    .optional(),
})

type FormValues = z.infer<typeof schema>

export function ProfilePage() {
  const { profile, clientDetail, refresh } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { phone: '' },
  })

  useEffect(() => {
    reset({ phone: profile?.phone ?? '' })
  }, [profile?.phone, reset])

  const membershipsQuery = useQuery({
    queryKey: ['client-memberships', profile?.id],
    queryFn: () => listClientMemberships(profile!.id),
    enabled: Boolean(profile?.id),
  })

  const membership = (membershipsQuery.data ?? []).find((row) =>
    ['active', 'paused'].includes(row.subscription_status),
  )

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!profile?.id) throw new Error('Your profile is not loaded yet.')
      const { error } = await supabase
        .from('profiles')
        .update({ phone: values.phone?.trim() || null })
        .eq('id', profile.id)
      if (error) throw error
    },
    onSuccess: async () => {
      await refresh()
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Phone number updated')
      setFormError(null)
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error)
      setFormError(
        /phone/i.test(message)
          ? 'Only your phone number can be updated here. Contact the gym for other changes.'
          : message,
      )
    },
  })

  return (
    <div>
      <PageHeader
        title="My Profile"
        description="Your account, membership, and contact details."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Account"
              description="Managed by the gym"
              action={profile && <MembershipStatusBadge status={profile.membership_status} />}
            />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <User className="size-4" aria-hidden />
                  Name
                </span>
                <span className="font-medium text-slate-900">
                  {clientDetail?.display_name ?? 'Not set'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-slate-500">
                  <Mail className="size-4" aria-hidden />
                  Email
                </span>
                <span className="truncate font-medium text-slate-900">{profile?.email ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Member code</span>
                <span className="font-mono text-xs font-medium text-slate-900">
                  {clientDetail?.member_code ?? 'Not assigned'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Member since</span>
                <span className="font-medium text-slate-900">
                  {formatDate(profile?.created_at)}
                </span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Contact number" description="You can keep this up to date" />
            <CardBody>
              <form
                className="space-y-4"
                onSubmit={handleSubmit((values) => mutation.mutate(values))}
                noValidate
              >
                {formError && <Alert tone="error">{formError}</Alert>}
                <Input
                  label="Phone"
                  type="tel"
                  placeholder="+63 912 345 6789"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    loading={mutation.isPending}
                    disabled={!isDirty || mutation.isPending}
                  >
                    <Save className="size-4" aria-hidden />
                    Save phone
                  </Button>
                </div>
              </form>
              <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
                <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                Name, member code, height, date of birth, and emergency contact are maintained by
                gym staff.
              </p>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Membership"
              description="Current plan and validity"
              action={
                membership && (
                  <SubscriptionStatusBadge status={membership.subscription_status} />
                )
              }
            />
            <CardBody>
              {membershipsQuery.isLoading ? (
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-48 animate-pulse rounded bg-slate-50" />
                </div>
              ) : membership ? (
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Plan</span>
                    <span className="font-medium text-slate-900">
                      {membership.plan?.name ?? 'Membership plan'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Valid</span>
                    <span className="text-right font-medium text-slate-900">
                      {formatDate(membership.start_date)} → {formatDate(membership.end_date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Price at signup</span>
                    <span className="font-medium text-slate-900">
                      {membership.price_at_assignment != null
                        ? formatCurrency(membership.price_at_assignment)
                        : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm leading-relaxed text-slate-600">
                  No active membership. Ask the gym admin to assign a plan.
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to="/checkin"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <QrCode className="size-4" aria-hidden />
                  Check-in QR
                </Link>
                <Link
                  to="/app/progress"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  View progress
                </Link>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Personal details" description="Read-only" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Height</span>
                <span className="font-medium text-slate-900">
                  {clientDetail?.height_cm != null ? `${clientDetail.height_cm} cm` : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Date of birth</span>
                <span className="font-medium text-slate-900">
                  {clientDetail?.date_of_birth ? formatDate(clientDetail.date_of_birth) : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Emergency contact</span>
                <span className="max-w-48 truncate text-right font-medium text-slate-900">
                  {clientDetail?.emergency_contact ?? '—'}
                </span>
              </div>
              {clientDetail?.notes && (
                <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                  {clientDetail.notes}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Account safety" />
            <CardBody className="space-y-3 text-sm text-slate-600">
              <p className="flex items-start gap-2">
                <Shield className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                Your QR code identifies your membership. Keep it private and ask the gym to
                regenerate it if it is shared or lost.
              </p>
              <p className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                Your account is approved and managed by gym staff. Contact the front desk for
                email changes.
              </p>
              {profile && (
                <Badge tone="slate" dot>
                  Account: {profile.account_status}
                </Badge>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
