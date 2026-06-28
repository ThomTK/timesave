export type Role = 'employee' | 'admin'
export type EmploymentType = 'hourly' | 'monthly'
export type EntryType = 'work' | 'sick' | 'vacation' | 'overtime'
export type RequestStatus = 'pending' | 'approved' | 'rejected'
export type BreakMode = 'auto' | 'manual'
export type Language = 'sv' | 'uk'

export interface Organization {
  id: string
  name: string
  slug: string
  org_number: string | null
  created_at: string
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: Role
  hourly_rate: number | null
  monthly_salary: number | null
  employment_type: EmploymentType
  language: Language
  active: boolean
  organization_id: string
  employment_start_date: string
  personnummer: string | null
  fortnox_employee_number: string | null
  reminder_clock_in: string | null
  reminder_clock_out: string | null
  created_at: string
}

export interface SickLeaveReport {
  id: string
  user_id: string
  organization_id: string
  start_date: string
  end_date: string | null
  note: string | null
  created_at: string
  profiles?: Profile
}

export interface VacationBalance {
  id: string
  user_id: string
  organization_id: string
  year: number
  carried_over_days: number
  manual_adjustment: number
  note: string | null
  created_at: string
}

export interface TimeEntry {
  id: string
  user_id: string
  clock_in: string
  clock_out: string | null
  break_minutes: number
  entry_type: EntryType
  note: string | null
  approved: boolean | null
  approved_by: string | null
  created_at: string
  profiles?: Profile
}

export interface CorrectionRequest {
  id: string
  entry_id: string | null
  user_id: string
  requested_clock_in: string | null
  requested_clock_out: string | null
  reason: string
  status: RequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  profiles?: Profile
  time_entries?: TimeEntry
}

export interface VacationRequest {
  id: string
  user_id: string
  start_date: string
  end_date: string
  note: string | null
  status: RequestStatus
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  profiles?: Profile
}

export interface CompanySettings {
  id: number
  organization_id: string
  break_mode: BreakMode
  auto_break_minutes: number
  reminder_clock_in: string | null
  reminder_clock_out: string | null
  annual_vacation_days: number
  vacation_pay_percent: number
  max_carryover_days: number
  updated_at: string
}

export interface OvertimeRule {
  id: number
  organization_id: string
  day_of_week: number | null
  specific_date: string | null
  start_time: string
  end_time: string
  label: string | null
  created_at: string
}
