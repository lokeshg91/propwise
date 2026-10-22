import { todayIso } from '@/data/domain/dates'
import { addPeriods, periodOf } from '@/data/domain/finance-schedule'
import { addDemoHistory, buildDemoRecurring } from '@/data/mock/finance-seed'
import { type DemoDatabase, type DemoDatabaseV4 } from '@/data/store/demo-store'
import { reconcileFinance } from '@/data/store/finance-reconcile'
import { DEFAULT_CURRENCY } from '@/lib/format'
import { type FinanceDemoScope, type FinanceSettings } from '@/types'

/** Months of history the seed and migration create, including the current month. */
export const FINANCE_HISTORY_MONTHS = 12

export const FIRST_REFERENCE = { income: 10001, payment: 20001, expense: 30001 } as const

export function defaultFinanceSettings(now: Date, demoScope: FinanceDemoScope): FinanceSettings {
  return {
    currency: DEFAULT_CURRENCY.currency,
    locale: DEFAULT_CURRENCY.locale,
    startPeriod: addPeriods(periodOf(todayIso(now)), -(FINANCE_HISTORY_MONTHS - 1)),
    graceDays: 5,
    lateFee: { residentialCents: 5000, commercialPercent: 5 },
    paymentTermsDays: 30,
    demoScope,
    createdAt: now.toISOString(),
  }
}

/**
 * v4 → v5: adds Finance. Every v4 collection is carried over untouched; only
 * new collections, finance settings and three sequence counters are added.
 * Rent and recurring charges come from reconciliation; fictional payments,
 * fees and bills are added only for records in `demoScope`.
 */
export function upgradeToV5(v4: DemoDatabaseV4, now: Date, demoScope: FinanceDemoScope): DemoDatabase {
  const db: DemoDatabase = {
    ...v4,
    version: 5,
    sequences: { ...v4.sequences, ...FIRST_REFERENCE },
    charges: [],
    payments: [],
    expenses: [],
    recurringCharges: [],
    financeEvents: [],
    finance: defaultFinanceSettings(now, demoScope),
  }
  const context = { today: todayIso(now), now: now.toISOString() }
  db.recurringCharges = buildDemoRecurring(db, context.now)
  reconcileFinance(db, context)
  addDemoHistory(db, context.today, context.now)
  return db
}
