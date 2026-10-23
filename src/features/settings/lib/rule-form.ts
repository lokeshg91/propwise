import { RULE_LIMITS, ruleProblems } from '@/data/domain/finance-rules'
import { type FinanceRule, type FinanceRuleVersion } from '@/types'

export interface RuleFormValues {
  effectiveFrom: string
  graceDays: string
  /** Residential fee as typed, e.g. "75.00". */
  residential: string
  /** Commercial percentage as typed, e.g. "4.5". */
  commercial: string
}

export type RuleFormErrors = Partial<Record<keyof RuleFormValues | 'form', string>>

/** "75", "75.5", "1,000.00" → cents; "0" is allowed (no fee). Null when it isn't an amount with at most 2 decimals. */
export function parseFeeCents(value: string): number | null {
  const text = value.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null
  const [whole = '0', fraction = ''] = text.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

const isCalendarDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
  return date.getFullYear() === year && date.getMonth() === (month ?? 1) - 1 && date.getDate() === day
}

/**
 * Checks the form with the same rules as the settings service (which checks
 * again when saving): a start date today or later and not already used, and
 * values within the rule limits.
 */
export function parseRuleForm(values: RuleFormValues, today: string, rules: FinanceRuleVersion[]): { value: { effectiveFrom: string; rule: FinanceRule } | null; errors: RuleFormErrors } {
  const errors: RuleFormErrors = {}
  const effectiveFrom = values.effectiveFrom.trim()
  if (!isCalendarDate(effectiveFrom)) errors.effectiveFrom = 'Enter a valid start date.'
  else if (effectiveFrom < today) errors.effectiveFrom = 'Choose today or a later date. Charges already due keep the rule they had.'
  else if (rules.some((rule) => rule.effectiveFrom === effectiveFrom)) errors.effectiveFrom = 'A rule version already starts on that date. Choose another date.'

  const graceText = values.graceDays.trim()
  const graceDays = Number(graceText)
  const { graceDays: graceLimits, residentialCents: feeLimits, commercialPercent: percentLimits } = RULE_LIMITS
  if (graceText === '' || !Number.isInteger(graceDays) || graceDays < graceLimits.min || graceDays > graceLimits.max) {
    errors.graceDays = `Enter a whole number of days from ${graceLimits.min} to ${graceLimits.max}.`
  }
  const residentialCents = parseFeeCents(values.residential)
  if (residentialCents === null || residentialCents < feeLimits.min || residentialCents > feeLimits.max) {
    errors.residential = 'Enter an amount from 0.00 to 1,000.00, with at most 2 decimals.'
  }
  const commercialText = values.commercial.trim()
  const commercialPercent = Number(commercialText)
  if (commercialText === '' || !/^\d+(\.\d{1,2})?$/.test(commercialText) || commercialPercent < percentLimits.min || commercialPercent > percentLimits.max) {
    errors.commercial = `Enter a percentage from ${percentLimits.min} to ${percentLimits.max}, with at most 2 decimals.`
  }
  if (Object.keys(errors).length > 0 || residentialCents === null) return { value: null, errors }
  const rule: FinanceRule = { graceDays, lateFee: { residentialCents, commercialPercent } }
  const problems = ruleProblems(rule)
  if (problems.length > 0) return { value: null, errors: { form: `Check the values: ${problems.join('; ')}.` } }
  return { value: { effectiveFrom, rule }, errors }
}
