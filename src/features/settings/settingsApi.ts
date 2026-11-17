import { supabase } from '@/lib/supabase'
import type { GymSettingsRow } from '@/types/database'

export async function getGymSettings(): Promise<GymSettingsRow> {
  const { data, error } = await supabase
    .from('gym_settings')
    .select('*')
    .limit(1)
    .single()
  if (error) throw error
  return data
}

export interface GymSettingsInput {
  timezone: string
  client_qr_url: string | null
  admin_qr_url: string | null
}

export async function updateGymSettings(id: string, input: GymSettingsInput) {
  const { data, error } = await supabase
    .from('gym_settings')
    .update(input)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export function settingsErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/unknown timezone/i.test(message)) {
    return 'That timezone is not recognized. Choose a valid IANA timezone.'
  }
  if (/timezone is required/i.test(message)) {
    return 'Choose a timezone.'
  }
  if (/qr url must start/i.test(message)) {
    return 'QR links must start with http:// or https://.'
  }
  if (/row-level security|permission denied|admin privileges/i.test(message)) {
    return 'Only administrators can change gym settings.'
  }
  if (/jwt|authentication required/i.test(message)) {
    return 'Your session expired. Please sign in again.'
  }
  return message
}
