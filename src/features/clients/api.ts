import { supabase } from '@/lib/supabase'
import type {
  AccountStatus,
  ClientDirectoryRow,
  MembershipRow,
  MembershipStatus,
  ProfileRow,
} from '@/types/database'

export type ClientSort = 'newest' | 'oldest' | 'name' | 'email'

export interface ClientListFilters {
  search: string
  accountStatus: AccountStatus | 'all'
  membershipStatus: MembershipStatus | 'all'
  sort: ClientSort
  page: number
  pageSize: number
}

export const defaultClientFilters: ClientListFilters = {
  search: '',
  accountStatus: 'all',
  membershipStatus: 'all',
  sort: 'newest',
  page: 1,
  pageSize: 10,
}

/** Strip PostgREST `or` syntax characters while keeping user wildcards. */
function sanitizeSearch(value: string) {
  return value.trim().replace(/[,()"'\\]/g, ' ')
}

export async function listClients(filters: ClientListFilters) {
  let query = supabase
    .from('admin_client_directory')
    .select('*', { count: 'exact' })

  const search = sanitizeSearch(filters.search)
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,display_name.ilike.%${search}%,member_code.ilike.%${search}%`,
    )
  }
  if (filters.accountStatus !== 'all') {
    query = query.eq('account_status', filters.accountStatus)
  }
  if (filters.membershipStatus !== 'all') {
    query = query.eq('membership_status', filters.membershipStatus)
  }

  switch (filters.sort) {
    case 'oldest':
      query = query.order('created_at', { ascending: true })
      break
    case 'name':
      query = query.order('display_name', { ascending: true, nullsFirst: false })
      break
    case 'email':
      query = query.order('email', { ascending: true })
      break
    default:
      query = query.order('created_at', { ascending: false })
  }

  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: (data ?? []) as ClientDirectoryRow[], count: count ?? 0 }
}

export async function listPendingApprovals() {
  const { data, error } = await supabase
    .from('admin_client_directory')
    .select('*')
    .eq('account_status', 'pending')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as ClientDirectoryRow[]
}

export async function getClient(clientId: string) {
  const { data, error } = await supabase
    .from('admin_client_directory')
    .select('*')
    .eq('id', clientId)
    .maybeSingle()

  if (error) throw error
  return (data as ClientDirectoryRow | null) ?? null
}

export interface ClientDetailInput {
  display_name: string | null
  member_code: string | null
  phone: string | null
  height_cm: number | null
  date_of_birth: string | null
  emergency_contact: string | null
  notes: string | null
}

export async function updateClientDetails(clientId: string, input: ClientDetailInput) {
  const { error: detailError } = await supabase.from('client_details').upsert(
    {
      client_id: clientId,
      display_name: input.display_name,
      member_code: input.member_code,
      height_cm: input.height_cm,
      date_of_birth: input.date_of_birth,
      emergency_contact: input.emergency_contact,
      notes: input.notes,
    },
    { onConflict: 'client_id' },
  )
  if (detailError) throw detailError

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ phone: input.phone })
    .eq('id', clientId)
  if (profileError) throw profileError
}

export async function setAccountStatus(clientId: string, status: AccountStatus) {
  const { data, error } = await supabase.rpc('admin_set_account_status', {
    p_client_id: clientId,
    p_status: status,
  })
  if (error) throw error
  return data as ProfileRow
}

export async function createClientAccount(input: {
  email: string
  password: string
  display_name: string
  member_code: string
  phone: string
}) {
  const { data, error } = await supabase.functions.invoke<{ id: string; email: string; error?: string }>(
    'admin-create-client',
    {
      body: {
        email: input.email,
        password: input.password,
        display_name: input.display_name || null,
        member_code: input.member_code || null,
        phone: input.phone || null,
      },
    },
  )

  if (error) {
    // Edge Function errors carry a JSON body in some runtimes.
    const context = (error as { context?: Response }).context
    if (context) {
      try {
        const body = (await context.json()) as { error?: string }
        if (body?.error) throw new Error(body.error)
      } catch (parseError) {
        if (parseError instanceof Error && parseError.message !== 'Unexpected end of JSON input') {
          throw parseError
        }
      }
    }
    throw error
  }

  if (data?.error) throw new Error(data.error)
  if (!data) throw new Error('No response from the server')
  return data
}

export interface ClientMembership extends MembershipRow {
  plan: { name: string; duration_days: number; price: number } | null
}

export async function listClientMemberships(clientId: string): Promise<ClientMembership[]> {
  const { data, error } = await supabase
    .from('memberships')
    .select('*, plan:membership_plans(name, duration_days, price)')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ClientMembership[]
}

export function clientErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/duplicate key|unique/i.test(message) && /member_code/i.test(message)) {
    return 'That member code is already assigned to another client.'
  }
  if (/admin privileges required/i.test(message)) return 'You do not have permission to do that.'
  if (/only client accounts/i.test(message)) return 'Only client accounts can be moderated here.'
  if (/failed to send a request|failed to fetch/i.test(message)) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return message
}
