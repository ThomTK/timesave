import { OvertimeRule, TimeEntry } from './types'

function combineDateAndTime(dateStr: string, timeStr: string): Date {
  return new Date(`${dateStr}T${timeStr}`)
}

function rangeOverlapMinutes(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = aStart > bStart ? aStart : bStart
  const end = aEnd < bEnd ? aEnd : bEnd
  const ms = end.getTime() - start.getTime()
  return ms > 0 ? ms / 1000 / 60 : 0
}

function rulesForEntry(entry: TimeEntry, rules: OvertimeRule[]): OvertimeRule[] {
  const entryDate = new Date(entry.clock_in)
  const dateStr = entryDate.toISOString().slice(0, 10)
  const weekday = entryDate.getDay()

  return rules.filter(r => r.specific_date === dateStr || r.day_of_week === weekday)
}

/** Total payable "weighted hours" for one entry — 1 hour of normal work = 1, 1 hour at 2x = 2 */
export function calculateEntryPayableHours(
  entry: TimeEntry,
  overtimeMode: 'manual' | 'automatic',
  overtimeRules: OvertimeRule[]
): number {
  if (!entry.clock_out) return 0

  const clockIn = new Date(entry.clock_in)
  const clockOut = new Date(entry.clock_out)
  const totalMinutes = Math.max(0, (clockOut.getTime() - clockIn.getTime()) / 1000 / 60 - (entry.break_minutes ?? 0))

  if (overtimeMode === 'manual') {
    return (totalMinutes / 60) * (entry.pay_multiplier ?? 1)
  }

  // Automatic: split minutes by overlap with applicable overtime rules for that date
  const dateStr = clockIn.toISOString().slice(0, 10)
  const matchingRules = rulesForEntry(entry, overtimeRules)

  let overtimeMinutes = 0
  let weightedOvertimeHours = 0

  for (const rule of matchingRules) {
    const ruleStart = combineDateAndTime(dateStr, rule.start_time)
    const ruleEnd = combineDateAndTime(dateStr, rule.end_time)
    const overlap = rangeOverlapMinutes(clockIn, clockOut, ruleStart, ruleEnd)
    overtimeMinutes += overlap
    weightedOvertimeHours += (overlap / 60) * rule.pay_multiplier
  }

  const normalMinutes = Math.max(0, totalMinutes - overtimeMinutes)
  return (normalMinutes / 60) + weightedOvertimeHours
}

export function calculateEntryCost(
  entry: TimeEntry,
  hourlyRate: number,
  overtimeMode: 'manual' | 'automatic',
  overtimeRules: OvertimeRule[]
): number {
  return calculateEntryPayableHours(entry, overtimeMode, overtimeRules) * hourlyRate
}
