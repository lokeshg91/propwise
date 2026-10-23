/**
 * v0.9.0 release checks (Phase 9 Stage 5): the v0.8.0 release checks
 * extended to saved data v6 — rule versions, workspace settings, settings
 * history, backups and restore — on a fresh install and after settings
 * changes and a backup round trip.
 */
import { chargeState, graceFor, paymentsByCharge } from '@/data/domain/finance-rules'
import { addRuleVersion, updateCurrency, updatePaymentTerms, updateRegion } from '@/data/services'
import { createBackup, restoreBackup, serializeBackup } from '@/data/services/backup-service'
import { readDatabase, resetDemoData, SCHEMA_VERSION, type DemoDatabase } from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { reconcileFinance } from '@/data/store/finance-reconcile'
import { STORAGE_KEYS } from '@/lib/storage'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => vi.useRealTimers())

function expectSound(db: DemoDatabase, today: string) {
  expect(checkFinanceIntegrity(db)).toEqual([])
  const fees = new Map<string, number>()
  for (const charge of db.charges) if (charge.parentChargeId) fees.set(charge.parentChargeId, (fees.get(charge.parentChargeId) ?? 0) + 1)
  expect([...fees.values()].every((count) => count === 1)).toBe(true)
  const copy = structuredClone(db)
  for (let run = 0; run < 3; run += 1) expect(reconcileFinance(copy, { today, now: new Date().toISOString() }).changed).toBe(false)
  expect(copy).toEqual(db)
}

/** Status, balance, days overdue and paid-late for every charge, under the rule in force on its due date. */
function derivedStates(db: DemoDatabase) {
  const payments = paymentsByCharge(db.payments)
  return db.charges.map((charge) => {
    const state = chargeState(charge, payments.get(charge.id), TODAY, graceFor(db.finance, charge))
    return [charge.id, state.status, state.balanceCents, state.daysOverdue, state.status === 'paid' && state.paidLate]
  })
}

describe('v0.9.0 release: fresh install', () => {
  it('is saved data v6 with one rule version equal to the v0.8 rule, default settings and no history', () => {
    const db = readDatabase()
    expect(SCHEMA_VERSION).toBe(6)
    expect(db.version).toBe(6)
    expect(db.finance.rules).toHaveLength(1)
    expect(db.finance.rules[0]).toMatchObject({ effectiveFrom: `${db.finance.startPeriod}-01`, graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 } })
    expect(db.finance).toMatchObject({ currency: 'USD', locale: 'en-US', paymentTermsDays: 30 })
    expect(db.settingsEvents).toEqual([])
    expectSound(db, TODAY)
  })
})

describe('v0.9.0 release: settings changes', () => {
  it('relabels currency and region, adds a future rule version and terms, logs each change, and leaves every record and derived state unchanged', async () => {
    const before = readDatabase()
    const records = structuredClone({ charges: before.charges, payments: before.payments, expenses: before.expenses })
    const states = derivedStates(before)

    await updateCurrency('EUR')
    await updateRegion('en-GB')
    await updatePaymentTerms(45)
    await addRuleVersion({ effectiveFrom: '2026-11-01', graceDays: 7, residentialCents: 7500, commercialPercent: 6 })

    const after = readDatabase()
    expect(after.finance).toMatchObject({ currency: 'EUR', locale: 'en-GB', paymentTermsDays: 45 })
    expect(after.finance.rules.map((rule) => rule.effectiveFrom)).toEqual([`${after.finance.startPeriod}-01`, '2026-11-01'])
    expect(after.settingsEvents).toHaveLength(4)
    // Relabel only: no amount, date or record changes; charges already due keep their rule.
    expect({ charges: after.charges, payments: after.payments, expenses: after.expenses }).toEqual(records)
    expect(derivedStates(after)).toEqual(states)
    expectSound(after, TODAY)
  })
})

describe('v0.9.0 release: backup and restore', () => {
  it('restores a backup of a changed workspace exactly, and the result is sound', async () => {
    await updateCurrency('EUR')
    await addRuleVersion({ effectiveFrom: '2026-12-01', graceDays: 3, residentialCents: 6000, commercialPercent: 4 })
    const original = structuredClone(readDatabase())
    const text = serializeBackup(createBackup())

    resetDemoData()
    expect(readDatabase().finance.currency).toBe('USD')
    await restoreBackup(text)
    const restored = readDatabase()
    expect(restored).toEqual(original)
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).not.toBeNull()
    expectSound(restored, TODAY)
  })
})
