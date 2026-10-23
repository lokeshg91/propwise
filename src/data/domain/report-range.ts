import { addMonths } from '@/data/domain/dates'
import { addPeriods, firstDayOf, lastDayOf, periodOf, periodRange } from '@/data/domain/finance-schedule'
import { type ReportRangePreset } from '@/types'

/**
 * Report periods (Phase 9): presets are whole calendar months, like Finance;
 * a custom range is any span of inclusive local calendar dates up to five
 * years. Months cut by a custom range are kept as partial months.
 */

export type ReportRangeSpec = { kind: 'preset'; preset: ReportRangePreset } | { kind: 'custom'; from: string; to: string }

export interface ReportMonth {
  period: string
  /** Inclusive dates of this month inside the range. */
  from: string
  to: string
  /** The range cuts this month (custom ranges only). */
  partial: boolean
}

export interface ReportWindow {
  from: string
  to: string
  months: ReportMonth[]
  spec: ReportRangeSpec
}

export const MAX_CUSTOM_YEARS = 5

const ISO = /^\d{4}-\d{2}-\d{2}$/

/** A real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isCalendarDate(value: string): boolean {
  if (!ISO.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
  return date.getFullYear() === year && date.getMonth() === (month ?? 1) - 1 && date.getDate() === day
}

export interface CustomRangeErrors {
  from?: string
  to?: string
}

/** Checks a custom range: valid dates, from ≤ to, at most five years. The end may be in the future. */
export function customRangeErrors(from: string, to: string): CustomRangeErrors {
  const errors: CustomRangeErrors = {}
  if (!isCalendarDate(from)) errors.from = 'Enter a valid start date.'
  if (!isCalendarDate(to)) errors.to = 'Enter a valid end date.'
  if (errors.from || errors.to) return errors
  if (from > to) errors.to = 'The end date can’t be before the start date.'
  else if (to >= addMonths(from, MAX_CUSTOM_YEARS * 12)) errors.to = `Choose a range of at most ${MAX_CUSTOM_YEARS} years.`
  return errors
}

function presetPeriods(preset: ReportRangePreset, today: string): [string, string] {
  const current = periodOf(today)
  switch (preset) {
    case 'this-month':
      return [current, current]
    case 'last-month':
      return [addPeriods(current, -1), addPeriods(current, -1)]
    case '3m':
      return [addPeriods(current, -2), current]
    case '6m':
      return [addPeriods(current, -5), current]
    case '12m':
      return [addPeriods(current, -11), current]
    case 'ytd':
      return [`${current.slice(0, 4)}-01`, current]
    case 'last-year': {
      const year = Number(current.slice(0, 4)) - 1
      return [`${year}-01`, `${year}-12`]
    }
  }
}

/** The dates and months a report covers. Throws for an invalid custom range (check `customRangeErrors` first). */
export function resolveReportWindow(spec: ReportRangeSpec, today: string): ReportWindow {
  if (spec.kind === 'preset') {
    const [fromPeriod, toPeriod] = presetPeriods(spec.preset, today)
    return {
      from: firstDayOf(fromPeriod),
      to: lastDayOf(toPeriod),
      months: periodRange(fromPeriod, toPeriod).map((period) => ({ period, from: firstDayOf(period), to: lastDayOf(period), partial: false })),
      spec,
    }
  }
  const errors = customRangeErrors(spec.from, spec.to)
  if (errors.from || errors.to) throw new Error(errors.from ?? errors.to)
  const months = periodRange(periodOf(spec.from), periodOf(spec.to)).map((period) => {
    const from = period === periodOf(spec.from) ? spec.from : firstDayOf(period)
    const to = period === periodOf(spec.to) ? spec.to : lastDayOf(period)
    return { period, from, to, partial: from !== firstDayOf(period) || to !== lastDayOf(period) }
  })
  return { from: spec.from, to: spec.to, months, spec }
}

export interface ReportNotices {
  /** The range starts before the first month Finance tracks: nothing earlier exists, and nothing is made up. */
  beforeHistory: boolean
  /** The range ends after today: future dates have no cash yet, and nothing is projected. */
  includesFuture: boolean
  /** Some months are cut by the range. */
  partialMonths: boolean
}

export function noticesFor(window: ReportWindow, today: string, financeStartPeriod: string): ReportNotices {
  return {
    beforeHistory: window.from < firstDayOf(financeStartPeriod),
    includesFuture: window.to > today,
    partialMonths: window.months.some((month) => month.partial),
  }
}
