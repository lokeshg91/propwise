import { chargeState, lateFeeBlock, paymentsByCharge, ruleFor, suggestedLateFeeCents } from '@/data/domain/finance-rules'
import { recordPayment } from '@/data/services'
import {
  getStorageStatus,
  isPersistenceSuspended,
  isStorageError,
  migrateDatabase,
  migrationHooks,
  parseStoredDatabase,
  readDatabase,
  resetDemoData,
  savedDataVersion,
  SCHEMA_VERSION,
  serializeDatabase,
  type DemoDatabase,
  type DemoDatabaseV5,
} from '@/data/store/demo-store'
import { assertSameFinanceOutcomes, checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { DEFAULT_APP_SETTINGS, INITIAL_RULE_ID } from '@/data/store/finance-upgrade'
import { STORAGE_KEYS } from '@/lib/storage'

/**
 * Phase 9 Stage 1: the v5 → v6 upgrade. v5 is what v0.8.0 saves (inline
 * grace days and late fee); v6 keeps them as the first rule version and adds
 * workspace settings. The upgrade may reshape settings only: every record is
 * kept byte for byte, and every charge keeps its status and late-fee outcome.
 */

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const RECORD_KEYS = [
  'properties',
  'units',
  'events',
  'tenants',
  'leases',
  'tenantEvents',
  'vendors',
  'vendorEvents',
  'serviceRequests',
  'workOrders',
  'maintenanceEvents',
  'charges',
  'payments',
  'expenses',
  'recurringCharges',
  'financeEvents',
  'sequences',
] as const

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)

/** The same workspace as v0.8.0 saves it (v5): inline rule, no workspace settings. */
function toV5(db: DemoDatabase, rule = db.finance.rules[0]): DemoDatabaseV5 {
  const copy = structuredClone(db) as unknown as Record<string, unknown>
  delete copy.appSettings
  delete copy.settingsEvents
  delete copy.account
  delete copy.staff
  delete copy.staffEvents
  delete copy.notifications
  delete copy.notificationsCheckedAt
  const { rules: _rules, ...finance } = db.finance
  void _rules
  copy.finance = { ...structuredClone(finance), graceDays: rule?.graceDays, lateFee: structuredClone(rule?.lateFee) }
  copy.version = 5
  return copy as unknown as DemoDatabaseV5
}

/** v0.8.0 stores v5 in the same column format; the shared encoder writes it as-is. */
const storeV5 = (v5: DemoDatabaseV5) => window.localStorage.setItem(STORAGE_KEYS.demoData, serializeDatabase(v5 as unknown as DemoDatabase))

/** A v5 workspace with work done in v0.8: partial and late payments, a late fee, a user bill and changed rules. */
async function userV5(rule?: { graceDays: number; lateFee: { residentialCents: number; commercialPercent: number } }): Promise<DemoDatabaseV5> {
  const db = readDatabase()
  const charge = db.charges.find((entry) => entry.category === 'rent' && !entry.voidedAt && entry.dueDate < TODAY && !entry.demo) ?? db.charges.find((entry) => entry.category === 'rent' && !entry.voidedAt && entry.dueDate <= TODAY)
  if (charge) await recordPayment(charge.id, { amountCents: 1234, receivedOn: TODAY, method: 'bank-transfer' }).catch(() => undefined)
  const v5 = toV5(readDatabase())
  if (rule) Object.assign(v5.finance, structuredClone(rule))
  resetDemoData()
  return v5
}

describe('v5 → v6 upgrade (then v6 → v7)', () => {
  it('keeps every record byte for byte and only reshapes settings', async () => {
    const v5 = await userV5()
    const v6 = migrateDatabase(structuredClone(v5), NOW)
    expect(v6.version).toBe(7)
    for (const key of RECORD_KEYS) expect(JSON.stringify(v6[key])).toBe(JSON.stringify(v5[key]))
    const { graceDays, lateFee, ...rest } = v5.finance
    const { rules, ...after } = v6.finance
    expect(after).toEqual(rest)
    expect(rules).toEqual([
      { id: INITIAL_RULE_ID, effectiveFrom: `${v5.finance.startPeriod}-01`, graceDays, lateFee, createdAt: v5.finance.createdAt },
    ])
    expect(v6.appSettings).toEqual(DEFAULT_APP_SETTINGS)
    expect(v6.settingsEvents).toEqual([])
    expect(Object.keys(v6).sort()).toEqual([...Object.keys(v5), 'appSettings', 'settingsEvents', 'account', 'staff', 'staffEvents', 'notifications', 'notificationsCheckedAt'].sort())
    expect(checkFinanceIntegrity(v6)).toEqual([])
  })

  it('carries changed v0.8 rule values over exactly', async () => {
    const custom = { graceDays: 9, lateFee: { residentialCents: 7550, commercialPercent: 3 } }
    const v5 = await userV5(custom)
    const v6 = migrateDatabase(structuredClone(v5), NOW)
    expect(v6.finance.rules).toHaveLength(1)
    expect(v6.finance.rules[0]).toMatchObject(custom)
  })

  it('keeps every charge’s status, balance, lateness and late-fee outcome', async () => {
    for (const custom of [undefined, { graceDays: 0, lateFee: { residentialCents: 0, commercialPercent: 0 } }, { graceDays: 31, lateFee: { residentialCents: 100000, commercialPercent: 25 } }]) {
      const v5 = await userV5(custom)
      const v6 = migrateDatabase(structuredClone(v5), NOW)
      const payments = paymentsByCharge(v6.payments)
      const types = new Map(v6.properties.map((property) => [property.id, property.type]))
      const fees = new Set(v6.charges.map((charge) => charge.parentChargeId).filter(Boolean))
      for (const charge of v6.charges) {
        const before = chargeState(charge, payments.get(charge.id), TODAY, v5.finance.graceDays)
        const rule = ruleFor(v6.finance, charge.dueDate)
        expect(chargeState(charge, payments.get(charge.id), TODAY, rule.graceDays)).toEqual(before)
        expect(lateFeeBlock(charge, before, TODAY, rule.graceDays, fees.has(charge.id))).toEqual(lateFeeBlock(charge, before, TODAY, v5.finance.graceDays, fees.has(charge.id)))
        const type = types.get(charge.propertyId) ?? 'residential'
        expect(suggestedLateFeeCents(charge, type, rule)).toBe(suggestedLateFeeCents(charge, type, v5.finance))
      }
      expect(() => assertSameFinanceOutcomes(v5, v6, TODAY)).not.toThrow()
    }
  })

  it('refuses an upgrade whose outcomes would differ', async () => {
    const v5 = await userV5()
    const v6 = migrateDatabase(structuredClone(v5), NOW)
    v6.finance.rules = [{ ...(v6.finance.rules[0] as DemoDatabase['finance']['rules'][number]), graceDays: 0 }]
    expect(() => assertSameFinanceOutcomes(v5, v6, TODAY)).toThrow(/outcomes changed/)
  })

  it('saves v6 in column format once and reloads without upgrading again', async () => {
    storeV5(await userV5())
    const first = readDatabase()
    const raw = stored() ?? ''
    expect(JSON.parse(raw)).toMatchObject({ version: 7, encoding: 'columns-1' })
    expect(savedDataVersion(parseStoredDatabase(raw))).toBe(7)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(readDatabase()).toEqual(first)
    expect(stored()).toBe(raw)
  })

  it('is idempotent and deterministic', async () => {
    const v5 = await userV5()
    const once = migrateDatabase(structuredClone(v5), NOW)
    expect(migrateDatabase(structuredClone(once), NOW)).toEqual(once)
    expect(migrateDatabase(structuredClone(v5), NOW)).toEqual(once)
  })

  it('rolls back on failure: stored v5 data untouched and the session read-only', async () => {
    storeV5(await userV5())
    const before = stored()
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated failure')
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    readDatabase()
    expect(stored()).toBe(before)
    expect(isPersistenceSuspended()).toBe(true)
    expect(getStorageStatus().mode).toBe('suspended')
    const charge = readDatabase().charges.find((entry) => entry.dueDate <= TODAY && !entry.voidedAt) as DemoDatabase['charges'][number]
    const error = await recordPayment(charge.id, { amountCents: 100, receivedOn: TODAY, method: 'cash' }).then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(isStorageError(error) && error.code).toBe('suspended')
    expect(stored()).toBe(before)

    migrationHooks.beforeCommit = () => undefined
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, before ?? '')
    expect(readDatabase().version).toBe(SCHEMA_VERSION)
    expect(isPersistenceSuspended()).toBe(false)
  })

  it('refuses v5 data whose rule is invalid, leaving it untouched', async () => {
    const v5 = await userV5()
    v5.finance.graceDays = -3
    expect(() => migrateDatabase(structuredClone(v5), NOW)).toThrow(/integrity/)
    storeV5(v5)
    const before = stored()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    readDatabase()
    expect(stored()).toBe(before)
    expect(isPersistenceSuspended()).toBe(true)
  })

  it('leaves data from a newer version alone', () => {
    const newer = { ...structuredClone(readDatabase()), version: SCHEMA_VERSION + 1 }
    resetDemoData()
    const raw = JSON.stringify(newer)
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    readDatabase()
    // Unknown data isn't migrated or overwritten by loading.
    expect(stored()).toBe(raw)
  })
})

describe('fresh installation (v7)', () => {
  it('starts with one rule version from the first Finance month and default workspace settings', () => {
    const db = readDatabase()
    expect(db.version).toBe(7)
    expect(db.finance.rules).toEqual([
      { id: INITIAL_RULE_ID, effectiveFrom: `${db.finance.startPeriod}-01`, graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 }, createdAt: db.finance.createdAt },
    ])
    expect(db.appSettings).toEqual(DEFAULT_APP_SETTINGS)
    expect(db.settingsEvents).toEqual([])
    expect(checkFinanceIntegrity(db)).toEqual([])
  })

  it('matches the records v0.8 created for a fresh workspace (same seed, same rule)', () => {
    // A v0.8 fresh install is the v5 shape of this; the upgrade must map it back exactly.
    const db = readDatabase()
    const roundTrip = migrateDatabase(toV5(structuredClone(db)), NOW)
    expect(roundTrip).toEqual(db)
  })
})

describe('integrity checks for settings', () => {
  const issuesWith = (change: (db: DemoDatabase) => void) => {
    const db = structuredClone(readDatabase())
    change(db)
    return checkFinanceIntegrity(db)
  }
  const rule = (db: DemoDatabase) => db.finance.rules[0] as DemoDatabase['finance']['rules'][number]

  it('flags a missing, duplicated, unordered or invalid rule history', () => {
    expect(issuesWith((db) => (db.finance.rules = []))).toEqual(['finance settings: no rule version'])
    expect(issuesWith((db) => db.finance.rules.push({ ...rule(db) }))).toEqual(expect.arrayContaining([expect.stringMatching(/duplicate id/), expect.stringMatching(/increasing dates/)]))
    expect(issuesWith((db) => db.finance.rules.push({ ...rule(db), id: 'rule_b', effectiveFrom: '2020-01-01' }))).toEqual([expect.stringMatching(/increasing dates/)])
    expect(issuesWith((db) => (rule(db).graceDays = 40))).toEqual([expect.stringMatching(/grace/)])
    expect(issuesWith((db) => (rule(db).effectiveFrom = '2099-01-01'))).toEqual([expect.stringMatching(/starts after Finance history begins/)])
    expect(issuesWith((db) => (db.finance.paymentTermsDays = 500))).toEqual([expect.stringMatching(/payment terms/)])
    expect(issuesWith((db) => (db.appSettings = { defaultReportRange: 'forever' as never }))).toEqual([expect.stringMatching(/report period/)])
  })
})
