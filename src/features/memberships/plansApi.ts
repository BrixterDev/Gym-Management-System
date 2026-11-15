import { supabase } from '@/lib/supabase'
import type { PlanDirectoryRow } from '@/types/database'

export interface PlanInput {
  name: string
  description: string | null
  duration_days: number
  price: number
}

export async function listPlans(): Promise<PlanDirectoryRow[]> {
  const { data, error } = await supabase
    .from('admin_plan_directory')
    .select('*')
    .order('is_active', { ascending: false })
    .order('price', { ascending: true })

  if (error) throw error
  return (data ?? []) as PlanDirectoryRow[]
}

export async function listActivePlans(): Promise<PlanDirectoryRow[]> {
  const { data, error } = await supabase
    .from('admin_plan_directory')
    .select('*')
    .eq('is_active', true)
    .order('price', { ascending: true })

  if (error) throw error
  return (data ?? []) as PlanDirectoryRow[]
}

export async function createPlan(input: PlanInput) {
  const { data, error } = await supabase
    .from('membership_plans')
    .insert(input)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function updatePlan(planId: string, input: PlanInput) {
  const { data, error } = await supabase
    .from('membership_plans')
    .update(input)
    .eq('id', planId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function setPlanActive(planId: string, isActive: boolean) {
  const { data, error } = await supabase
    .from('membership_plans')
    .update({ is_active: isActive })
    .eq('id', planId)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export function planErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/membership_plans_name_lower_idx|duplicate key/i.test(message)) {
    return 'A plan with that name already exists.'
  }
  if (/does not exist|column/i.test(message)) {
    return 'Could not save the plan. Please review the values.'
  }
  return message
}
