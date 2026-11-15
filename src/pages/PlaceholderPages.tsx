import { Link } from 'react-router-dom'
import { Construction, Home } from 'lucide-react'
import { Card, CardBody } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/Feedback'

export function ComingSoonPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <Card>
        <CardBody className="flex flex-col items-center py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <Construction className="size-6" aria-hidden />
          </span>
          <h2 className="mt-4 text-sm font-semibold text-slate-900">Scheduled for {phase}</h2>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            This module is part of the phased rollout. The database foundation and security layer
            backing it are already in place.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            <Home className="size-4" aria-hidden />
            Back to dashboard
          </Link>
        </CardBody>
      </Card>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="text-2xl font-semibold text-slate-900">Page not found</h1>
      <p className="max-w-sm text-sm text-slate-500">
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link
        to="/"
        className="mt-2 inline-flex h-10 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700"
      >
        Go home
      </Link>
    </div>
  )
}
