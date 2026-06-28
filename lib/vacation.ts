import { CompanySettings, Profile, VacationBalance, VacationRequest } from './types'

export interface VacationSummary {
  annualDays: number
  accrualPerMonth: number
  earnedThisYear: number
  carriedOver: number
  usedThisYear: number
  available: number
}

function monthsEmployedInYear(employmentStartDate: string, year: number, asOf: Date): number {
  const start = new Date(employmentStartDate)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)
  const effectiveStart = start > yearStart ? start : yearStart
  const effectiveEnd = asOf < yearEnd ? asOf : yearEnd

  if (effectiveStart > effectiveEnd) return 0

  const months =
    (effectiveEnd.getFullYear() - effectiveStart.getFullYear()) * 12 +
    (effectiveEnd.getMonth() - effectiveStart.getMonth()) +
    (effectiveEnd.getDate() >= effectiveStart.getDate() ? 1 : 0)

  return Math.max(0, Math.min(12, months))
}

function daysInRequest(request: VacationRequest, year: number): number {
  const start = new Date(request.start_date)
  const end = new Date(request.end_date)
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31)

  const effectiveStart = start > yearStart ? start : yearStart
  const effectiveEnd = end < yearEnd ? end : yearEnd

  if (effectiveStart > effectiveEnd) return 0

  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / msPerDay) + 1
}

export function calculateVacationSummary(
  profile: Profile,
  settings: CompanySettings,
  balance: VacationBalance | null,
  approvedVacationRequestsThisYear: VacationRequest[],
  year: number = new Date().getFullYear(),
  asOf: Date = new Date()
): VacationSummary {
  const annualDays = settings.annual_vacation_days
  const accrualPerMonth = annualDays / 12

  const months = monthsEmployedInYear(profile.employment_start_date, year, asOf)
  const earnedThisYear = Math.round(accrualPerMonth * months * 100) / 100

  const carriedOver = Math.min(balance?.carried_over_days ?? 0, settings.max_carryover_days)
  const manualAdjustment = balance?.manual_adjustment ?? 0

  const usedThisYear = approvedVacationRequestsThisYear
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + daysInRequest(r, year), 0)

  const available = Math.round((carriedOver + earnedThisYear + manualAdjustment - usedThisYear) * 100) / 100

  return { annualDays, accrualPerMonth, earnedThisYear, carriedOver, usedThisYear, available }
}
