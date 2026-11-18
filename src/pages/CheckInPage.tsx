import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Clock, LogIn, LogOut, QrCode, ShieldAlert } from 'lucide-react'
import { useAuth } from '@/features/auth/AuthProvider'
import { Card, CardBody } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { MembershipStatusBadge, SubscriptionStatusBadge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatDate, formatDuration, formatTimeIn, todayIsoDate } from '@/lib/utils'
import {
  attendanceErrorMessage,
  getGymTimezone,
  getMyMembershipState,
  getMyOpenSession,
  listMyAttendance,
  selfCheckIn,
  selfCheckOut,
} from '@/features/attendance/attendanceApi'

export function CheckInPage() {
  const { profile, clientDetail, refresh } = useAuth()
  const toast = useToast()
  const queryClient = useQueryClient()
  const [error, setError] = useState<string | null>(null)

  const openQuery = useQuery({
    queryKey: ['my-open-session', profile?.id],
    queryFn: () => getMyOpenSession(profile!.id),
    enabled: Boolean(profile?.id),
  })

  const membershipQuery = useQuery({
    queryKey: ['my-membership-state', profile?.id],
    queryFn: () => getMyMembershipState(profile!.id),
    enabled: Boolean(profile?.id),
  })

  const recentQuery = useQuery({
    queryKey: ['my-attendance', 'recent'],
    queryFn: () => listMyAttendance({ page: 1, pageSize: 5 }),
    enabled: Boolean(profile?.id),
  })

  const timezoneQuery = useQuery({
    queryKey: ['gym-timezone'],
    queryFn: getGymTimezone,
    staleTime: Infinity,
  })

  const openSession = openQuery.data ?? null
  const membership = membershipQuery.data ?? null
  const isPaused = membership?.subscription_status === 'paused'
  const hasLiveAccess =
    membership?.subscription_status === 'active' &&
    membership.start_date <= todayIsoDate() &&
    membership.end_date >= todayIsoDate()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['my-open-session'] })
    queryClient.invalidateQueries({ queryKey: ['my-attendance'] })
    queryClient.invalidateQueries({ queryKey: ['my-membership-state'] })
  }

  const checkInMutation = useMutation({
    mutationFn: selfCheckIn,
    onSuccess: () => {
      invalidate()
      void refresh()
      toast.success('Checked in', 'Have a great session!')
      setError(null)
    },
    onError: (mutationError) => setError(attendanceErrorMessage(mutationError)),
  })

  const checkOutMutation = useMutation({
    mutationFn: selfCheckOut,
    onSuccess: () => {
      invalidate()
      toast.success('Checked out', 'Session recorded.')
      setError(null)
    },
    onError: (mutationError) => setError(attendanceErrorMessage(mutationError)),
  })

  const pending = checkInMutation.isPending || checkOutMutation.isPending
  const recent = recentQuery.data?.rows ?? []

  return (
    <div className="relative min-h-dvh px-4 py-6 text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="ambient-orb -left-40 -top-48 size-[32rem] bg-brand-500/20" />
        <div className="ambient-orb -right-40 top-1/3 size-[28rem] bg-violet-500/15" />
        <div className="ambient-orb -bottom-48 left-1/3 size-[28rem] bg-teal-500/10" />
      </div>
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/app"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-300 hover:text-white"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Dashboard
          </Link>
          {profile && <MembershipStatusBadge status={profile.membership_status} />}
        </div>

        <div className="text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <QrCode className="size-7" aria-hidden />
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Gym check-in</h1>
          <p className="mt-1 text-sm text-slate-400">
            Show your QR code to gym staff, or time in yourself below.
          </p>
        </div>

        <Card className="mt-6">
          <CardBody className="text-center">
            {clientDetail?.qr_token ? (
              <>
                <div className="mx-auto inline-flex rounded-2xl bg-white p-4">
                  <QRCodeSVG
                    value={clientDetail.qr_token}
                    size={196}
                    level="M"
                    marginSize={0}
                    title="Your member QR code"
                  />
                </div>
                <p className="mt-3 font-mono text-xs text-slate-400">
                  {clientDetail.member_code ?? clientDetail.qr_token}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Keep this code private — it identifies your membership.
                </p>
              </>
            ) : (
              <Alert tone="warning" title="QR code unavailable">
                Your member profile is still being set up. Ask the gym admin for help.
              </Alert>
            )}
          </CardBody>
        </Card>

        <div className="glass-panel mt-5 rounded-2xl p-5">
          {openSession ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-400">
                    Currently in the gym
                  </p>
                  <p className="mt-1 text-lg font-semibold">
                    Checked in at {formatTimeIn(openSession.time_in, timezoneQuery.data)}
                  </p>
                </div>
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                  <Clock className="size-5" aria-hidden />
                </span>
              </div>
              <Button
                className="mt-4 w-full"
                variant="danger"
                size="lg"
                onClick={() => checkOutMutation.mutate()}
                loading={checkOutMutation.isPending}
                disabled={pending}
              >
                <LogOut className="size-4" aria-hidden />
                Time out
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                Not checked in
              </p>
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                {hasLiveAccess
                  ? 'Your membership is active. Time in when you arrive.'
                  : isPaused
                    ? 'Your membership is paused. Ask the gym admin to resume it.'
                    : membership
                      ? 'Your membership is not currently active. Please renew at the front desk.'
                      : 'No membership yet. Ask the gym admin to assign a plan.'}
              </p>
              <Button
                className="mt-4 w-full"
                size="lg"
                onClick={() => checkInMutation.mutate()}
                loading={checkInMutation.isPending}
                disabled={pending || !hasLiveAccess}
              >
                <LogIn className="size-4" aria-hidden />
                Time in
              </Button>
            </>
          )}

          {membership && (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
              <span>
                {formatDate(membership.start_date)} → {formatDate(membership.end_date)}
              </span>
              <SubscriptionStatusBadge status={membership.subscription_status} />
            </div>
          )}

          {error && (
            <div className="mt-4">
              <Alert tone="error">{error}</Alert>
            </div>
          )}
        </div>

        <div className="mt-6">
          <h2 className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Recent visits
          </h2>
          {recentQuery.isLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-xl bg-white/[0.06]" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="glass-panel mt-3 rounded-xl px-4 py-4 text-sm text-slate-400">
              No visits recorded yet.
            </p>
          ) : (
            <ul className="glass-panel mt-3 divide-y divide-white/[0.07] overflow-hidden rounded-2xl">
              {recent.map((visit) => (
                <li
                  key={visit.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="text-slate-200">{formatDate(visit.time_in)}</p>
                    <p className="text-xs text-slate-500">
                      {formatTimeIn(visit.time_in, timezoneQuery.data)} →{' '}
                      {visit.time_out
                        ? formatTimeIn(visit.time_out, timezoneQuery.data)
                        : 'open'}
                    </p>
                  </div>
                  <div className="text-right">
                    {visit.time_out ? (
                      <DurationLabel
                        minutes={Math.round(
                          (new Date(visit.time_out).getTime() -
                            new Date(visit.time_in).getTime()) /
                            60_000,
                        )}
                      />
                    ) : (
                      <span className="text-xs font-medium text-emerald-400">In gym</span>
                    )}
                    {visit.expired_during_session && (
                      <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-amber-400">
                        <ShieldAlert className="size-3" aria-hidden />
                        Expired
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

function DurationLabel({ minutes }: { minutes: number }) {
  return <span className="text-xs text-slate-400">{formatDuration(minutes)}</span>
}
