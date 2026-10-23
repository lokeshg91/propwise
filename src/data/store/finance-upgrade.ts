import { todayIso } from '@/data/domain/dates'
import { addPeriods, firstDayOf, periodOf } from '@/data/domain/finance-schedule'
import { addDemoHistory, buildDemoRecurring } from '@/data/mock/finance-seed'
import { type DemoDatabase, type DemoDatabaseV4, type DemoDatabaseV5 } from '@/data/store/demo-store'
import { reconcileFinance } from '@/data/store/finance-reconcile'
import { DEFAULT_CURRENCY } from '@/lib/format'
import { type AppSettings, type FinanceDemoScope, type FinanceRule, type FinanceRuleVersion, type FinanceSettings } from '@/types'

/** Months of history the seed and migration create, including the current month. */
export const FINANCE_HISTORY_MONTHS = 12

export const FIRST_REFERENCE = { income: 10001, payment: 20001, expense: 30001 } as const

/** The v0.8 rule values: residential $50.00, commercial 5 % of the full rent charge, 5 grace days. */
export const DEFAULT_RULE: FinanceRule = { graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 } }

/** Id of the rule version every workspace starts with (fixed, so upgrades are idempotent). */
export const INITIAL_RULE_ID = 'rule_initial'

export const DEFAULT_APP_SETTINGS: AppSettings = { defaultReportRange: '12m' }

/** The first rule version: in force from the first day Finance tracks. */
export function initialRule(startPeriod: string, rule: FinanceRule, createdAt: string): FinanceRuleVersion {
  return { id: INITIAL_RULE_ID, effectiveFrom: firstDayOf(startPeriod), graceDays: rule.graceDays, lateFee: { ...rule.lateFee }, createdAt }
}

export function defaultFinanceSettings(now: Date, demoScope: FinanceDemoScope): FinanceSettings {
  const startPeriod = addPeriods(periodOf(todayIso(now)), -(FINANCE_HISTORY_MONTHS - 1))
  return {
    currency: DEFAULT_CURRENCY.currency,
    locale: DEFAULT_CURRENCY.locale,
    startPeriod,
    rules: [initialRule(startPeriod, DEFAULT_RULE, now.toISOString())],
    paymentTermsDays: 30,
    demoScope,
    createdAt: now.toISOString(),
  }
}

/**
 * v4 → current: adds Finance (and the v6 settings). Every v4 collection is
 * carried over untouched; only new collections, finance settings and three
 * sequence counters are added. Rent and recurring charges come from
 * reconciliation; fictional payments, fees and bills are added only for
 * records in `demoScope`. With the single initial rule version this produces
 * exactly the records v0.8 produced in its v4 → v5 step.
 */
export function addFinance(v4: DemoDatabaseV4, now: Date, demoScope: FinanceDemoScope): DemoDatabase {
  const db: DemoDatabase = {
    ...v4,
    version: 6,
    sequences: { ...v4.sequences, ...FIRST_REFERENCE },
    charges: [],
    payments: [],
    expenses: [],
    recurringCharges: [],
    financeEvents: [],
    finance: defaultFinanceSettings(now, demoScope),
    appSettings: { ...DEFAULT_APP_SETTINGS },
    settingsEvents: [],
  }
  const context = { today: todayIso(now), now: now.toISOString() }
  db.recurringCharges = buildDemoRecurring(db, context.now)
  reconcileFinance(db, context)
  addDemoHistory(db, context.today, context.now)
  return db
}

/**
 * v5 → v6 (Phase 9): a pure reshaping. The inline grace days and late fee
 * become the first rule version (in force from the first day of Finance
 * history, created when Finance was), and workspace settings and the
 * settings history are added. Every record collection, the sequences and
 * every other setting are copied unchanged.
 */
export function upgradeToV6(v5: DemoDatabaseV5): DemoDatabase {
  const { graceDays, lateFee, ...finance } = v5.finance
  return {
    ...v5,
    version: 6,
    finance: { ...finance, rules: [initialRule(finance.startPeriod, { graceDays, lateFee }, finance.createdAt)] },
    appSettings: { ...DEFAULT_APP_SETTINGS },
    settingsEvents: [],
  }
}
