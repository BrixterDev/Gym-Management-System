import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import type { PlanDirectoryRow } from '@/types/database'
import { createPlan, planErrorMessage, updatePlan } from './plansApi'

const schema = z.object({
  name: z.string().trim().min(2, 'Enter a plan name').max(80, 'Keep it under 80 characters'),
  description: z.string().trim().max(400, 'Keep it under 400 characters').optional(),
  duration_days: z
    .string()
    .trim()
    .min(1, 'Enter a duration')
    .refine((value) => Number(value) >= 1 && Number(value) <= 3650, 'Use 1–3650 days'),
  price: z
    .string()
    .trim()
    .min(1, 'Enter a price')
    .refine((value) => !Number.isNaN(Number(value)) && Number(value) >= 0, 'Enter a valid price'),
})

type FormValues = z.infer<typeof schema>

export function PlanDialog({
  open,
  onClose,
  plan,
}: {
  open: boolean
  onClose: () => void
  plan: PlanDirectoryRow | null
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)
  const isEdit = Boolean(plan)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', duration_days: '30', price: '' },
  })

  useEffect(() => {
    if (!open) return
    reset({
      name: plan?.name ?? '',
      description: plan?.description ?? '',
      duration_days: plan ? String(plan.duration_days) : '30',
      price: plan ? String(plan.price) : '',
    })
    setFormError(null)
  }, [open, plan, reset])

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const input = {
        name: values.name.trim(),
        description: values.description?.trim() || null,
        duration_days: Number(values.duration_days),
        price: Number(values.price),
      }
      if (plan) return updatePlan(plan.id, input)
      return createPlan(input)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      queryClient.invalidateQueries({ queryKey: ['active-plans'] })
      toast.success(isEdit ? 'Plan updated' : 'Plan created')
      onClose()
    },
    onError: (error) => setFormError(planErrorMessage(error)),
  })

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title={isEdit ? 'Edit membership plan' : 'New membership plan'}
      description="Duration drives subscription end dates. Price is snapshotted when a plan is assigned."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="plan-form" loading={mutation.isPending}>
            {isEdit ? 'Save plan' : 'Create plan'}
          </Button>
        </>
      }
    >
      <form
        id="plan-form"
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        className="space-y-4"
        noValidate
      >
        {formError && <Alert tone="error">{formError}</Alert>}

        <Input label="Plan name" placeholder="Monthly" error={errors.name?.message} {...register('name')} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Duration (days)"
            type="number"
            min="1"
            max="3650"
            error={errors.duration_days?.message}
            {...register('duration_days')}
          />
          <Input
            label="Price (PHP)"
            type="number"
            min="0"
            step="0.01"
            placeholder="1500"
            error={errors.price?.message}
            {...register('price')}
          />
        </div>

        <Textarea
          label="Description"
          rows={3}
          placeholder="What's included in this plan?"
          error={errors.description?.message}
          {...register('description')}
        />
      </form>
    </Modal>
  )
}
