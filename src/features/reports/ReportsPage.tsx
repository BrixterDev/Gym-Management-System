import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarCheck,
  Download,
  Minus,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import { formatCurrency, formatDate, pluralize } from '@/lib/utils'
import type { PaymentMethod } from '@/types/database'
import {
  exportAttendance,
  exportMemberships,
  exportPayments,
  getAttendanceDaily,
  getPaymentMethodBreakdown,
  getPlanPerformance,
  getReportSummary,
  getRevenueDaily,
  presetRange,
  reportErrorMessage,
  validateRange,
  type DateRange,
  type RangePreset,
} from './reportsApi'
import { DateRangeControls } from './DateRangeControls'
import { csvFilename, downloadCsv, toCsv } from './csv'

const methodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
}

const methodColors: Record<PaymentMethod, string> = {
  cash: '#34d399',
  gcash: '#38bdf8',
  card: '#a78bfa',
  bank_transfer: '#fbbf24',
}

function shortDate(value: string) {
  return formatDate(value, { month: 'short', day: 'numeric' })
}

function compactCurrency(value: number) {
  if (Math.abs(value) >= 1000) return `₱${Math.round(value / 1000)}k`
  return `₱${value}`
}

type ExportKind = 'payments' | 'attendance' | 'memberships'

export function ReportsPage() {
  const toast = useToast()
  const [preset, setPreset] = useState<RangePreset>('30d')
  const [range, setRange] = useState<DateRange>(() => presetRange('30d'))
  const [exporting, setExporting] = useState<ExportKind | null>(null)

  const rangeError = validateRange(range)
  const enabled = !rangeError

  const summaryQuery = useQuery({
    queryKey: ['report-summary', range],
    queryFn: () => getReportSummary(range),
    enabled,
  })
  const revenueQuery = useQuery({
    queryKey: ['report-revenue-daily', range],
    queryFn: () => getRevenueDaily(range),
    enabled,
  })
  const attendanceQuery = useQuery({
    queryKey: ['report-attendance-daily', range],
    queryFn: () => getAttendanceDaily(range),
    enabled,
  })
  const methodQuery = useQuery({
    queryKey: ['report-payment-methods', range],
    queryFn: () => getPaymentMethodBreakdown(range),
    enabled,
  })
  const planQuery = useQuery({
    queryKey: ['report-plan-performance', range],
    queryFn: () => getPlanPerformance(range),
    enabled,
  })

  const summary = summaryQuery.data
  const revenue = revenueQuery.data ?? []
  const attendance = attendanceQuery.data ?? []
  const methods = methodQuery.data ?? []
  const plans = planQuery.data ?? []

  const loading =
    enabled &&
    (summaryQuery.isLoading ||
      revenueQuery.isLoading ||
      attendanceQuery.isLoading ||
      methodQuery.isLoading ||
      planQuery.isLoading)

  const error =
    summaryQuery.error ??
    revenueQuery.error ??
    attendanceQuery.error ??
    methodQuery.error ??
    planQuery.error

  const handleRange = (nextPreset: RangePreset, nextRange: DateRange) => {
    setPreset(nextPreset)
    setRange(nextRange)
  }

  const reset = () => {
    setPreset('30d')
    setRange(presetRange('30d'))
  }

  const runExport = async (kind: ExportKind) => {
    if (rangeError) {
      toast.error('Invalid date range', rangeError)
      return
    }
    setExporting(kind)
    try {
      if (kind === 'payments') {
        const rows = await exportPayments(range)
        if (rows.length === 0) {
          toast.info('Nothing to export', 'No payments were recorded in this period.')
          return
        }
        const csv = toCsv(
          [
            { label: 'Paid on', value: (row) => row.paid_on },
            { label: 'Member', value: (row) => row.display_name ?? '—' },
            { label: 'Member code', value: (row) => row.member_code ?? '' },
            { label: 'Email', value: (row) => row.email },
            { label: 'Plan', value: (row) => row.plan_name },
            { label: 'Amount', value: (row) => row.amount },
            { label: 'Method', value: (row) => methodLabels[row.payment_method] },
            { label: 'Status', value: (row) => row.payment_status },
            { label: 'Reference', value: (row) => row.reference_number ?? '' },
          ],
          rows,
        )
        downloadCsv(csvFilename('payments', range.from, range.to), csv)
        toast.success('Payments exported', pluralize(rows.length, 'row'))
      } else if (kind === 'attendance') {
        const rows = await exportAttendance(range)
        if (rows.length === 0) {
          toast.info('Nothing to export', 'No visits were recorded in this period.')
          return
        }
        const csv = toCsv(
          [
            { label: 'Visit date', value: (row) => row.visit_date },
            { label: 'Member', value: (row) => row.display_name ?? '—' },
            { label: 'Member code', value: (row) => row.member_code ?? '' },
            { label: 'Email', value: (row) => row.email },
            { label: 'Time in', value: (row) => row.time_in },
            { label: 'Time out', value: (row) => row.time_out ?? '' },
            { label: 'Duration (min)', value: (row) => row.duration_minutes ?? '' },
            { label: 'State', value: (row) => row.visit_state },
            { label: 'Plan', value: (row) => row.plan_name ?? '' },
          ],
          rows,
        )
        downloadCsv(csvFilename('attendance', range.from, range.to), csv)
        toast.success('Attendance exported', pluralize(rows.length, 'row'))
      } else {
        const rows = await exportMemberships(range)
        if (rows.length === 0) {
          toast.info('Nothing to export', 'No memberships started in this period.')
          return
        }
        const csv = toCsv(
          [
            { label: 'Member', value: (row) => row.display_name ?? '—' },
            { label: 'Member code', value: (row) => row.member_code ?? '' },
            { label: 'Email', value: (row) => row.email },
            { label: 'Plan', value: (row) => row.plan_name },
            { label: 'Start date', value: (row) => row.start_date },
            { label: 'End date', value: (row) => row.end_date },
            { label: 'Status', value: (row) => row.subscription_status },
            { label: 'Price', value: (row) => row.price_at_assignment },
          ],
          rows,
        )
        downloadCsv(csvFilename('memberships', range.from, range.to), csv)
        toast.success('Memberships exported', pluralize(rows.length, 'row'))
      }
    } catch (exportError) {
      toast.error('Export failed', reportErrorMessage(exportError))
    } finally {
      setExporting(null)
    }
  }

  const revenueTotal = revenue.reduce((sum, row) => sum + Number(row.paid_total), 0)
  const visitsTotal = attendance.reduce((sum, row) => sum + row.visits, 0)
  const hasRevenue = revenue.some(
    (row) => Number(row.paid_total) > 0 || Number(row.pending_total) > 0,
  )
  const hasAttendance = attendance.some((row) => row.visits > 0)
  const hasMethods = methods.some((row) => Number(row.total_amount) > 0)

  return (
    <div>
      <PageHeader
        title="Reports & analytics"
        description="Revenue, attendance, and membership performance for the selected period."
        action={<Badge tone="blue">Administrator</Badge>}
      />

      <DateRangeControls
        preset={preset}
        range={range}
        onChange={handleRange}
        onReset={reset}
      />

      {error && (
        <div className="mt-4">
          <Alert tone="error" title="Could not load reports">
            {reportErrorMessage(error)}
          </Alert>
        </div>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {loading || !summary ? (
          Array.from({ length: 4 }).map((_, index) => <KpiSkeleton key={index} />)
        ) : (
          <>
            <KpiCard
              label="Revenue collected"
              value={formatCurrency(summary.revenue_paid)}
              hint={
                <Delta
                  current={Number(summary.revenue_paid)}
                  previous={Number(summary.prev_revenue_paid)}
                  suffix="vs previous period"
                />
              }
              icon={<Wallet className="size-4" aria-hidden />}
            />
            <KpiCard
              label="Visits"
              value={String(summary.visits)}
              hint={
                <Delta
                  current={summary.visits}
                  previous={summary.prev_visits}
                  suffix="vs previous period"
                />
              }
              icon={<CalendarCheck className="size-4" aria-hidden />}
            />
            <KpiCard
              label="New members"
              value={String(summary.new_members)}
              hint={
                <Delta
                  current={summary.new_members}
                  previous={summary.prev_new_members}
                  suffix="vs previous period"
                />
              }
              icon={<UserPlus className="size-4" aria-hidden />}
            />
            <KpiCard
              label="Active members"
              value={String(summary.active_members)}
              hint={
                <span className="text-slate-400">
                  {summary.expiring_soon > 0
                    ? `${summary.expiring_soon} expiring within 7 days`
                    : 'None expiring this week'}
                </span>
              }
              icon={<Users className="size-4" aria-hidden />}
            />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue trend"
            description={`${formatCurrency(revenueTotal)} collected in this period`}
            action={
              summary && Number(summary.revenue_pending) > 0 ? (
                <Badge tone="amber">
                  {formatCurrency(summary.revenue_pending)} pending
                </Badge>
              ) : undefined
            }
          />
          <CardBody>
            {loading ? (
              <ChartSkeleton />
            ) : !hasRevenue ? (
              <EmptyState
                icon={<Wallet className="size-8" aria-hidden />}
                title="No payments in this period"
                description="Record a payment or choose a different date range to see revenue."
              />
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenue} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                    <defs>
                      <linearGradient id="paidFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#38bdf8" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="#38bdf8" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pendingFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                    <XAxis
                      dataKey="report_date"
                      tickFormatter={shortDate}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={compactCurrency}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      axisLine={false}
                      tickLine={false}
                      width={52}
                    />
                    <Tooltip
                      labelFormatter={(value) => formatDate(String(value))}
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        name === 'paid_total' ? 'Collected' : 'Pending',
                      ]}
                      contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.25)', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }}
                    />
                    <Area
                      type="monotone"
                      dataKey="paid_total"
                      stroke="#38bdf8"
                      strokeWidth={2}
                      fill="url(#paidFill)"
                    />
                    <Area
                      type="monotone"
                      dataKey="pending_total"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      fill="url(#pendingFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Payment methods" description="Share of collected revenue" />
          <CardBody>
            {loading ? (
              <ChartSkeleton />
            ) : !hasMethods ? (
              <EmptyState
                icon={<BarChart3 className="size-8" aria-hidden />}
                title="No collected payments"
                description="Method breakdown appears once payments are marked paid."
              />
            ) : (
              <>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={methods}
                      layout="vertical"
                      margin={{ top: 0, right: 12, bottom: 0, left: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" horizontal={false} />
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="payment_method"
                        tickFormatter={(value: PaymentMethod) => methodLabels[value]}
                        tick={{ fontSize: 11, fill: '#94a3b8' }}
                        axisLine={false}
                        tickLine={false}
                        width={84}
                      />
                      <Tooltip
                        formatter={(value) => [formatCurrency(Number(value)), 'Collected']}
                        labelFormatter={(value) =>
                          methodLabels[value as PaymentMethod] ?? String(value)
                        }
                        contentStyle={{
                          borderRadius: 12,
                          border: '1px solid rgba(148,163,184,0.25)',
                          background: '#0f172a',
                          color: '#e2e8f0',
                          fontSize: 12,
                        }}
                      />
                      <Bar dataKey="total_amount" radius={[0, 4, 4, 0]}>
                        {methods.map((row) => (
                          <Cell
                            key={row.payment_method}
                            fill={methodColors[row.payment_method]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-3 space-y-1.5 border-t border-white/[0.07] pt-3 text-xs">
                  {methods.map((row) => (
                    <li key={row.payment_method} className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-slate-300">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: methodColors[row.payment_method] }}
                          aria-hidden
                        />
                        {methodLabels[row.payment_method]}
                      </span>
                      <span className="font-medium text-slate-100">
                        {formatCurrency(row.total_amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Attendance trend"
          description={`${visitsTotal} visits by ${summary?.unique_visitors ?? 0} unique members`}
          action={
            summary?.avg_visit_minutes != null ? (
              <Badge tone="slate">Avg {summary.avg_visit_minutes} min</Badge>
            ) : undefined
          }
        />
        <CardBody>
          {loading ? (
            <ChartSkeleton />
          ) : !hasAttendance ? (
            <EmptyState
              icon={<CalendarCheck className="size-8" aria-hidden />}
              title="No visits in this period"
              description="Check members in from the Attendance page to populate this chart."
            />
          ) : (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={attendance} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                  <XAxis
                    dataKey="report_date"
                    tickFormatter={shortDate}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: '#94a3b8' }}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(value, name) => [
                      value,
                      name === 'visits' ? 'Visits' : 'Unique visitors',
                    ]}
                    contentStyle={{ borderRadius: 12, border: '1px solid rgba(148,163,184,0.25)', background: '#0f172a', color: '#e2e8f0', fontSize: 12 }}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 11, paddingTop: 8, color: '#cbd5e1' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    name="Visits"
                    stroke="#2dd4bf"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="unique_visitors"
                    name="Unique visitors"
                    stroke="#a78bfa"
                    strokeWidth={2}
                    strokeDasharray="4 3"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Plan performance" description="Memberships and revenue by plan" />
          <CardBody className="p-0">
            {loading ? (
              <div className="space-y-2 p-5">
                <div className="h-4 w-full animate-pulse rounded bg-white/[0.06]" />
                <div className="h-4 w-5/6 animate-pulse rounded bg-white/[0.03]" />
              </div>
            ) : plans.length === 0 ? (
              <EmptyState
                icon={<BarChart3 className="size-7" aria-hidden />}
                title="No plans to report"
                description="Create membership plans to track performance."
              />
            ) : (
              <div className="min-w-0">
                <table className="w-full table-fixed text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-slate-400">
                      <th scope="col" className="w-[46%] px-4 py-3 font-medium">Plan</th>
                      <th scope="col" className="w-[18%] px-2 py-3 text-right font-medium">New</th>
                      <th scope="col" className="w-[18%] px-2 py-3 text-right font-medium">Active</th>
                      <th scope="col" className="w-[18%] px-4 py-3 text-right font-medium">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.07]">
                    {plans.map((plan) => (
                      <tr key={plan.plan_name} className="hover:bg-white/[0.04]">
                        <td className="truncate px-4 py-3 font-medium text-slate-100" title={plan.plan_name}>{plan.plan_name}</td>
                        <td className="px-2 py-3 text-right text-slate-300">
                          {plan.new_memberships}
                        </td>
                        <td className="px-2 py-3 text-right text-slate-300">
                          {plan.active_members}
                        </td>
                        <td className="truncate px-4 py-3 text-right font-medium text-slate-100">
                          {formatCurrency(plan.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Export data"
            description="Download the selected period as CSV"
          />
          <CardBody className="space-y-3">
            <ExportRow
              title="Payments"
              description="Every payment recorded in the period with member and plan details."
              loading={exporting === 'payments'}
              disabled={Boolean(rangeError) || exporting !== null}
              onExport={() => runExport('payments')}
            />
            <ExportRow
              title="Attendance"
              description="Visit log with time in/out, duration, and membership plan."
              loading={exporting === 'attendance'}
              disabled={Boolean(rangeError) || exporting !== null}
              onExport={() => runExport('attendance')}
            />
            <ExportRow
              title="Memberships"
              description="Subscriptions that started in the period and their status."
              loading={exporting === 'memberships'}
              disabled={Boolean(rangeError) || exporting !== null}
              onExport={() => runExport('memberships')}
            />
            <p className="border-t border-white/[0.07] pt-3 text-xs leading-relaxed text-slate-400">
              Exports are capped at 20,000 rows. Files open directly in Excel or Google Sheets.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function KpiCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint: React.ReactNode
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {icon}
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-100">{value}</p>
        <div className="mt-1 text-xs">{hint}</div>
      </CardBody>
    </Card>
  )
}

function Delta({
  current,
  previous,
  suffix,
}: {
  current: number
  previous: number
  suffix: string
}) {
  if (previous === 0 && current === 0) {
    return <span className="text-slate-400">No activity {suffix}</span>
  }
  if (previous === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-300">
        <ArrowUpRight className="size-3.5" aria-hidden />
        New {suffix}
      </span>
    )
  }
  const percent = Math.round(((current - previous) / previous) * 100)
  if (percent === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-slate-400">
        <Minus className="size-3.5" aria-hidden />
        Flat {suffix}
      </span>
    )
  }
  const up = percent > 0
  return (
    <span
      className={`inline-flex items-center gap-1 ${up ? 'text-emerald-300' : 'text-rose-400'}`}
    >
      {up ? (
        <ArrowUpRight className="size-3.5" aria-hidden />
      ) : (
        <ArrowDownRight className="size-3.5" aria-hidden />
      )}
      {Math.abs(percent)}% {suffix}
    </span>
  )
}

function ExportRow({
  title,
  description,
  loading,
  disabled,
  onExport,
}: {
  title: string
  description: string
  loading: boolean
  disabled: boolean
  onExport: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-white/10 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0"
        loading={loading}
        disabled={disabled && !loading}
        onClick={onExport}
      >
        <Download className="size-3.5" aria-hidden />
        CSV
      </Button>
    </div>
  )
}

function ChartSkeleton() {
  return <div className="h-56 w-full animate-pulse rounded-lg bg-white/[0.03]" />
}

function KpiSkeleton() {
  return (
    <Card>
      <CardBody className="py-4">
        <div className="h-3 w-24 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-3 h-7 w-20 animate-pulse rounded bg-white/[0.06]" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-white/[0.03]" />
      </CardBody>
    </Card>
  )
}
