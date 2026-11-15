import { supabase } from '@/lib/supabase'
import type { PaymentDirectoryRow, PaymentMethod, PaymentStatus } from '@/types/database'

export interface PaymentFilters {
  search: string
  status: PaymentStatus | 'all'
  method: PaymentMethod | 'all'
  page: number
  pageSize: number
}

export const defaultPaymentFilters: PaymentFilters = {
  search: '',
  status: 'all',
  method: 'all',
  page: 1,
  pageSize: 10,
}

function sanitize(value: string) {
  return value.trim().replace(/[,()"'\\]/g, ' ')
}

export async function listPayments(filters: PaymentFilters) {
  let query = supabase.from('admin_payments_directory').select('*', { count: 'exact' })

  const search = sanitize(filters.search)
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,display_name.ilike.%${search}%,member_code.ilike.%${search}%,reference_number.ilike.%${search}%`,
    )
  }
  if (filters.status !== 'all') query = query.eq('payment_status', filters.status)
  if (filters.method !== 'all') query = query.eq('payment_method', filters.method)

  query = query.order('payment_date', { ascending: false })
  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: (data ?? []) as PaymentDirectoryRow[], count: count ?? 0 }
}

export interface RecordPaymentInput {
  membership_id: string
  amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  reference_number: string | null
  payment_date: string
}

export async function recordPayment(input: RecordPaymentInput) {
  const { data, error } = await supabase.from('payments').insert(input).select('*').single()
  if (error) throw error
  return data
}

export async function setPaymentStatus(paymentId: string, status: PaymentStatus) {
  const { data, error } = await supabase
    .from('payments')
    .update({ payment_status: status })
    .eq('id', paymentId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function getPaymentSummary() {
  const { data, error } = await supabase.from('admin_payment_summary').select('*')
  if (error) throw error
  return (data ?? []) as { payment_status: PaymentStatus; payment_count: number; total_amount: number }[]
}

export function paymentErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/admin privileges required/i.test(message)) return 'You do not have permission to do that.'
  return message
}
