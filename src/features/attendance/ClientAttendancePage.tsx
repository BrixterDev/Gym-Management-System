import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, QrCode } from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/AuthProvider'
import {
  formatDate,
  formatDateTimeIn,
  formatDuration,
  formatTimeIn,
  pluralize,
} from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import {
  attendanceErrorMessage,
  getGymTimezone,
  listMyAttendance,
} from './attendanceApi'

function monthStartIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
}

export function ClientAttendancePage() {
  const { profile } = useAuth()
  const [page, setPage] = useState(1)
  const pageSize = 12

  const timezoneQuery = useQuery({
    queryKey: ['gym-timezone'],
    queryFn: getGymTimezone,
    staleTime: Infinity,
  })
  const timeZone = timezoneQuery.data

  const query = useQuery({
    queryKey: ['my-attendance', 'page', page],
    queryFn: () => listMyAttendance({ page, pageSize }),
    enabled: Boolean(profile?.id),
    placeholderData: keepPreviousData,
  })

  const monthQuery = useQuery({
    queryKey: ['my-attendance', 'month-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('attendance')
        .select('id', { count: 'exact', head: true })
        .gte('time_in', monthStartIso())
      if (error) throw error
      return count ?? 0
    },
    enabled: Boolean(profile?.id),
  })

  const rows = query.data?.rows ?? []
  const count = query.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const lastVisit = rows[0] ?? null

  return (
    <div>
      <PageHeader
        title="My Attendance"
        description="Every gym visit recorded against your membership."
        action={
          <Link
            to="/checkin"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700"
          >
            <QrCode className="size-4" aria-hidden />
            Check in
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <Card>
          <CardBody className="py-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <CalendarDays className="size-4" aria-hidden />
              Total visits
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">{count}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
              <Clock className="size-4" aria-hidden />
              This month
            </p>
            <p className="mt-1 text-2xl font-semibold text-slate-100">
              {monthQuery.isLoading ? '…' : (monthQuery.data ?? 0)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              Last visit
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-100">
              {lastVisit ? formatDateTimeIn(lastVisit.time_in, timeZone) : '—'}
            </p>
            {lastVisit && (
              <p className="mt-0.5 text-xs text-slate-400">
                {lastVisit.time_out
                  ? formatDuration(
                      Math.round(
                        (new Date(lastVisit.time_out).getTime() -
                          new Date(lastVisit.time_in).getTime()) /
                          60_000,
                      ),
                    )
                  : 'Currently in gym'}
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load attendance">
            {attendanceErrorMessage(query.error)}
          </Alert>
        </div>
      )}

      <div className="glass-panel rounded-2xl">
        {query.isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-white/[0.03]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<QrCode className="size-8" aria-hidden />}
            title="No visits yet"
            description="Your check-ins will appear here after your first gym visit."
            action={
              <Link
                to="/checkin"
                className="inline-flex h-9 items-center justify-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
              >
                Open check-in
              </Link>
            }
          />
        ) : (
          <>
            <div className="hidden min-w-0 sm:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">Date</th>
                    <th scope="col" className="px-4 py-3 font-medium">Time in</th>
                    <th scope="col" className="px-4 py-3 font-medium">Time out</th>
                    <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {rows.map((visit) => (
                    <tr key={visit.id} className="hover:bg-white/[0.04]">
                      <td className="px-4 py-3 text-slate-200">{formatDate(visit.time_in)}</td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {formatTimeIn(visit.time_in, timeZone)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {visit.time_out ? formatTimeIn(visit.time_out, timeZone) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-300">
                        {formatDuration(
                          visit.time_out
                            ? Math.round(
                                (new Date(visit.time_out).getTime() -
                                  new Date(visit.time_in).getTime()) /
                                  60_000,
                              )
                            : null,
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <VisitBadge visit={visit} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-white/[0.07] sm:hidden">
              {rows.map((visit) => (
                <li key={visit.id} className="flex items-start justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-slate-100">
                      {formatDate(visit.time_in)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatTimeIn(visit.time_in, timeZone)} →{' '}
                      {visit.time_out ? formatTimeIn(visit.time_out, timeZone) : 'open'}
                    </p>
                  </div>
                  <VisitBadge visit={visit} />
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-white/[0.07] px-4 py-3">
            <p className="text-xs text-slate-400">{pluralize(count, 'visit')}</p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                Previous
              </Button>
              <span className="whitespace-nowrap text-xs text-slate-400">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-slate-400">
        Times are recorded by the server. Ask the gym admin if a visit needs correcting.
      </p>
    </div>
  )
}

function VisitBadge({ visit }: { visit: { time_out: string | null; expired_during_session: boolean } }) {
  if (!visit.time_out) {
    return (
      <Badge tone="green" dot>
        In gym
      </Badge>
    )
  }
  if (visit.expired_during_session) {
    return (
      <Badge tone="amber" dot>
        Expired
      </Badge>
    )
  }
  return (
    <Badge tone="slate" dot>
      Completed
    </Badge>
  )
}
