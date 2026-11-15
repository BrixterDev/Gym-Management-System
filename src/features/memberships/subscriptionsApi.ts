import { supabase } from '@/lib/supabase'
import type { SubscriptionDirectoryRow, SubscriptionStatus } from '@/types/database'

export interface SubscriptionFilters {
  search: string
  status: SubscriptionStatus | 'all'
  page: number
  pageSize: number
}

export const defaultSubscriptionFilters: SubscriptionFilters = {
  search: '',
  status: 'all',
  page: 1,
  pageSize: 10,
}

function sanitize(value: string) {
  return value.trim().replace(/[,()"'\\]/g, ' ')
}

export async function refreshSubscriptions() {
  const { data, error } = await supabase.rpc('admin_refresh_subscriptions')
  if (error) throw error
  return data ?? 0
}

export async function listSubscriptions(filters: SubscriptionFilters) {
  let query = supabase
    .from('admin_subscription_directory')
    .select('*', { count: 'exact' })

  const search = sanitize(filters.search)
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,display_name.ilike.%${search}%,member_code.ilike.%${search}%,plan_name.ilike.%${search}%`,
    )
  }
  if (filters.status !== 'all') {
    query = query.eq('subscription_status', filters.status)
  }

  query = query.order('created_at', { ascending: false })
  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return {
    rows: (data ?? []) as SubscriptionDirectoryRow[],
    count: count ?? 0,
  }
}

export async function assignSubscription(clientId: string, planId: string, startDate: string) {
  const { data, error } = await supabase.rpc('admin_create_subscription', {
    p_client_id: clientId,
    p_plan_id: planId,
    p_start_date: startDate,
  })
  if (error) throw error
  return data
}

export async function renewSubscription(
  membershipId: string,
  planId: string,
  startDate: string,
) {
  const { data, error } = await supabase.rpc('admin_renew_subscription', {
    p_membership_id: membershipId,
    p_plan_id: planId,
    p_start_date: startDate,
  })
  if (error) throw error
  return data
}

export async function pauseSubscription(membershipId: string) {
  const { data, error } = await supabase.rpc('admin_pause_subscription', {
    p_membership_id: membershipId,
  })
  if (error) throw error
  return data
}

export async function resumeSubscription(membershipId: string) {
  const { data, error } = await supabase.rpc('admin_resume_subscription', {
    p_membership_id: membershipId,
  })
  if (error) throw error
  return data
}

export async function cancelSubscription(membershipId: string) {
  const { data, error } = await supabase.rpc('admin_cancel_subscription', {
    p_membership_id: membershipId,
  })
  if (error) throw error
  return data
}

export async function changeSubscriptionPlan(membershipId: string, planId: string) {
  const { data, error } = await supabase.rpc('admin_change_subscription_plan', {
    p_membership_id: membershipId,
    p_plan_id: planId,
  })
  if (error) throw error
  return data
}

export async function getSubscriptionSummary() {
  const { data, error } = await supabase
    .from('admin_subscription_summary')
    .select('*')
  if (error) throw error
  return (data ?? []) as { subscription_status: SubscriptionStatus; subscription_count: number }[]
}

export function subscriptionErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/already has an active or paused/i.test(message)) {
    return 'This client already has an active or paused subscription.'
  }
  if (/inactive/i.test(message)) return 'That plan is inactive and cannot be assigned.'
  if (/cancelled subscriptions cannot be renewed/i.test(message)) {
    return 'Cancelled subscriptions are terminal. Create a new subscription instead.'
  }
  if (/resume this subscription before renewing/i.test(message)) {
    return 'Resume the subscription before renewing it.'
  }
  if (/renewal must start after/i.test(message)) {
    return 'A renewal must start after the current subscription ends.'
  }
  if (/only active subscriptions can be paused/i.test(message)) {
    return 'Only active subscriptions can be paused.'
  }
  if (/already ended/i.test(message)) return 'That subscription has already ended.'
  if (/only paused subscriptions can be resumed/i.test(message)) {
    return 'Only paused subscriptions can be resumed.'
  }
  if (/only active or paused/i.test(message)) {
    return 'Only active or paused subscriptions can change plans.'
  }
  if (/already on that plan/i.test(message)) return 'This subscription already uses that plan.'
  if (/admin privileges required/i.test(message)) return 'You do not have permission to do that.'
  return message
}
