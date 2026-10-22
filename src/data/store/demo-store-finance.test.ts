import { addMonths } from '@/data/domain/dates'
import { addPeriods, periodOf } from '@/data/domain/finance-schedule'
import { paidCents, paymentsByCharge } from '@/data/domain/finance-rules'
import { properties as seedProperties } from '@/data/mock/properties'
import { generateSeedUnits } from '@/data/mock/units'
import { createCharge, recordPayment } from '@/data/services'
import {
  getStorageStatus,
  isPersistenceSuspended,
  isStorageError,
  levelFor,
  migrateDatabase,
  migrationHooks,
  parseStoredDatabase,
  readDatabase,
  resetDemoData,
  SCHEMA_VERSION,
  serializeDatabase,
  STORAGE_LIMIT_CHARS,
  STORAGE_THRESHOLDS,
  storageHooks,
  StorageError,
  updateDatabase,
  type DemoDatabase,
  type DemoDatabaseV1,
  type DemoDatabaseV4,
} from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { reconcileFinance, rentChargeId, workOrderBillId } from '@/data/store/finance-reconcile'
import { STORAGE_KEYS } from '@/lib/storage'
import { type Lease } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  storageHooks.limitChars = STORAGE_LIMIT_CHARS
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const FINANCE_KEYS = ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance'] as const
const V4_COLLECTIONS = ['properties', 'units', 'events', 'tenants', 'leases', 'tenantEvents', 'vendors', 'vendorEvents', 'serviceRequests', 'workOrders', 'maintenanceEvents'] as const
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const storeRaw = (value: unknown) => window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(value))

/** A Phase 7 (v4) database, as saved by v0.7.0. */
function toV4(db: DemoDatabase): DemoDatabaseV4 {
  const copy = structuredClone(db) as unknown as Record<string, unknown>
  for (const key of FINANCE_KEYS) delete copy[key]
  copy.version = 4
  copy.sequences = { request: db.sequences.request }
  return copy as unknown as DemoDatabaseV4
}

/** v4 data with things the user did in the app before upgrading. */
function userV4(): DemoDatabaseV4 {
  const v4 = toV4(readDatabase())
  resetDemoData()
  const unit = v4.units.find((entry) => entry.status === 'vacant' && !v4.leases.some((lease) => lease.unitId === entry.id && lease.status === 'active')) as DemoDatabaseV4['units'][number]
  const tenant = { ...(v4.tenants[0] as DemoDatabaseV4['tenants'][number]), id: 'ten_user1', name: 'User Created', email: 'user.created@example.com' }
  v4.tenants.push(tenant)
  const lease: Lease = {
    id: 'lease_user1',
    tenantId: tenant.id,
    propertyId: unit.propertyId,
    unitId: unit.id,
    startDate: '2026-07-01',
    endDate: '2027-06-30',
    monthlyRent: 2400,
    securityDeposit: 2400,
    paymentDueDay: 5,
    status: 'active',
    endedAt: null,
    endReason: null,
    createdAt: '2026-08-15T10:00:00.000Z',
    updatedAt: '2026-08-15T10:00:00.000Z',
  }
  v4.leases.push(lease)
  // A sample job the user completed in v0.7.
  const order = v4.workOrders.find((entry) => entry.status === 'in-progress') as DemoDatabaseV4['workOrders'][number]
  Object.assign(order, { status: 'completed', actualCost: 612.4, completedAt: '2026-10-01T15:00:00.000Z' })
  v4.properties.push({ ...(v4.properties[0] as DemoDatabaseV4['properties'][number]), id: 'prop_user1', name: 'User Plaza' })
  // A rent the user edited.
  ;(v4.leases[0] as Lease).monthlyRent = 1525
  return v4
}

describe('fresh installation (v5)', () => {
  it('seeds a consistent year of fictional finance history', () => {
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(5)
    expect(db.finance).toMatchObject({ currency: 'USD', locale: 'en-US', startPeriod: '2025-11', graceDays: 5, paymentTermsDays: 30 })
    expect(checkFinanceIntegrity(db)).toEqual([])
    // Every seeded record is marked as fictional demo data.
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges'] as const) expect(db[key].every((record) => record.demo === true)).toBe(true)
    const periods = new Set(db.charges.filter((charge) => charge.category === 'rent').map((charge) => charge.period))
    expect(periods.size).toBe(12)

    const payments = paymentsByCharge(db.payments)
    const rent = db.charges.filter((charge) => charge.category === 'rent')
    const partial = rent.filter((charge) => {
      const paid = paidCents(payments.get(charge.id))
      return paid > 0 && paid < charge.amountCents
    })
    expect(partial.length).toBeGreaterThan(0)
    expect(rent.some((charge) => !payments.has(charge.id) && charge.dueDate < TODAY)).toBe(true)
    const categories = new Set(db.charges.map((charge) => charge.category))
    expect([...categories].sort()).toEqual(['late-fee', 'other-income', 'parking', 'rent', 'service-charge'])
    expect(new Set(db.expenses.map((expense) => expense.category)).size).toBeGreaterThanOrEqual(8)
    expect(db.expenses.some((expense) => !expense.paidOn && expense.dueDate < TODAY)).toBe(true)
    expect(db.expenses.some((expense) => !expense.paidOn && expense.dueDate >= TODAY)).toBe(true)
    // Residential and commercial, a returned check and a charge voided by hand.
    const types = new Set(db.charges.map((charge) => db.properties.find((property) => property.id === charge.propertyId)?.type))
    expect(types).toEqual(new Set(['residential', 'commercial']))
    expect(db.payments.some((payment) => payment.voidedAt && payment.voidReason)).toBe(true)
    expect(db.charges.some((charge) => charge.voidedBy === 'user')).toBe(true)
    // One work-order bill per completed job with a final cost.
    const jobs = db.workOrders.filter((order) => order.status === 'completed' && order.actualCost !== null)
    expect(db.expenses.filter((expense) => expense.source === 'work-order').map((expense) => expense.id).sort()).toEqual(jobs.map((order) => workOrderBillId(order.id)).sort())
  })

  it('fits the storage budget with room to grow', () => {
    const status = getStorageStatus()
    expect(status.level).toBe('ok')
    expect(status.usage).toBeLessThan(0.35)
    // Column storage keeps the saved text far below the plain JSON size.
    expect(serializeDatabase(readDatabase()).length).toBeLessThan(JSON.stringify(readDatabase()).length * 0.5)
    expect(levelFor(STORAGE_THRESHOLDS.warning - 0.01)).toBe('ok')
    expect(levelFor(STORAGE_THRESHOLDS.warning)).toBe('warning')
    expect(levelFor(STORAGE_THRESHOLDS.critical)).toBe('critical')
  })
})

describe('Phase 7 (v4) → v5 migration', () => {
  it('keeps every Phase 2–7 record exactly and only adds Finance', () => {
    const v4 = userV4()
    const v5 = migrateDatabase(structuredClone(v4), NOW)
    for (const key of V4_COLLECTIONS) {
      expect(v5[key]).toEqual(v4[key])
      expect(JSON.stringify(v5[key])).toBe(JSON.stringify(v4[key]))
    }
    expect(v5.sequences.request).toBe(v4.sequences.request)
    expect(Object.keys(v5).sort()).toEqual([...Object.keys(v4), ...FINANCE_KEYS].sort())
    expect(checkFinanceIntegrity(v5)).toEqual([])
  })

  it('never creates fictional history for records the user created or changed', () => {
    const v5 = migrateDatabase(userV4(), NOW)
    expect(v5.finance.demoScope.leaseIds).not.toContain('lease_user1')
    expect(v5.finance.demoScope.propertyIds).not.toContain('prop_user1')
    // The user's lease is billed from the month it was recorded, with no payments.
    const charges = v5.charges.filter((charge) => charge.leaseId === 'lease_user1')
    expect(charges.map((charge) => charge.period)).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(charges.every((charge) => charge.demo === undefined)).toBe(true)
    expect(v5.payments.some((payment) => charges.some((charge) => charge.id === payment.chargeId))).toBe(false)
    expect(v5.recurringCharges.some((entry) => entry.leaseId === 'lease_user1')).toBe(false)
    // The job the user completed gets an unpaid, non-demo bill.
    const order = v5.workOrders.find((entry) => entry.actualCost === 612.4)
    const bill = v5.expenses.find((expense) => expense.id === workOrderBillId(order?.id ?? ''))
    expect(bill).toMatchObject({ amountCents: 61240 })
    expect(bill?.demo).toBeUndefined()
    expect(bill?.paidOn).toBeUndefined()
    // A property the user added gets no operating expenses or income.
    expect(v5.expenses.some((expense) => expense.propertyId === 'prop_user1')).toBe(false)
    expect(v5.charges.some((charge) => charge.propertyId === 'prop_user1')).toBe(false)
    // An edited sample lease keeps its history; posted charges use the stored rent.
    const edited = v5.leases[0] as Lease
    expect(v5.charges.find((charge) => charge.id === rentChargeId(edited.id, '2026-10'))?.amountCents).toBe(152500)
  })

  it('is idempotent and deterministic', () => {
    const v4 = userV4()
    const once = migrateDatabase(structuredClone(v4), NOW)
    expect(migrateDatabase(structuredClone(v4), NOW)).toEqual(once)
    expect(migrateDatabase(once, NOW)).toEqual(once)
    const again = structuredClone(once)
    expect(reconcileFinance(again, { today: TODAY, now: NOW.toISOString() }).changed).toBe(false)
    expect(again).toEqual(once)
  })

  it('saves once, in column format, and reloads without upgrading again', () => {
    storeRaw(userV4())
    const first = readDatabase()
    const raw = stored() ?? ''
    expect(JSON.parse(raw)).toMatchObject({ version: 5, encoding: 'columns-1' })
    expect(parseStoredDatabase(raw)).toEqual(first)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(readDatabase()).toEqual(first)
    expect(stored()).toBe(raw)
  })

  it('rolls back on failure: stored data untouched and the session clearly read-only', async () => {
    storeRaw(userV4())
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
    const error = await recordPayment(charge.id, { amountCents: 100, receivedOn: TODAY, method: 'cash' }).then(() => null, (reason: unknown) => reason)
    expect(isStorageError(error) && error.code).toBe('suspended')
    expect(stored()).toBe(before)

    // The next load retries and succeeds.
    migrationHooks.beforeCommit = () => undefined
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, before ?? '')
    expect(readDatabase().version).toBe(5)
    expect(isPersistenceSuspended()).toBe(false)
  })

  it('refuses to save an upgrade that fails the integrity check', () => {
    const v4 = userV4()
    const order = v4.workOrders.find((entry) => entry.status === 'in-progress') as DemoDatabaseV4['workOrders'][number]
    Object.assign(order, { status: 'completed', actualCost: 50, completedAt: '2026-10-02T10:00:00.000Z', vendorId: 'ven_missing' })
    expect(() => migrateDatabase(structuredClone(v4), NOW)).toThrow(/integrity/)
    storeRaw(v4)
    const before = stored()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    readDatabase()
    expect(stored()).toBe(before)
    expect(isPersistenceSuspended()).toBe(true)
  })

  it('chains v1 → v5 with consistent finance data', () => {
    const properties = structuredClone(seedProperties)
    const v1: DemoDatabaseV1 = { version: 1, properties, units: generateSeedUnits(properties), events: [] }
    storeRaw(v1)
    const db = readDatabase()
    expect(db.version).toBe(5)
    expect(db.units).toEqual(v1.units)
    expect(db.charges.length).toBeGreaterThan(1000)
    expect(checkFinanceIntegrity(db)).toEqual([])
  })
})

describe('failed saves', () => {
  it('rejects a change that would exceed the budget, keeps the previous data and reports it', async () => {
    const before = readDatabase()
    updateDatabase(() => undefined) // first save of the fresh seed
    const raw = stored()
    storageHooks.limitChars = 1000
    const lease = before.leases.find((entry) => entry.status === 'active') as Lease
    const error = await createCharge({ leaseId: lease.id, category: 'parking', description: 'x', amountCents: 2500, dueDate: TODAY }).then(() => null, (reason: unknown) => reason)
    expect(error).toBeInstanceOf(StorageError)
    expect(isStorageError(error) && error.code).toBe('over-budget')
    expect(readDatabase().charges).toHaveLength(before.charges.length)
    expect(stored()).toBe(raw)
    expect(getStorageStatus().lastError?.code).toBe('over-budget')

    // Same change after space is available: identical result, as if the failure never happened.
    storageHooks.limitChars = STORAGE_LIMIT_CHARS
    const next = readDatabase().sequences.income
    const created = await createCharge({ leaseId: lease.id, category: 'parking', description: 'x', amountCents: 2500, dueDate: TODAY })
    expect(created.reference).toBe(`INC-${next}`)
    expect(getStorageStatus().lastError).toBeNull()
  })

  it('treats a browser refusal as a failed save, never as success', async () => {
    updateDatabase(() => undefined)
    const raw = stored()
    const count = readDatabase().charges.length
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const lease = readDatabase().leases.find((entry) => entry.status === 'active') as Lease
    await expect(createCharge({ leaseId: lease.id, category: 'parking', description: 'x', amountCents: 2500, dueDate: TODAY })).rejects.toThrow(/wasn’t saved/)
    expect(readDatabase().charges).toHaveLength(count)
    expect(stored()).toBe(raw)
    expect(getStorageStatus().lastError?.code).toBe('write-failed')
  })
})

describe('a new month', () => {
  it('posts the new month on load, once, without fabricating payments', () => {
    updateDatabase(() => undefined)
    const october = stored() ?? ''
    vi.setSystemTime(new Date('2026-11-03T09:00:00'))
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, october)
    const db = readDatabase()
    const november = db.charges.filter((charge) => charge.period === '2026-11' && charge.category === 'rent')
    const active = db.leases.filter((lease) => lease.status === 'active').length
    expect(november.length).toBeGreaterThan(active - 10)
    expect(db.payments.some((payment) => november.some((charge) => charge.id === payment.chargeId))).toBe(false)
    expect(checkFinanceIntegrity(db)).toEqual([])
    const saved = stored()
    expect(saved).not.toBe(october)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, saved ?? '')
    readDatabase()
    expect(stored()).toBe(saved)
  })
})

describe('multi-year growth (simulated)', () => {
  /** Months of use, with every charge paid (worst case) or none recorded. */
  function simulate(months: number, payEverything: boolean) {
    const db = structuredClone(readDatabase())
    const sizes: number[] = [serializeDatabase(db).length]
    const counts: number[] = [db.charges.length + db.payments.length + db.expenses.length]
    for (let month = 1; month <= months; month += 1) {
      const today = addMonths(TODAY, month)
      const context = { today, now: `${today}T12:00:00.000Z` }
      reconcileFinance(db, context)
      expect(reconcileFinance(db, context).changed).toBe(false)
      if (payEverything) {
        const payments = paymentsByCharge(db.payments)
        for (const charge of db.charges) {
          if (charge.voidedAt || charge.dueDate > today) continue
          const balance = charge.amountCents - paidCents(payments.get(charge.id))
          if (balance <= 0 || charge.period !== periodOf(today)) continue
          db.payments.push({ id: `pay_sim_${charge.id}`, reference: `PAY-${db.sequences.payment++}`, chargeId: charge.id, amountCents: balance, receivedOn: charge.dueDate, method: 'bank-transfer', createdAt: context.now })
        }
      }
      sizes.push(serializeDatabase(db).length)
      counts.push(db.charges.length + db.payments.length + db.expenses.length)
    }
    expect(checkFinanceIntegrity(db)).toEqual([])
    return { sizes, counts }
  }

  it('grows predictably, never deletes records and warns long before the limit', () => {
    const worst = simulate(36, true)
    const demo = simulate(36, false)
    const usage = (chars: number) => chars / STORAGE_LIMIT_CHARS
    const firstMonth = (sizes: number[], threshold: number) => sizes.findIndex((size) => usage(size) >= threshold)
    for (const run of [worst, demo]) {
      for (let index = 1; index < run.counts.length; index += 1) {
        expect(run.counts[index]).toBeGreaterThanOrEqual(run.counts[index - 1] as number)
        expect(run.sizes[index]).toBeGreaterThanOrEqual(run.sizes[index - 1] as number)
      }
    }
    const report = (label: string, sizes: number[]) => ({
      label,
      start: sizes[0],
      perMonth: Math.round(((sizes.at(-1) as number) - (sizes[0] as number)) / (sizes.length - 1)),
      after12: sizes[12],
      after24: sizes[24],
      after36: sizes[36],
      warningMonth: firstMonth(sizes, STORAGE_THRESHOLDS.warning),
      criticalMonth: firstMonth(sizes, STORAGE_THRESHOLDS.critical),
      refuseMonth: firstMonth(sizes, STORAGE_THRESHOLDS.refuse),
    })
    const results = [report('every charge paid', worst.sizes), report('no payments recorded', demo.sizes)]
    console.info('STORAGE GROWTH', JSON.stringify(results))
    // Worst case: at least a year before the first warning; warning comes before critical, critical before refusal.
    const worstReport = results[0] as ReturnType<typeof report>
    expect(worstReport.warningMonth === -1 || worstReport.warningMonth >= 12).toBe(true)
    if (worstReport.criticalMonth !== -1) expect(worstReport.criticalMonth).toBeGreaterThan(worstReport.warningMonth)
    if (worstReport.refuseMonth !== -1) expect(worstReport.refuseMonth).toBeGreaterThan(worstReport.criticalMonth)
    expect(addPeriods('2026-10', 36)).toBe('2029-10')
  }, 120_000)
})
