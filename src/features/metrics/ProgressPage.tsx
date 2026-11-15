import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Activity, ArrowUpRight, Plus, Ruler, Scale, TrendingUp, Weight } from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/features/auth/AuthProvider'
import { bmiCategory, calculateBmi, formatDate } from '@/lib/utils'
import type { BodyMetricsDirectoryRow } from '@/types/database'
import { listMyMetrics, metricErrorMessage } from './metricsApi'
import { MetricFormDialog } from './MetricFormDialog'

export function ProgressPage() {
  const { profile, clientDetail } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BodyMetricsDirectoryRow | null>(null)

  const query = useQuery({
    queryKey: ['metrics', 'mine', profile?.id],
    queryFn: () => listMyMetrics(profile!.id),
    enabled: Boolean(profile?.id),
  })

  const metrics = query.data ?? []
  const latest = metrics[0] ?? null
  const latestBmi =
    latest?.bmi ??
    calculateBmi(latest?.weight_kg, latest?.height_cm ?? clientDetail?.height_cm ?? null)
  const category = bmiCategory(latestBmi)

  const chartData = [...metrics]
    .reverse()
    .map((metric) => ({
      label: formatDate(metric.measured_at, { month: 'short', day: 'numeric' }),
      weight: metric.weight_kg,
      waist: metric.waist_cm,
    }))

  const openAdd = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="My Progress"
        description="Track body measurements and see how you change over time."
        action={
          <Button onClick={openAdd}>
            <Plus className="size-4" aria-hidden />
            Add measurement
          </Button>
        }
      />

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load progress">
            {metricErrorMessage(query.error)}
          </Alert>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Weight"
          value={latest?.weight_kg != null ? `${latest.weight_kg} kg` : '—'}
          icon={<Weight className="size-4" aria-hidden />}
        />
        <StatCard
          label="BMI"
          value={latestBmi != null ? String(latestBmi) : '—'}
          hint={category ?? undefined}
          icon={<Activity className="size-4" aria-hidden />}
        />
        <StatCard
          label="Waist"
          value={latest?.waist_cm != null ? `${latest.waist_cm} cm` : '—'}
          icon={<Ruler className="size-4" aria-hidden />}
        />
        <StatCard
          label="Height"
          value={
            (latest?.height_cm ?? clientDetail?.height_cm) != null
              ? `${latest?.height_cm ?? clientDetail?.height_cm} cm`
              : '—'
          }
          icon={<Scale className="size-4" aria-hidden />}
        />
      </div>

      {query.isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index}>
              <CardBody>
                <div className="h-52 animate-pulse rounded-lg bg-slate-50" />
              </CardBody>
            </Card>
          ))}
        </div>
      ) : metrics.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<TrendingUp className="size-8" aria-hidden />}
              title="No measurements yet"
              description="Record your weight, height, and waist to start seeing your progress. The gym can also add measurements for you."
              action={
                <Button size="sm" onClick={openAdd}>
                  <Plus className="size-3.5" aria-hidden />
                  Add measurement
                </Button>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendCard
              title="Weight trend"
              description="Kilograms over time"
              data={chartData}
              dataKey="weight"
              color="#0284c7"
              unit=" kg"
            />
            <TrendCard
              title="Waist trend"
              description="Centimetres over time"
              data={chartData}
              dataKey="waist"
              color="#0d9488"
              unit=" cm"
            />
          </div>

          <Card className="mt-4">
            <CardHeader
              title="Measurement history"
              description={`${metrics.length} measurement${metrics.length === 1 ? '' : 's'}`}
              action={
                <Button variant="outline" size="sm" onClick={openAdd}>
                  <Plus className="size-3.5" aria-hidden />
                  Add
                </Button>
              }
            />
            <CardBody className="p-0">
              <div className="hidden overflow-x-auto sm:block">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                      <th scope="col" className="px-5 py-3 font-medium">Date</th>
                      <th scope="col" className="px-4 py-3 font-medium">Weight</th>
                      <th scope="col" className="px-4 py-3 font-medium">Height</th>
                      <th scope="col" className="px-4 py-3 font-medium">Waist</th>
                      <th scope="col" className="px-4 py-3 font-medium">BMI</th>
                      <th scope="col" className="px-4 py-3 font-medium">Source</th>
                      <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.map((metric) => {
                      const isOwn = metric.recorded_by === profile?.id
                      const bmi =
                        metric.bmi ??
                        calculateBmi(
                          metric.weight_kg,
                          metric.height_cm ?? clientDetail?.height_cm ?? null,
                        )
                      return (
                        <tr key={metric.id} className="hover:bg-slate-50/60">
                          <td className="px-5 py-3 text-slate-800">
                            {formatDate(metric.measured_at)}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {metric.weight_kg != null ? `${metric.weight_kg} kg` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {metric.height_cm != null ? `${metric.height_cm} cm` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {metric.waist_cm != null ? `${metric.waist_cm} cm` : '—'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">{bmi ?? '—'}</td>
                          <td className="px-4 py-3">
                            <Badge tone={isOwn ? 'blue' : 'violet'} dot>
                              {isOwn ? 'Self' : 'Gym'}
                            </Badge>
                          </td>
                          <td className="px-5 py-3 text-right">
                            {isOwn ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditing(metric)
                                  setDialogOpen(true)
                                }}
                              >
                                Edit
                              </Button>
                            ) : (
                              <span className="text-xs text-slate-400">Read-only</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="divide-y divide-slate-100 sm:hidden">
                {metrics.map((metric) => {
                  const isOwn = metric.recorded_by === profile?.id
                  return (
                    <li key={metric.id} className="flex items-start justify-between gap-3 px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {formatDate(metric.measured_at)}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {metric.weight_kg != null ? `${metric.weight_kg} kg` : '—'} ·{' '}
                          {metric.waist_cm != null ? `${metric.waist_cm} cm waist` : 'no waist'}
                        </p>
                        <Badge tone={isOwn ? 'blue' : 'violet'} dot>
                          {isOwn ? 'Self' : 'Gym'}
                        </Badge>
                      </div>
                      {isOwn && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditing(metric)
                            setDialogOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </CardBody>
          </Card>
        </>
      )}

      <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-slate-500">
        <ArrowUpRight className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Measurements recorded by gym staff are read-only to you. Ask the front desk if one needs
        correcting.
      </p>

      <MetricFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        clientId={profile?.id ?? ''}
        metric={editing}
        defaultHeight={clientDetail?.height_cm ?? null}
        recordedBySelf={editing ? editing.recorded_by === profile?.id : true}
        scope="self"
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string
  hint?: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardBody className="py-4">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          {icon}
          {label}
        </p>
        <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-brand-700">{hint}</p>}
      </CardBody>
    </Card>
  )
}

function TrendCard({
  title,
  description,
  data,
  dataKey,
  color,
  unit,
}: {
  title: string
  description: string
  data: { label: string; weight: number | null; waist: number | null }[]
  dataKey: 'weight' | 'waist'
  color: string
  unit: string
}) {
  const points = data.filter((item) => item[dataKey] != null)
  return (
    <Card>
      <CardHeader title={title} description={description} />
      <CardBody>
        {points.length < 2 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-2 text-center">
            <TrendingUp className="size-8 text-slate-300" aria-hidden />
            <p className="text-sm text-slate-500">
              Add at least two {dataKey} measurements to see a trend.
            </p>
          </div>
        ) : (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  axisLine={false}
                  tickLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid #e2e8f0',
                    fontSize: 12,
                  }}
                />
                <Line
                  type="monotone"
                  dataKey={dataKey}
                  name={dataKey === 'weight' ? 'Weight' : 'Waist'}
                  unit={unit}
                  stroke={color}
                  strokeWidth={2}
                  dot={{ r: 3, fill: color }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardBody>
    </Card>
  )
}
