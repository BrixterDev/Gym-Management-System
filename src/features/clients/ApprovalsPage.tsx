import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, ChevronRight, Inbox, RefreshCw } from 'lucide-react'
import { PageHeader, EmptyState } from '@/components/ui/Feedback'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, AccountStatusBadge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { listPendingApprovals } from './api'
import { ClientAvatar, ClientStatusActions } from './ClientStatusActions'

export function ApprovalsPage() {
  const query = useQuery({ queryKey: ['approvals'], queryFn: listPendingApprovals })
  const rows = query.data ?? []

  return (
    <div>
      <PageHeader
        title="Approvals"
        description="Review self-registrations before granting portal access."
        action={
          <Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`size-4 ${query.isFetching ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 flex items-center gap-2">
        <Badge tone={rows.length > 0 ? 'amber' : 'green'} dot>
          {rows.length} pending
        </Badge>
        {rows.length === 0 && !query.isLoading && (
          <span className="text-xs text-slate-400">All registrations have been reviewed.</span>
        )}
      </div>

      {query.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardBody className="flex items-center gap-3">
                <div className="size-10 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-48 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-32 animate-pulse rounded bg-white/[0.03]" />
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<CheckCircle2 className="size-8" aria-hidden />}
              title="No pending approvals"
              description="New self-registrations will appear here for review."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((client) => (
            <Card key={client.id}>
              <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <ClientAvatar name={client.display_name} email={client.email} />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        to={`/admin/clients/${client.id}`}
                        className="truncate text-sm font-semibold text-slate-100 hover:text-brand-200"
                      >
                        {client.display_name ?? 'Unnamed registration'}
                      </Link>
                      <AccountStatusBadge status={client.account_status} />
                    </div>
                    <p className="mt-0.5 truncate text-xs text-slate-400">{client.email}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      Registered {formatDate(client.created_at)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <ClientStatusActions client={client} />
                  <Link
                    to={`/admin/clients/${client.id}`}
                    className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-slate-400 hover:bg-white/[0.08] hover:text-slate-200"
                  >
                    Review
                    <ChevronRight className="size-3.5" aria-hidden />
                  </Link>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6">
        <CardHeader title="How approval works" />
        <CardBody className="flex items-start gap-3 text-sm leading-relaxed text-slate-300">
          <Inbox className="mt-0.5 size-5 shrink-0 text-slate-400" aria-hidden />
          <p>
            Self-registration creates a <strong>pending</strong> account with no name field.
            Pending, rejected, and suspended accounts are blocked by the database from checking in
            or reading member data. Assign a display name and member code on the client's profile
            after approving.
          </p>
        </CardBody>
      </Card>
    </div>
  )
}
