import { supabase } from '@/lib/supabase'
import { addDaysIso } from '@/lib/utils'
import type {
  AttendanceDirectoryRow,
  AttendanceRow,
  AttendanceStatsRow,
  SubscriptionStatus,
  ToggleAttendanceResult,
} from '@/types/database'

export type AttendanceView = 'all' | 'in-gym' | 'today' | 'week'

export interface AttendanceFilters {
  search: string
  view: AttendanceView
  page: number
  pageSize: number
}

export const defaultAttendanceFilters: AttendanceFilters = {
  search: '',
  view: 'all',
  page: 1,
  pageSize: 15,
}

function sanitize(value: string) {
  return value.trim().replace(/[,()"'\\]/g, ' ')
}

export async function listAttendance(filters: AttendanceFilters, today: string) {
  let query = supabase.from('admin_attendance_directory').select('*', { count: 'exact' })

  const search = sanitize(filters.search)
  if (search) {
    query = query.or(
      `email.ilike.%${search}%,display_name.ilike.%${search}%,member_code.ilike.%${search}%`,
    )
  }

  if (filters.view === 'in-gym') {
    query = query.is('time_out', null)
  } else if (filters.view === 'today') {
    query = query.eq('visit_date', today)
  } else if (filters.view === 'week') {
    query = query.gte('visit_date', addDaysIso(today, -6))
  }

  query = query.order('time_in', { ascending: false })
  const from = (filters.page - 1) * filters.pageSize
  query = query.range(from, from + filters.pageSize - 1)

  const { data, error, count } = await query
  if (error) throw error
  return { rows: (data ?? []) as AttendanceDirectoryRow[], count: count ?? 0 }
}

export async function getAttendanceStats() {
  const { data, error } = await supabase
    .from('admin_attendance_stats')
    .select('*')
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as AttendanceStatsRow | null
}

export async function getGymTimezone() {
  const { data, error } = await supabase
    .from('gym_settings')
    .select('timezone')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data?.timezone ?? 'Asia/Manila'
}

export async function toggleAttendance(code: string): Promise<ToggleAttendanceResult> {
  const { data, error } = await supabase.rpc('admin_toggle_attendance', { p_code: code })
  if (error) throw error
  const row = (data ?? [])[0]
  if (!row) throw new Error('The attendance action did not return a result.')
  return row
}

export async function closeAttendance(attendanceId: string) {
  const { data, error } = await supabase.rpc('admin_close_attendance', {
    p_attendance_id: attendanceId,
  })
  if (error) throw error
  return data
}

export async function updateAttendance(
  attendanceId: string,
  timeIn: string,
  timeOut: string | null,
) {
  const { data, error } = await supabase.rpc('admin_update_attendance', {
    p_attendance_id: attendanceId,
    p_time_in: timeIn,
    p_time_out: timeOut,
  })
  if (error) throw error
  return data
}

export async function deleteAttendance(attendanceId: string) {
  const { error } = await supabase.from('attendance').delete().eq('id', attendanceId)
  if (error) throw error
}

export async function regenerateQrToken(clientId: string) {
  const { data, error } = await supabase.rpc('admin_regenerate_client_qr', {
    p_client_id: clientId,
  })
  if (error) throw error
  return data as string
}

// -----------------------------------------------------------------------------
// Member self-service
// -----------------------------------------------------------------------------
export async function selfCheckIn() {
  const { data, error } = await supabase.rpc('client_check_in')
  if (error) throw error
  return data as AttendanceRow
}

export async function selfCheckOut() {
  const { data, error } = await supabase.rpc('client_check_out')
  if (error) throw error
  return data as AttendanceRow
}

export async function getMyOpenSession(clientId: string) {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('client_id', clientId)
    .is('time_out', null)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as AttendanceRow | null
}

export interface MyAttendanceFilters {
  page: number
  pageSize: number
}

export async function listMyAttendance(filters: MyAttendanceFilters) {
  const { data, error, count } = await supabase
    .from('attendance')
    .select('*', { count: 'exact' })
    .order('time_in', { ascending: false })
    .range(
      (filters.page - 1) * filters.pageSize,
      (filters.page - 1) * filters.pageSize + filters.pageSize - 1,
    )
  if (error) throw error
  return { rows: (data ?? []) as AttendanceRow[], count: count ?? 0 }
}

export interface MyMembershipState {
  subscription_status: SubscriptionStatus
  start_date: string
  end_date: string
}

export async function getMyMembershipState(clientId: string) {
  const { data, error } = await supabase
    .from('memberships')
    .select('subscription_status, start_date, end_date')
    .eq('client_id', clientId)
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as MyMembershipState | null
}

export function attendanceErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/already checked in|already has another open/i.test(message)) {
    return 'This member is already checked in.'
  }
  if (/no open attendance session/i.test(message)) {
    return 'This member is not currently checked in.'
  }
  if (/subscription is paused/i.test(message)) {
    return 'The membership is paused. Resume it before checking in.'
  }
  if (/no active subscription/i.test(message)) {
    return 'This member has no active subscription. Renew it before checking in.'
  }
  if (/account is not active/i.test(message)) {
    return 'This account is not active. Approve it before checking in.'
  }
  if (/no member matches/i.test(message)) {
    return 'No member matches that QR code or member code.'
  }
  if (/time out must be after/i.test(message)) {
    return 'Time out must be after time in.'
  }
  if (/already closed/i.test(message)) return 'This session is already closed.'
  if (/enter a qr code or member code/i.test(message)) {
    return 'Enter a QR code or member code.'
  }
  if (/admin privileges required/i.test(message)) return 'You do not have permission to do that.'
  return message
}
