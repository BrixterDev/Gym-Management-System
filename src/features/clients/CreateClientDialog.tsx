import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Alert } from '@/components/ui/Feedback'
import { useToast } from '@/components/ui/Toast'
import { clientErrorMessage, createClientAccount } from './api'

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
  display_name: z.string().trim().max(120, 'Keep it under 120 characters').optional(),
  member_code: z
    .string()
    .trim()
    .max(60, 'Keep it under 60 characters')
    .regex(/^[A-Za-z0-9._-]*$/, 'Letters, numbers, dot, dash and underscore only')
    .optional(),
  phone: z.string().trim().max(30, 'Too long').optional(),
})

type FormValues = z.infer<typeof schema>

function generatePassword() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$'
  const values = new Uint32Array(14)
  crypto.getRandomValues(values)
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join('')
}

export function CreateClientDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', display_name: '', member_code: '', phone: '' },
  })

  const mutation = useMutation({
    mutationFn: createClientAccount,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] })
      queryClient.invalidateQueries({ queryKey: ['approvals'] })
      queryClient.invalidateQueries({ queryKey: ['pending-count'] })
      toast.success('Client account created', `${result.email} can sign in immediately.`)
      reset()
      onClose()
    },
    onError: (error) => setFormError(clientErrorMessage(error)),
  })

  const onSubmit = (values: FormValues) => {
    setFormError(null)
    mutation.mutate({
      email: values.email,
      password: values.password,
      display_name: values.display_name ?? '',
      member_code: values.member_code ?? '',
      phone: values.phone ?? '',
    })
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) onClose()
      }}
      title="Create client account"
      description="Created accounts are approved immediately. Share the email and password with the member."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="create-client-form" loading={mutation.isPending}>
            Create client
          </Button>
        </>
      }
    >
      <form id="create-client-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <Input
          label="Email"
          type="email"
          autoComplete="off"
          placeholder="member@example.com"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Temporary password"
              type="text"
              autoComplete="new-password"
              error={errors.password?.message}
              {...register('password')}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => setValue('password', generatePassword(), { shouldValidate: true })}
          >
            <RefreshCw className="size-3.5" aria-hidden />
            Generate
          </Button>
        </div>

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
        </div>

        <Input label="Phone" type="tel" placeholder="+63 900 000 0000" error={errors.phone?.message} {...register('phone')} />

        <p className="text-xs leading-relaxed text-slate-500">
          The account is created server-side with the service role after verifying your admin
          session. No privileged key is exposed to the browser.
        </p>
      </form>
    </Modal>
  )
}
