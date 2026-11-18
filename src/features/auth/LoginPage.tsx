import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { Mail, Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Feedback'
import { useAuth } from './AuthProvider'
import { authErrorMessage, signInWithPassword } from './api'

const schema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})

type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [formError, setFormError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  // Root redirect resolves the correct portal for the signed-in role.
  if (!loading && session) return <Navigate to={from ?? '/'} replace />

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    try {
      await signInWithPassword(values.email, values.password)
      navigate(from ?? '/', { replace: true })
    } catch (error) {
      setFormError(authErrorMessage(error))
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-100">Welcome back</h1>
      <p className="mt-1.5 text-sm text-slate-400">
        Sign in to your account. Staff and members use the same sign-in.
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
          autoComplete="current-password"
          placeholder="••••••••"
          leadingIcon={<Lock className="size-4" />}
          error={errors.password?.message}
          {...register('password')}
        />

        <Button type="submit" className="w-full" size="lg" loading={isSubmitting}>
          Sign in
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        New member?{' '}
        <Link to="/register" className="font-medium text-brand-400 hover:text-brand-200">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-slate-400">
        Staff accounts are provisioned by the gym administrator.
      </p>
    </div>
  )
}
