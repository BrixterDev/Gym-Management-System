import { supabase } from '@/lib/supabase'
import type { ClientDetailRow, ProfileRow } from '@/types/database'

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function fetchClientDetail(userId: string): Promise<ClientDetailRow | null> {
  const { data, error } = await supabase
    .from('client_details')
    .select('*')
    .eq('client_id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // No identity fields are collected at registration.
      data: {},
      emailRedirectTo: `${window.location.origin}/login`,
    },
  })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/invalid login credentials/i.test(message)) return 'Invalid email or password.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email before signing in.'
  if (/user already registered/i.test(message)) return 'An account with this email already exists.'
  if (/password should be at least/i.test(message)) return 'Password must be at least 8 characters.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a moment and try again.'
  return message
}
