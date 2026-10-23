import { todayIso } from '@/data/domain/dates'
import { RULE_LIMITS, ruleFor, ruleProblems, sameRule } from '@/data/domain/finance-rules'
import { isSupportedCurrency } from '@/data/domain/money'
import { createId, peekDatabase, readDatabase, subscribeDatabase, updateDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { APP_VERSION } from '@/lib/app-version'
import { createFormatters, DEFAULT_FORMAT, type Formatters } from '@/lib/formatters'
import {
  REPORT_RANGE_PRESETS,
  type AppSettings,
  type FinanceRule,
  type FinanceRuleVersion,
  type ReportRangePreset,
  type SettingsEvent,
  type SettingsSection,
} from '@/types'

/**
 * Workspace settings (Phase 9): currency, region, bill payment terms, the
 * effective-dated rent and late-fee rules and workspace preferences. One
 * place for every setting; every change is a transaction with an entry in
 * the settings history, and a failed save changes nothing.
 */

/** Currencies offered in Settings: two decimal places each (Finance stores cents). */
export const CURRENCY_OPTIONS = [
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'AED', name: 'UAE dirham' },
  { code: 'SAR', name: 'Saudi riyal' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish złoty' },
  { code: 'CNY', name: 'Chinese yuan' },
] as const

/** Regions offered in Settings. English throughout; the region sets number, currency and date formats. */
export const REGION_OPTIONS = [
  { locale: 'en-US', name: 'United States' },
  { locale: 'en-GB', name: 'United Kingdom' },
  { locale: 'en-CA', name: 'Canada' },
  { locale: 'en-AU', name: 'Australia' },
  { locale: 'en-NZ', name: 'New Zealand' },
  { locale: 'en-IE', name: 'Ireland' },
  { locale: 'en-IN', name: 'India' },
  { locale: 'en-SG', name: 'Singapore' },
  { locale: 'en-ZA', name: 'South Africa' },
  { locale: 'en-AE', name: 'United Arab Emirates' },
  { locale: 'en-150', name: 'Europe' },
] as const

/** How report period presets read in Settings and in the history. */
export const REPORT_RANGE_LABELS: Record<ReportRangePreset, string> = {
  'this-month': 'This month',
  'last-month': 'Last month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  ytd: 'Year to date',
  'last-year': 'Last calendar year',
}

export const currencyName = (code: string) => CURRENCY_OPTIONS.find((option) => option.code === code)?.name ?? code
export const regionName = (locale: string) => REGION_OPTIONS.find((option) => option.locale === locale)?.name ?? locale

/** How Settings explains a currency change (also used in the history entry). */
export const CURRENCY_CHANGE_NOTE =
  'Existing amounts are relabelled, not converted: no exchange rate is applied and no record is changed. Activity history keeps the text it was written with. The Dashboard keeps its fixed sample figures in US dollars.'

/* ------------------------------------------------------------- formatting */

/**
 * Formatters for the app shell (`SettingsProvider`). Synchronous and never
 * loads the data: before a page has loaded it, the defaults (USD, en-US)
 * apply. Returns the same object while the settings are unchanged.
 */
export function readFormatters(): Formatters {
  const db = peekDatabase()
  return createFormatters(db ? { currency: db.finance.currency, locale: db.finance.locale } : DEFAULT_FORMAT)
}

export const subscribeSettings = subscribeDatabase

/* ------------------------------------------------------------------ reads */

export interface WorkspaceSettings {
  currency: string
  currencyName: string
  locale: string
  regionName: string
  paymentTermsDays: number
  /** First month Finance tracks. */
  startPeriod: string
  /** Every rule version, oldest first. */
  rules: FinanceRuleVersion[]
  /** The version in force today. */
  currentRule: FinanceRuleVersion
  /** Versions that start after today. */
  upcomingRules: FinanceRuleVersion[]
  appSettings: AppSettings
  /** Newest first. */
  events: SettingsEvent[]
  appVersion: string
}

function settingsOf(db: DemoDatabase, today = todayIso()): WorkspaceSettings {
  return {
    currency: db.finance.currency,
    currencyName: currencyName(db.finance.currency),
    locale: db.finance.locale,
    regionName: regionName(db.finance.locale),
    paymentTermsDays: db.finance.paymentTermsDays,
    startPeriod: db.finance.startPeriod,
    rules: db.finance.rules,
    currentRule: ruleFor(db.finance, today),
    upcomingRules: db.finance.rules.filter((rule) => rule.effectiveFrom > today),
    appSettings: db.appSettings,
    events: [...db.settingsEvents].reverse(),
    appVersion: APP_VERSION,
  }
}

export function getSettings(): Promise<WorkspaceSettings> {
  return simulateLatency(settingsOf(readDatabase()))
}

/* ----------------------------------------------------------------- writes */

/**
 * Validates and applies a change in one transaction. The mutation returns
 * false when nothing would change; then nothing is written and no history
 * entry is added.
 */
function run(mutation: (db: DemoDatabase, now: string) => boolean): Promise<WorkspaceSettings> {
  try {
    const now = new Date().toISOString()
    if (!mutation(structuredClone(readDatabase()), now)) return simulateLatency(settingsOf(readDatabase()))
    const result = updateDatabase((db) => {
      mutation(db, now)
      return settingsOf(db)
    })
    return simulateLatency(result, 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

function record(db: DemoDatabase, now: string, event: Omit<SettingsEvent, 'id' | 'createdAt'>) {
  db.settingsEvents.push({ id: createId('sev'), ...event, createdAt: now })
}

const describeRule = (rule: FinanceRule, money: (cents: number) => string) =>
  `${rule.graceDays} grace ${rule.graceDays === 1 ? 'day' : 'days'}, residential ${money(rule.lateFee.residentialCents)}, commercial ${rule.lateFee.commercialPercent}%`

/** Changes the currency on a transaction draft (also used by `updateFinanceSettings`). */
export function applyCurrency(db: DemoDatabase, code: string, now: string): boolean {
  const currency = code.trim().toUpperCase()
  if (!isSupportedCurrency(currency)) throw new ServiceError('invalid', 'Choose a currency with two decimal places, e.g. USD, EUR or GBP.', 'currency')
  if (currency === db.finance.currency) return false
  const before = db.finance.currency
  db.finance.currency = currency
  record(db, now, {
    section: 'finance',
    title: 'Currency changed',
    description: CURRENCY_CHANGE_NOTE,
    before: `${currencyName(before)} (${before})`,
    after: `${currencyName(currency)} (${currency})`,
  })
  return true
}

/** Changes the region on a transaction draft (also used by `updateFinanceSettings`). */
export function applyRegion(db: DemoDatabase, locale: string, now: string): boolean {
  let resolved: string
  try {
    resolved = new Intl.NumberFormat(locale, { style: 'currency', currency: db.finance.currency }).resolvedOptions().locale
  } catch {
    throw new ServiceError('invalid', 'Choose a valid region, e.g. en-US.', 'locale')
  }
  if (resolved !== locale) throw new ServiceError('invalid', 'Choose a valid region, e.g. en-US.', 'locale')
  if (locale === db.finance.locale) return false
  const before = db.finance.locale
  db.finance.locale = locale
  record(db, now, { section: 'general', title: 'Region changed', description: 'Number, currency and date formats follow the region.', before: regionName(before), after: regionName(locale) })
  return true
}

/** Workspace currency, from the currencies offered in Settings. Amounts are relabelled, never converted. */
export function updateCurrency(code: string): Promise<WorkspaceSettings> {
  return run((db, now) => {
    if (!CURRENCY_OPTIONS.some((option) => option.code === code.trim().toUpperCase())) throw new ServiceError('invalid', 'Choose one of the listed currencies.', 'currency')
    return applyCurrency(db, code, now)
  })
}

/** Workspace region, from the regions offered in Settings. */
export function updateRegion(locale: string): Promise<WorkspaceSettings> {
  return run((db, now) => {
    if (!REGION_OPTIONS.some((option) => option.locale === locale)) throw new ServiceError('invalid', 'Choose one of the listed regions.', 'locale')
    return applyRegion(db, locale, now)
  })
}

/** Default days from bill date to due date for new bills (existing bills keep their due dates). */
export function updatePaymentTerms(days: number): Promise<WorkspaceSettings> {
  return run((db, now) => {
    const { min, max } = RULE_LIMITS.paymentTermsDays
    if (!Number.isInteger(days) || days < min || days > max) throw new ServiceError('invalid', `Enter a whole number of days from ${min} to ${max}.`, 'paymentTermsDays')
    if (days === db.finance.paymentTermsDays) return false
    const before = db.finance.paymentTermsDays
    db.finance.paymentTermsDays = days
    record(db, now, { section: 'finance', title: 'Bill payment terms changed', description: 'Applies to new bills. Existing bills keep their due dates.', before: `${before} days`, after: `${days} days` })
    return true
  })
}

export function updateGeneralSettings(input: Pick<AppSettings, 'defaultReportRange'>): Promise<WorkspaceSettings> {
  return run((db, now) => {
    if (!(REPORT_RANGE_PRESETS as readonly string[]).includes(input.defaultReportRange)) throw new ServiceError('invalid', 'Choose a report period.', 'defaultReportRange')
    if (input.defaultReportRange === db.appSettings.defaultReportRange) return false
    const before = db.appSettings.defaultReportRange
    db.appSettings = { ...db.appSettings, defaultReportRange: input.defaultReportRange as ReportRangePreset }
    record(db, now, { section: 'general', title: 'Default report period changed', description: 'Reports open with this period.', before: REPORT_RANGE_LABELS[before], after: REPORT_RANGE_LABELS[input.defaultReportRange as ReportRangePreset] })
    return true
  })
}

export interface RuleVersionInput {
  /** First due date the rule applies to: today or later. */
  effectiveFrom: string
  graceDays: number
  residentialCents: number
  commercialPercent: number
}

const RULE_FIELDS: Array<[string, keyof RuleVersionInput]> = [
  ['grace days', 'graceDays'],
  ['residential fee', 'residentialCents'],
  ['commercial percentage', 'commercialPercent'],
]

/**
 * Adds a rule version. It applies to charges due on or after `effectiveFrom`,
 * which can't be earlier than today: charges already due, and late fees
 * already added, keep the rule they had. Versions are never edited or
 * removed; a later version replaces an earlier one from its start date.
 */
export function addRuleVersion(input: RuleVersionInput): Promise<WorkspaceSettings> {
  return run((db, now) => {
    const today = todayIso()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.effectiveFrom) || Number.isNaN(Date.parse(input.effectiveFrom))) throw new ServiceError('invalid', 'Enter a start date.', 'effectiveFrom')
    if (input.effectiveFrom < today) throw new ServiceError('invalid', 'Choose today or a later date. Charges already due keep the rule they had.', 'effectiveFrom')
    if (db.finance.rules.some((rule) => rule.effectiveFrom === input.effectiveFrom)) throw new ServiceError('conflict', 'A rule version already starts on that date.', 'effectiveFrom')
    const rule: FinanceRule = { graceDays: input.graceDays, lateFee: { residentialCents: input.residentialCents, commercialPercent: input.commercialPercent } }
    const problems = ruleProblems(rule)
    if (problems.length > 0) {
      const [first] = problems
      const field = RULE_FIELDS.find(([label]) => first?.includes(label))?.[1]
      throw new ServiceError('invalid', `Check the values: ${problems.join('; ')}.`, field)
    }
    const inForce = ruleFor(db.finance, input.effectiveFrom)
    if (sameRule(inForce, rule)) throw new ServiceError('invalid', 'These are the values already in force on that date.')
    const version: FinanceRuleVersion = { id: createId('rule'), effectiveFrom: input.effectiveFrom, ...rule, createdAt: now }
    db.finance.rules = [...db.finance.rules, version].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))
    const format = createFormatters({ currency: db.finance.currency, locale: db.finance.locale })
    const money = (cents: number) => format.money(cents)
    record(db, now, {
      section: 'rules' satisfies SettingsSection,
      title: 'Rent and late-fee rule added',
      description: `Applies to rent due on or after ${format.date(input.effectiveFrom)}. Charges due earlier and late fees already added are unchanged.`,
      before: describeRule(inForce, money),
      after: describeRule(rule, money),
    })
    return true
  })
}
