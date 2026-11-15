import { useDeferredValue, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  LogOut,
  Pencil,
  QrCode,
  ScanLine,
  Search,
  Users,
} from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/Modal'
import { useToast } from '@/components/ui/Toast'
import {
  formatDateTimeIn,
  formatDuration,
  formatTimeIn,
  pluralize,
} from '@/lib/utils'
import type { AttendanceDirectoryRow } from '@/types/database'
import {
  attendanceErrorMessage,
  closeAttendance,
  defaultAttendanceFilters,
  getAttendanceStats,
  getGymTimezone,
  listAttendance,
  type AttendanceFilters,
} from './attendanceApi'
import { MemberScannerDialog } from './MemberScannerDialog'
import { AttendanceEditDialog } from './AttendanceEditDialog'

export function AttendancePage() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<AttendanceFilters>(defaultAttendanceFilters)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<AttendanceDirectoryRow | null>(null)
  const [closeTarget, setCloseTarget] = useState<AttendanceDirectoryRow | null>(null)
  const deferredSearch = useDeferredValue(filters.search)

  const statsQuery = useQuery({
    queryKey: ['attendance-stats'],
    queryFn: getAttendanceStats,
  })

  const timezoneQuery = useQuery({
    queryKey: ['gym-timezone'],
    queryFn: getGymTimezone,
    staleTime: Infinity,
  })
  const timeZone = timezoneQuery.data

  const today = statsQuery.data?.today ?? ''

  const query = useQuery({
    queryKey: ['attendance', { ...filters, search: deferredSearch, today }],
    queryFn: () => listAttendance({ ...filters, search: deferredSearch }, today),
    enabled: Boolean(today),
    placeholderData: keepPreviousData,
  })

  const rows = query.data?.rows ?? []
  const count = query.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / filters.pageSize))

  useEffect(() => {
    if (filters.page > totalPages) {
      setFilters((current) => ({ ...current, page: totalPages }))
    }
  }, [filters.page, totalPages])

  const update = (patch: Partial<AttendanceFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] })
    queryClient.invalidateQueries({ queryKey: ['attendance-stats'] })
    queryClient.invalidateQueries({ queryKey: ['my-attendance'] })
    queryClient.invalidateQueries({ queryKey: ['my-open-session'] })
  }

  const closeMutation = useMutation({
    mutationFn: (row: AttendanceDirectoryRow) => closeAttendance(row.id),
    onSuccess: () => {
      invalidate()
      toast.success('Member checked out')
      setCloseTarget(null)
    },
    onError: (error) => {
      toast.error('Could not check out member', attendanceErrorMessage(error))
      setCloseTarget(null)
    },
  })

  const stats = statsQuery.data
  const hasActiveFilters = Boolean(filters.search) || filters.view !== 'all'

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Scan member QR codes, monitor sessions, and correct records."
        action={
          <Button onClick={() => setScannerOpen(true)}>
            <ScanLine className="size-4" aria-hidden />
            Scan member
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Checked in today"
          value={statsQuery.isLoading ? '…' : String(stats?.today_visits ?? 0)}
          icon={<CalendarDays className="size-4" aria-hidden />}
        />
        <StatCard
          label="Currently in gym"
          value={statsQuery.isLoading ? '…' : String(stats?.currently_in ?? 0)}
          icon={<Users className="size-4" aria-hidden />}
          tone="green"
        />
        <StatCard
          label="Visits this week"
          value={statsQuery.isLoading ? '…' : String(stats?.week_visits ?? 0)}
          icon={<QrCode className="size-4" aria-hidden />}
        />
        <StatCard
          label="Avg. session today"
          value={statsQuery.isLoading ? '…' : formatDuration(stats?.avg_minutes_today ?? null)}
          icon={<Clock className="size-4" aria-hidden />}
        />
      </div>

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load attendance">
            {attendanceErrorMessage(query.error)}
          </Alert>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2">
          <Input
            type="search"
            placeholder="Search member, email, or code"
            aria-label="Search attendance"
            leadingIcon={<Search className="size-4" />}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
          <Select
            aria-label="Filter attendance"
            value={filters.view}
            onChange={(event) => update({ view: event.target.value as AttendanceFilters['view'] })}
          >
            <option value="all">All visits</option>
            <option value="in-gym">Currently in gym</option>
            <option value="today">Today</option>
            <option value="week">Last 7 days</option>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="space-y-3 p-4" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-50" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<QrCode className="size-8" aria-hidden />}
            title="No attendance records"
            description={
              hasActiveFilters
                ? 'Try a different search or filter.'
                : 'Scan a member QR code to record the first visit.'
            }
            action={
              hasActiveFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(defaultAttendanceFilters)}
                >
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setScannerOpen(true)}>
                  <ScanLine className="size-3.5" aria-hidden />
                  Scan member
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
                    <th scope="col" className="px-4 py-3 font-medium">Member</th>
                    <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Time in</th>
                    <th scope="col" className="px-4 py-3 font-medium">Time out</th>
                    <th scope="col" className="px-4 py-3 font-medium">Duration</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
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
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.plan_name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDateTimeIn(row.time_in, timeZone)}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.time_out ? formatTimeIn(row.time_out, timeZone) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {formatDuration(row.duration_minutes)}
                      </td>
                      <td className="px-4 py-3">
                        <VisitStatusBadge row={row} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {row.visit_state === 'open' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setCloseTarget(row)}
                            >
                              <LogOut className="size-3.5" aria-hidden />
                              Check out
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setEditTarget(row)}>
                            <Pencil className="size-3.5" aria-hidden />
                            Correct
                          </Button>
                        </div>
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
                      <p className="truncate text-xs text-slate-500">
                        {row.member_code ?? row.email}
                      </p>
                    </div>
                    <VisitStatusBadge row={row} />
                  </div>
                  <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-slate-500">
                    <div>
                      <dt className="inline">In: </dt>
                      <dd className="inline text-slate-700">
                        {formatDateTimeIn(row.time_in, timeZone)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Out: </dt>
                      <dd className="inline text-slate-700">
                        {row.time_out ? formatTimeIn(row.time_out, timeZone) : '—'}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Duration: </dt>
                      <dd className="inline text-slate-700">
                        {formatDuration(row.duration_minutes)}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline">Plan: </dt>
                      <dd className="inline text-slate-700">{row.plan_name ?? '—'}</dd>
                    </div>
                  </dl>
                  <div className="mt-3 flex flex-wrap justify-end gap-1.5">
                    {row.visit_state === 'open' && (
                      <Button variant="outline" size="sm" onClick={() => setCloseTarget(row)}>
                        <LogOut className="size-3.5" aria-hidden />
                        Check out
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setEditTarget(row)}>
                      <Pencil className="size-3.5" aria-hidden />
                      Correct
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
            <p className="text-xs text-slate-500">{pluralize(count, 'visit')}</p>
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

      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        Check-in validates the member's account and live subscription on the server. Paused,
        expired, and cancelled memberships are rejected. Open sessions are flagged if the
        membership lapses before check-out.
      </p>

      <MemberScannerDialog
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        timeZone={timeZone}
      />

      <AttendanceEditDialog
        open={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
        row={editTarget}
      />

      <ConfirmDialog
        open={Boolean(closeTarget)}
        onClose={() => setCloseTarget(null)}
        onConfirm={() => closeTarget && closeMutation.mutate(closeTarget)}
        title="Check out member"
        description={
          closeTarget
            ? `Close the open session for ${closeTarget.display_name ?? closeTarget.email}? The time out is recorded now.`
            : ''
        }
        confirmLabel="Check out"
        loading={closeMutation.isPending}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
  tone = 'slate',
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone?: 'slate' | 'green'
}) {
  return (
    <Card>
      <CardBody className="py-3.5">
        <div className="flex items-center gap-2 text-slate-400">
          {icon}
          <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
        </div>
        <p
          className={`mt-1 text-xl font-semibold ${
            tone === 'green' ? 'text-emerald-700' : 'text-slate-900'
          }`}
        >
          {value}
        </p>
      </CardBody>
    </Card>
  )
}

function VisitStatusBadge({ row }: { row: AttendanceDirectoryRow }) {
  if (row.visit_state === 'open') {
    return (
      <Badge tone="green" dot>
        In gym
      </Badge>
    )
  }
  if (row.expired_during_session) {
    return (
      <Badge tone="amber" dot>
        Expired during session
      </Badge>
    )
  }
  return (
    <Badge tone="slate" dot>
      Completed
    </Badge>
  )
}
