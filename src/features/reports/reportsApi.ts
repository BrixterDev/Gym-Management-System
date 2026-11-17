import { supabase } from '@/lib/supabase'
import { addDaysIso, todayIsoDate } from '@/lib/utils'
import type {
  AttendanceDailyRow,
  AttendanceExportRow,
  MembershipExportRow,
  PaymentExportRow,
  PaymentMethodBreakdownRow,
  PlanPerformanceRow,
  ReportSummaryRow,
  RevenueDailyRow,
} from '@/types/database'

export type RangePreset = '7d' | '30d' | '90d' | 'this_month' | 'last_month' | 'custom'

export interface DateRange {
  from: string
  to: string
}

export const MAX_RANGE_DAYS = 366

export const presetLabels: Record<RangePreset, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  this_month: 'This month',
  last_month: 'Last month',
  custom: 'Custom range',
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

export function presetRange(preset: RangePreset, today = todayIsoDate()): DateRange {
  const base = new Date(`${today}T00:00:00`)
  const year = base.getFullYear()
  const month = base.getMonth()

  switch (preset) {
    case '7d':
      return { from: addDaysIso(today, -6), to: today }
    case '90d':
      return { from: addDaysIso(today, -89), to: today }
    case 'this_month': {
      const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
      return { from, to: today }
    }
    case 'last_month': {
      const previous = new Date(year, month - 1, 1)
      const previousYear = previous.getFullYear()
      const previousMonth = previous.getMonth()
      const from = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-01`
      const to = `${previousYear}-${String(previousMonth + 1).padStart(2, '0')}-${daysInMonth(
        previousYear,
        previousMonth,
      )}`
      return { from, to }
    }
    case '30d':
    default:
      return { from: addDaysIso(today, -29), to: today }
  }
}

export function rangeDays(range: DateRange) {
  const from = new Date(`${range.from}T00:00:00`).getTime()
  const to = new Date(`${range.to}T00:00:00`).getTime()
  if (Number.isNaN(from) || Number.isNaN(to)) return 0
  return Math.round((to - from) / 86_400_000) + 1
}

export function validateRange(range: DateRange): string | null {
  if (!range.from || !range.to) return 'Choose both a start and end date.'
  if (range.from > range.to) return 'The start date must be on or before the end date.'
  if (rangeDays(range) > MAX_RANGE_DAYS + 1) {
    return `Choose a range of ${MAX_RANGE_DAYS} days or fewer.`
  }
  return null
}

export async function getReportSummary(range: DateRange): Promise<ReportSummaryRow | null> {
  const { data, error } = await supabase.rpc('admin_report_summary', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data?.[0] as ReportSummaryRow | undefined) ?? null
}

export async function getRevenueDaily(range: DateRange): Promise<RevenueDailyRow[]> {
  const { data, error } = await supabase.rpc('admin_revenue_daily', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as RevenueDailyRow[]
}

export async function getAttendanceDaily(range: DateRange): Promise<AttendanceDailyRow[]> {
  const { data, error } = await supabase.rpc('admin_attendance_daily', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as AttendanceDailyRow[]
}

export async function getPaymentMethodBreakdown(
  range: DateRange,
): Promise<PaymentMethodBreakdownRow[]> {
  const { data, error } = await supabase.rpc('admin_payment_method_breakdown', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as PaymentMethodBreakdownRow[]
}

export async function getPlanPerformance(range: DateRange): Promise<PlanPerformanceRow[]> {
  const { data, error } = await supabase.rpc('admin_plan_performance', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as PlanPerformanceRow[]
}

export async function exportPayments(range: DateRange): Promise<PaymentExportRow[]> {
  const { data, error } = await supabase.rpc('admin_export_payments', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as PaymentExportRow[]
}

export async function exportAttendance(range: DateRange): Promise<AttendanceExportRow[]> {
  const { data, error } = await supabase.rpc('admin_export_attendance', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as AttendanceExportRow[]
}

export async function exportMemberships(range: DateRange): Promise<MembershipExportRow[]> {
  const { data, error } = await supabase.rpc('admin_export_memberships', {
    p_from: range.from,
    p_to: range.to,
  })
  if (error) throw error
  return (data ?? []) as MembershipExportRow[]
}

export function reportErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  if (/admin privileges required/i.test(message)) {
    return 'Only administrators can view reports.'
  }
  if (/date range cannot exceed/i.test(message)) {
    return `Choose a range of ${MAX_RANGE_DAYS} days or fewer.`
  }
  if (/start date must be/i.test(message)) {
    return 'The start date must be on or before the end date.'
  }
  if (/jwt|token|authentication required/i.test(message)) {
    return 'Your session expired. Please sign in again.'
  }
  if (/permission denied|row-level security/i.test(message)) {
    return 'You do not have permission to view this report.'
  }
  return message
}
