import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Clock, Globe2, Link2, Save, ShieldCheck } from 'lucide-react'
import { PageHeader, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDateTime } from '@/lib/utils'
import { getGymSettings, settingsErrorMessage, updateGymSettings } from './settingsApi'
import { QrPosterCard } from './QrPosterCard'

const timezones = [
  'Asia/Manila',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Dubai',
  'Australia/Sydney',
  'Europe/London',
  'America/New_York',
  'America/Los_Angeles',
  'UTC',
]

const urlField = (label: string) =>
  z
    .string()
    .trim()
    .max(500, `Keep the ${label} under 500 characters`)
    .optional()
    .refine(
      (value) => !value || /^https?:\/\/[^\s]+$/i.test(value),
      'Enter a full URL starting with http:// or https://',
    )

const schema = z.object({
  timezone: z.string().trim().min(1, 'Choose a timezone'),
  client_qr_url: urlField('client QR link'),
  admin_qr_url: urlField('admin QR link'),
})

type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const query = useQuery({
    queryKey: ['gym-settings'],
    queryFn: getGymSettings,
  })

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { timezone: 'Asia/Manila', client_qr_url: '', admin_qr_url: '' },
  })

  useEffect(() => {
    if (!query.data) return
    reset({
      timezone: query.data.timezone,
      client_qr_url: query.data.client_qr_url ?? '',
      admin_qr_url: query.data.admin_qr_url ?? '',
    })
  }, [query.data, reset])

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      if (!query.data) throw new Error('Settings are not loaded yet.')
      return updateGymSettings(query.data.id, {
        timezone: values.timezone,
        client_qr_url: values.client_qr_url?.trim() || null,
        admin_qr_url: values.admin_qr_url?.trim() || null,
      })
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['gym-settings'], data)
      queryClient.invalidateQueries({ queryKey: ['gym-settings'] })
      queryClient.invalidateQueries({ queryKey: ['gym-timezone'] })
      reset({
        timezone: data.timezone,
        client_qr_url: data.client_qr_url ?? '',
        admin_qr_url: data.admin_qr_url ?? '',
      })
      setFormError(null)
      toast.success('Gym settings saved')
    },
    onError: (error) => setFormError(settingsErrorMessage(error)),
  })

  const timezone = watch('timezone')
  let timezonePreview = '—'
  try {
    timezonePreview = new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone: timezone || 'Asia/Manila',
    }).format(new Date())
  } catch {
    timezonePreview = 'Unknown timezone'
  }

  const options = timezones.includes(query.data?.timezone ?? '')
    ? timezones
    : [...timezones, query.data?.timezone].filter(Boolean)

  const siteOrigin = window.location.origin
  const clientQrLink = (watch('client_qr_url') ?? '').trim()
  const adminQrLink = (watch('admin_qr_url') ?? '').trim()
  const clientPosterUrl = clientQrLink || `${siteOrigin}/checkin`
  const adminPosterUrl = adminQrLink || `${siteOrigin}/admin/attendance`

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Gym timezone, QR links, and printable check-in posters."
        action={<Badge tone="blue">Administrator</Badge>}
      />

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load settings">
            {settingsErrorMessage(query.error)}
          </Alert>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Gym configuration"
            description={
              query.data
                ? `Last updated ${formatDateTime(query.data.updated_at)}`
                : 'Loading current configuration'
            }
          />
          <CardBody>
            {query.isLoading ? (
              <div className="space-y-4">
                <div className="h-10 w-full animate-pulse rounded bg-white/[0.03]" />
                <div className="h-10 w-full animate-pulse rounded bg-white/[0.03]" />
                <div className="h-10 w-full animate-pulse rounded bg-white/[0.03]" />
              </div>
            ) : (
              <form
                className="space-y-5"
                onSubmit={handleSubmit((values) => {
                  setFormError(null)
                  mutation.mutate(values)
                })}
                noValidate
              >
                {formError && <Alert tone="error">{formError}</Alert>}

                <div>
                  <Select
                    label="Timezone"
                    error={errors.timezone?.message}
                    {...register('timezone')}
                  >
                    {options.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-relaxed text-slate-400">
                    <Clock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    Used for check-in dates, membership validity, attendance reports, and CSV
                    exports. Current time: <strong className="font-medium">{timezonePreview}</strong>
                  </p>
                </div>

                <Input
                  label="Client check-in QR link"
                  type="url"
                  placeholder={`${siteOrigin}/checkin`}
                  hint="Optional. Leave blank to use this site's /checkin URL. Encoded on the client poster below."
                  error={errors.client_qr_url?.message}
                  {...register('client_qr_url')}
                />

                <Input
                  label="Admin scanner QR link"
                  type="url"
                  placeholder={`${siteOrigin}/admin/attendance`}
                  hint="Optional. Leave blank to use this site's /admin/attendance URL. Encoded on the staff card below."
                  error={errors.admin_qr_url?.message}
                  {...register('admin_qr_url')}
                />

                <div className="flex justify-end border-t border-white/[0.07] pt-4">
                  <Button
                    type="submit"
                    loading={mutation.isPending}
                    disabled={!isDirty || mutation.isPending}
                  >
                    <Save className="size-4" aria-hidden />
                    Save settings
                  </Button>
                </div>
              </form>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Why this matters" />
            <CardBody className="space-y-3 text-sm leading-relaxed text-slate-300">
              <p className="flex items-start gap-2">
                <Globe2 className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                Membership start/end dates, check-in days, and report buckets are calculated in the
                gym timezone, not the browser's.
              </p>
              <p className="flex items-start gap-2">
                <Link2 className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                QR links are optional shortcuts printed on signage. Member identity still comes from
                the random QR token stored on each account.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Guarded in the database" />
            <CardBody className="space-y-2 text-sm leading-relaxed text-slate-300">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
                Only approved admins can update these settings. The database validates the timezone
                and QR links and writes every change to the audit log.
              </p>
              <Badge tone="slate" dot>
                RLS + trigger enforced
              </Badge>
            </CardBody>
          </Card>
        </div>
      </div>

      {query.data && (
        <section className="mt-8" aria-labelledby="qr-posters-heading">
          <div className="mb-4">
            <h2 id="qr-posters-heading" className="text-base font-semibold text-slate-100">
              Printable QR posters
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Print the client poster for the entrance and the staff card for the front desk. QR
              codes encode links only — check-in is still verified against the member's account and
              subscription.
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <QrPosterCard
              title="Client check-in"
              description="Clients scan this to open their check-in page."
              url={clientPosterUrl}
              isFallback={!clientQrLink}
              fileName="gymtrack-client-check-in-qr"
              steps={[
                'Scan the QR code and sign in with your member account.',
                'Tap Time in when you arrive and Time out when you leave.',
                'Show your member QR to staff if you prefer front-desk check-in.',
              ]}
            />
            <QrPosterCard
              title="Staff scanner"
              description="Staff scan this to open the member scanner."
              url={adminPosterUrl}
              isFallback={!adminQrLink}
              fileName="gymtrack-staff-scanner-qr"
              steps={[
                'Sign in with an administrator account.',
                'Tap Scan member QR and scan the member code.',
                'The server records the visit and validates the membership.',
              ]}
            />
          </div>
        </section>
      )}
    </div>
  )
}
