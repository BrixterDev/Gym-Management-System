import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { calculateBmi } from '@/lib/utils'
import type { BodyMetricsDirectoryRow } from '@/types/database'
import {
  createMetric,
  deleteMetric,
  metricErrorMessage,
  updateMetric,
  type MetricInput,
} from './metricsApi'

const optionalNumber = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || (!Number.isNaN(Number(value)) && Number(value) >= min && Number(value) <= max),
      `${label} must be between ${min} and ${max}`,
    )

const schema = z
  .object({
    measured_at: z.string().min(1, 'Choose when this was measured'),
    weight_kg: optionalNumber(1, 499, 'Weight'),
    height_cm: optionalNumber(30, 349, 'Height'),
    waist_cm: optionalNumber(1, 499, 'Waist'),
    notes: z.string().trim().max(1000, 'Keep notes under 1000 characters').optional(),
  })
  .refine(
    (values) => Boolean(values.weight_kg || values.height_cm || values.waist_cm),
    { message: 'Enter at least one measurement', path: ['weight_kg'] },
  )

type FormValues = z.infer<typeof schema>

function toLocalInput(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function nowLocalInput() {
  return toLocalInput(new Date().toISOString())
}

export function MetricFormDialog({
  open,
  onClose,
  clientId,
  metric,
  defaultHeight,
  recordedBySelf,
  scope,
}: {
  open: boolean
  onClose: () => void
  clientId: string
  metric: BodyMetricsDirectoryRow | null
  defaultHeight?: number | null
  recordedBySelf?: boolean
  scope: 'self' | 'admin'
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      measured_at: nowLocalInput(),
      weight_kg: '',
      height_cm: '',
      waist_cm: '',
      notes: '',
    },
  })

  useEffect(() => {
    if (!open) return
    reset({
      measured_at: metric ? toLocalInput(metric.measured_at) : nowLocalInput(),
      weight_kg: metric?.weight_kg != null ? String(metric.weight_kg) : '',
      height_cm:
        metric?.height_cm != null
          ? String(metric.height_cm)
          : defaultHeight != null
            ? String(defaultHeight)
            : '',
      waist_cm: metric?.waist_cm != null ? String(metric.waist_cm) : '',
      notes: metric?.notes ?? '',
    })
    setFormError(null)
    setConfirmDelete(false)
  }, [open, metric, defaultHeight, reset])

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] })
    queryClient.invalidateQueries({ queryKey: ['client-metrics'] })
    queryClient.invalidateQueries({ queryKey: ['client', clientId] })
  }

  const saveMutation = useMutation({
    mutationFn: (values: FormValues) => {
      const input: MetricInput = {
        client_id: clientId,
        measured_at: new Date(values.measured_at).toISOString(),
        weight_kg: values.weight_kg ? Number(values.weight_kg) : null,
        height_cm: values.height_cm ? Number(values.height_cm) : null,
        waist_cm: values.waist_cm ? Number(values.waist_cm) : null,
        notes: values.notes?.trim() || null,
      }
      if (metric) {
        return updateMetric(metric.id, {
          measured_at: input.measured_at,
          weight_kg: input.weight_kg,
          height_cm: input.height_cm,
          waist_cm: input.waist_cm,
          notes: input.notes,
        })
      }
      return createMetric(input)
    },
    onSuccess: () => {
      invalidate()
      toast.success(metric ? 'Measurement updated' : 'Measurement recorded')
      onClose()
    },
    onError: (error) => setFormError(metricErrorMessage(error)),
  })

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!metric) throw new Error('No measurement selected')
      return deleteMetric(metric.id)
    },
    onSuccess: () => {
      invalidate()
      toast.success('Measurement deleted')
      onClose()
    },
    onError: (error) => setFormError(metricErrorMessage(error)),
  })

  const weight = watch('weight_kg')
  const height = watch('height_cm')
  const bmi = calculateBmi(weight ? Number(weight) : null, height ? Number(height) : null)
  const canDelete = Boolean(metric) && (scope === 'admin' || recordedBySelf)
  const pending = saveMutation.isPending || deleteMutation.isPending

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!pending) onClose()
      }}
      title={metric ? 'Edit measurement' : 'Record measurement'}
      description={
        scope === 'admin'
          ? 'Added to the member\u2019s progress history and attributed to you.'
          : 'Track weight, height, and waist over time.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="metric-form"
            loading={saveMutation.isPending}
            disabled={deleteMutation.isPending}
          >
            {metric ? 'Save changes' : 'Save measurement'}
          </Button>
        </>
      }
    >
      <form
        id="metric-form"
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setFormError(null)
          saveMutation.mutate(values)
        })}
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}

        <Input
          label="Measured at"
          type="datetime-local"
          error={errors.measured_at?.message}
          {...register('measured_at')}
        />

        <div className="grid gap-4 sm:grid-cols-3">
          <Input
            label="Weight (kg)"
            type="number"
            min="1"
            max="499"
            step="0.1"
            placeholder="70.5"
            error={errors.weight_kg?.message}
            {...register('weight_kg')}
          />
          <Input
            label="Height (cm)"
            type="number"
            min="30"
            max="349"
            step="0.1"
            placeholder="175"
            error={errors.height_cm?.message}
            {...register('height_cm')}
          />
          <Input
            label="Waist (cm)"
            type="number"
            min="1"
            max="499"
            step="0.1"
            placeholder="82"
            error={errors.waist_cm?.message}
            {...register('waist_cm')}
          />
        </div>

        {bmi != null && (
          <p className="rounded-lg border border-brand-100 bg-brand-50/60 px-4 py-3 text-sm text-brand-900">
            Calculated BMI: <strong>{bmi}</strong>
          </p>
        )}

        <Textarea
          label="Notes"
          rows={3}
          placeholder="Optional — how you felt, training focus, etc."
          error={errors.notes?.message}
          {...register('notes')}
        />

        {canDelete && (
          <div className="border-t border-slate-100 pt-4">
            {confirmDelete ? (
              <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                <p className="text-sm font-medium text-rose-900">Delete this measurement?</p>
                <p className="mt-1 text-xs text-rose-700">This cannot be undone.</p>
                <div className="mt-3 flex gap-2">
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => deleteMutation.mutate()}
                    loading={deleteMutation.isPending}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleteMutation.isPending}
                  >
                    Keep
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-rose-600 hover:bg-rose-50"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-3.5" aria-hidden />
                Delete measurement
              </Button>
            )}
          </div>
        )}
      </form>
    </Modal>
  )
}
