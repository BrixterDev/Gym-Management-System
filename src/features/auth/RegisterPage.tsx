import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Mail, Lock, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Feedback'
import { useAuth } from './AuthProvider'
import { authErrorMessage, signUpWithEmail } from './api'

const schema = z
  .object({
    email: z.string().trim().toLowerCase().email('Enter a valid email address'),
    password: z.string().min(8, 'Use at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  })

type FormValues = z.infer<typeof schema>

export function RegisterPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [formError, setFormError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  if (!loading && session && !submitted) return <Navigate to="/" replace />

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await signUpWithEmail(values.email, values.password)
      setSubmitted(true)
    } catch (error) {
      setFormError(authErrorMessage(error))
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-slate-100">Registration received</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Your account is pending admin approval. You'll be able to check in and view your progress
          once the gym approves your account. If email confirmation is enabled, confirm your email
          first, then sign in to view your status.
        </p>
        <Button className="mt-6 w-full" size="lg" onClick={() => navigate('/login')}>
          Go to sign in
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        Register with your email. The gym will set up your member profile and approve your account.
      </p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4" noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leadingIcon={<Mail className="size-4" />}
          error={errors.email?.message}
          {...register('email')}
        />

        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          leadingIcon={<Lock className="size-4" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          leadingIcon={<Lock className="size-4" />}
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-brand-400 hover:text-brand-200">
          Sign in
        </Link>
      </p>
    </div>
  )
}
