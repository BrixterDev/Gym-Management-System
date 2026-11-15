import { supabase } from '@/lib/supabase'
import type { BodyMetricsDirectoryRow } from '@/types/database'

async function listMetrics(clientId: string) {
  const { data, error } = await supabase
    .from('admin_body_metrics_directory')
    .select('*')
    .eq('client_id', clientId)
    .order('measured_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as BodyMetricsDirectoryRow[]
}

export const listMyMetrics = listMetrics
export const listClientMetrics = listMetrics

export interface MetricInput {
  client_id: string
  measured_at: string
  weight_kg: number | null
  height_cm: number | null
  waist_cm: number | null
  notes: string | null
}

export async function createMetric(input: MetricInput) {
  const { data, error } = await supabase
    .from('body_metrics')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export type MetricUpdate = Omit<MetricInput, 'client_id'>

export async function updateMetric(metricId: string, input: MetricUpdate) {
  const { data, error } = await supabase
    .from('body_metrics')
    .update(input)
    .eq('id', metricId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteMetric(metricId: string) {
  const { error } = await supabase.from('body_metrics').delete().eq('id', metricId)
  if (error) throw error
}

export function metricErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/read-only to you/i.test(message)) {
    return 'This measurement was recorded by the gym and cannot be edited.'
  }
  if (/only record their own metrics/i.test(message)) {
    return 'You can only record measurements for your own profile.'
  }
  if (/has_value_check|at least one/i.test(message)) {
    return 'Enter at least one measurement: weight, height, or waist.'
  }
  if (/row-level security|permission denied/i.test(message)) {
    return 'You do not have permission to change this measurement.'
  }
  if (/check constraint|numeric field overflow|invalid input syntax/i.test(message)) {
    return 'One of the values is outside the allowed range. Please review it.'
  }
  if (/authentication required/i.test(message)) return 'Please sign in again to continue.'
  return message
}
