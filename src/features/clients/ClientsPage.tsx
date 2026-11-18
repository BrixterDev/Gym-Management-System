import { useDeferredValue, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as ChevronRow,
  Search,
  UserPlus,
  Users,
} from 'lucide-react'
import { PageHeader, EmptyState, Alert } from '@/components/ui/Feedback'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import {
  AccountStatusBadge,
  Badge,
  MembershipStatusBadge,
} from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { defaultClientFilters, listClients, type ClientListFilters } from './api'
import { ClientAvatar } from './ClientStatusActions'
import { CreateClientDialog } from './CreateClientDialog'

export function ClientsPage() {
  const [filters, setFilters] = useState<ClientListFilters>(defaultClientFilters)
  const [createOpen, setCreateOpen] = useState(false)
  const deferredSearch = useDeferredValue(filters.search)

  const query = useQuery({
    queryKey: [
      'clients',
      { ...filters, search: deferredSearch, page: filters.page },
    ],
    queryFn: () => listClients({ ...filters, search: deferredSearch }),
    placeholderData: keepPreviousData,
  })

  const rows = query.data?.rows ?? []
  const count = query.data?.count ?? 0
  const totalPages = Math.max(1, Math.ceil(count / filters.pageSize))
  const hasFilters =
    filters.search.trim() !== '' ||
    filters.accountStatus !== 'all' ||
    filters.membershipStatus !== 'all'

  const update = (patch: Partial<ClientListFilters>) =>
    setFilters((current) => ({ ...current, ...patch, page: patch.page ?? 1 }))

  useEffect(() => {
    if (filters.page > totalPages) {
      setFilters((current) => ({ ...current, page: totalPages }))
    }
  }, [filters.page, totalPages])

  return (
    <div>
      <PageHeader
        title="Clients"
        description="Search, review, and manage member accounts and identities."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus className="size-4" aria-hidden />
            Add client
          </Button>
        }
      />

      {query.isError && (
        <div className="mb-4">
          <Alert tone="error" title="Could not load clients">
            {(query.error as Error).message}
          </Alert>
        </div>
      )}

      <div className="glass-panel rounded-2xl">
        <div className="grid gap-3 border-b border-white/[0.07] p-4 sm:grid-cols-2 xl:grid-cols-4">
          <Input
            type="search"
            placeholder="Search name, email, or member code"
            aria-label="Search clients"
            leadingIcon={<Search className="size-4" />}
            value={filters.search}
            onChange={(event) => update({ search: event.target.value })}
          />
          <Select
            aria-label="Filter by account status"
            value={filters.accountStatus}
            onChange={(event) =>
              update({ accountStatus: event.target.value as ClientListFilters['accountStatus'] })
            }
          >
            <option value="all">All account statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="suspended">Suspended</option>
          </Select>
          <Select
            aria-label="Filter by membership status"
            value={filters.membershipStatus}
            onChange={(event) =>
              update({
                membershipStatus: event.target.value as ClientListFilters['membershipStatus'],
              })
            }
          >
            <option value="all">All membership statuses</option>
            <option value="member">Member</option>
            <option value="non-member">Non-member</option>
          </Select>
          <Select
            aria-label="Sort clients"
            value={filters.sort}
            onChange={(event) => update({ sort: event.target.value as ClientListFilters['sort'] })}
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="name">Name A–Z</option>
            <option value="email">Email A–Z</option>
          </Select>
        </div>

        {query.isLoading ? (
          <div className="divide-y divide-white/[0.07]" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3 px-4 py-4">
                <div className="size-10 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-white/[0.06]" />
                  <div className="h-3 w-56 animate-pulse rounded bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Users className="size-8" aria-hidden />}
            title={hasFilters ? 'No clients match those filters' : 'No clients yet'}
            description={
              hasFilters
                ? 'Try a different search term or clear the filters.'
                : 'Self-registrations and accounts you create will appear here.'
            }
            action={
              hasFilters ? (
                <Button variant="outline" size="sm" onClick={() => setFilters(defaultClientFilters)}>
                  Clear filters
                </Button>
              ) : (
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <UserPlus className="size-3.5" aria-hidden />
                  Add your first client
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden min-w-0 xl:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-slate-400">
                    <th scope="col" className="px-4 py-3 font-medium">Client</th>
                    <th scope="col" className="px-4 py-3 font-medium">Member code</th>
                    <th scope="col" className="px-4 py-3 font-medium">Account</th>
                    <th scope="col" className="px-4 py-3 font-medium">Membership</th>
                    <th scope="col" className="px-4 py-3 font-medium">Joined</th>
                    <th scope="col" className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.07]">
                  {rows.map((client) => (
                    <tr key={client.id} className="group transition-colors hover:bg-white/[0.04]">
                      <td className="px-4 py-3">
                        <Link to={`/admin/clients/${client.id}`} className="flex items-center gap-3">
                          <ClientAvatar name={client.display_name} email={client.email} />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-100">
                              {client.display_name ?? 'Unnamed member'}
                            </span>
                            <span className="block truncate text-xs text-slate-400">{client.email}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        {client.member_code ? (
                          <span className="font-mono text-xs text-slate-300">{client.member_code}</span>
                        ) : (
                          <span className="text-xs text-slate-400">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <AccountStatusBadge status={client.account_status} />
                      </td>
                      <td className="px-4 py-3">
                        <MembershipStatusBadge status={client.membership_status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-400">{formatDate(client.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          to={`/admin/clients/${client.id}`}
                          aria-label={`Open ${client.display_name ?? client.email}`}
                          className="inline-flex size-8 items-center justify-center rounded-lg text-slate-400 group-hover:text-slate-200"
                        >
                          <ChevronRow className="size-4" aria-hidden />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <ul className="divide-y divide-white/[0.07] xl:hidden">
              {rows.map((client) => (
                <li key={client.id}>
                  <Link
                    to={`/admin/clients/${client.id}`}
                    className="flex items-start gap-3 px-4 py-4 active:bg-white/[0.03]"
                  >
                    <ClientAvatar name={client.display_name} email={client.email} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-slate-100">
                          {client.display_name ?? 'Unnamed member'}
                        </span>
                        <ChevronRow className="size-4 shrink-0 text-slate-400" aria-hidden />
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-400">{client.email}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-1.5">
                        <AccountStatusBadge status={client.account_status} />
                        <MembershipStatusBadge status={client.membership_status} />
                        {client.member_code && (
                          <Badge tone="slate">{client.member_code}</Badge>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-400">
              Showing <span className="font-medium text-slate-300">{rows.length}</span> of{' '}
              <span className="font-medium text-slate-300">{count}</span> clients
            </p>
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
              <span className="whitespace-nowrap text-xs text-slate-400">
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

      <CreateClientDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
