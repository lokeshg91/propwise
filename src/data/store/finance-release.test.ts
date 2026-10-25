/**
 * v0.8.0 release checks for Finance integrity, on a fresh install and on an
 * upgrade from v0.7 (v4) data that includes records the user created.
 */
import { addDays } from '@/data/domain/dates'
import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { addLateFee, updateFinanceSettings, voidCharge } from '@/data/services'
import { readDatabase, resetDemoData, type DemoDatabase, type DemoDatabaseV4 } from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { reconcileFinance } from '@/data/store/finance-reconcile'
import { STORAGE_KEYS } from '@/lib/storage'
import { type Charge, type Lease } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => vi.useRealTimers())

const FINANCE_KEYS = ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance'] as const
/** Added in v6 (Phase 9); a real v4 save has none of these. */
const V6_KEYS = ['appSettings', 'settingsEvents'] as const

/** The rules every saved dataset must satisfy. */
function expectSound(db: DemoDatabase, today: string) {
  expect(checkFinanceIntegrity(db)).toEqual([])
  const charges = new Map(db.charges.map((charge) => [charge.id, charge]))
  // No payment predates its charge's issue date, and none is in the future.
  expect(db.payments.filter((payment) => payment.receivedOn < (charges.get(payment.chargeId)?.issuedOn ?? '') || payment.receivedOn > today)).toEqual([])
  // At most one late-fee record per rent charge, voided ones included.
  const fees = new Map<string, number>()
  for (const charge of db.charges) if (charge.parentChargeId) fees.set(charge.parentChargeId, (fees.get(charge.parentChargeId) ?? 0) + 1)
  expect([...fees.values()].every((count) => count === 1)).toBe(true)
  for (const parent of fees.keys()) expect(charges.get(parent)?.category).toBe('rent')
  // Reconciliation is idempotent: running it again (three times) changes nothing.
  const copy = structuredClone(db)
  for (let run = 0; run < 3; run += 1) expect(reconcileFinance(copy, { today, now: new Date().toISOString() }).changed).toBe(false)
  expect(copy).toEqual(db)
}

function toV4(db: DemoDatabase): DemoDatabaseV4 {
  const copy = structuredClone(db) as unknown as Record<string, unknown>
  for (const key of [...FINANCE_KEYS, ...V6_KEYS]) delete copy[key]
  copy.version = 4
  copy.sequences = { request: db.sequences.request }
  return copy as unknown as DemoDatabaseV4
}

describe('v0.8.0 release: final demo dataset', () => {
  it('passes every Finance integrity rule', () => {
    const db = readDatabase()
    expectSound(db, TODAY)
    expect(db.charges.length).toBeGreaterThan(4000)
    expect(db.payments.length).toBeGreaterThan(4000)
    expect(db.expenses.length).toBeGreaterThan(500)
    expect([...db.charges, ...db.payments, ...db.expenses].every((record) => record.demo === true)).toBe(true)
  })

  it('stays sound as months pass (saved, reloaded and reconciled 1, 6 and 14 months later)', async () => {
    await updateFinanceSettings({ currency: 'USD', locale: 'en-US' }) // a save, so there is stored data
    const counts = { charges: db().charges.length, payments: db().payments.length, expenses: db().expenses.length }
    for (const later of ['2026-11-12', '2027-04-12', '2027-12-12']) {
      const raw = window.localStorage.getItem(STORAGE_KEYS.demoData) ?? ''
      resetDemoData()
      window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
      vi.setSystemTime(new Date(`${later}T12:00:00`))
      const loaded = readDatabase() // loading reconciles the new months
      expectSound(loaded, later)
      // Nothing stored is ever removed.
      expect(loaded.charges.length).toBeGreaterThanOrEqual(counts.charges)
      expect(loaded.payments.length).toBe(counts.payments)
      expect(loaded.expenses.length).toBe(counts.expenses)
      await updateFinanceSettings({ currency: 'USD', locale: 'en-US' })
    }
  })

  it('keeps one late-fee record per rent charge, including after a void', async () => {
    const payments = paymentsByCharge(db().payments)
    const fees = new Set(db().charges.map((charge) => charge.parentChargeId).filter(Boolean))
    const late = db().charges.find((charge) => charge.category === 'rent' && !fees.has(charge.id) && chargeState(charge, payments.get(charge.id), TODAY).balanceCents > 0 && charge.dueDate < addDays(TODAY, -5)) as Charge
    const fee = await addLateFee(late.id)
    await voidCharge(fee.id, 'Waived')
    await expect(addLateFee(late.id)).rejects.toThrow(/Only one late fee per charge/)
    expectSound(db(), TODAY)
  })
})

describe('v0.8.0 release: upgrade from v0.7 data with user records', () => {
  it('carries every v0.7 record over, keeps user records separate from demo records, and is sound', () => {
    const v4 = toV4(readDatabase())
    // Records the user created in v0.7.
    const unit = v4.units.find((entry) => entry.status === 'vacant' && !v4.leases.some((lease) => lease.unitId === entry.id && (lease.status === 'active' || lease.status === 'pending'))) as DemoDatabaseV4['units'][number]
    v4.tenants.push({ ...(v4.tenants[0] as DemoDatabaseV4['tenants'][number]), id: 'ten_user_release', name: 'Release Tenant', email: 'release.tenant@example.com' })
    const lease: Lease = {
      id: 'lease_user_release',
      tenantId: 'ten_user_release',
      propertyId: unit.propertyId,
      unitId: unit.id,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      monthlyRent: 2100,
      securityDeposit: 2100,
      paymentDueDay: 1,
      status: 'active',
      endedAt: null,
      endReason: null,
      createdAt: '2026-06-01T10:00:00.000Z',
      updatedAt: '2026-06-01T10:00:00.000Z',
    }
    v4.leases.push(lease)
    const order = v4.workOrders.find((entry) => entry.status === 'in-progress') as DemoDatabaseV4['workOrders'][number]
    Object.assign(order, { status: 'completed', actualCost: 640.25, completedAt: '2026-10-05T15:00:00.000Z' })
    const snapshot = structuredClone(v4)

    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(v4))
    const db = readDatabase()
    expect(db.version).toBe(7)
    for (const key of Object.keys(snapshot) as Array<keyof DemoDatabaseV4>) {
      if (key === 'version' || key === 'sequences') continue
      expect(db[key as keyof DemoDatabase], key).toEqual(snapshot[key])
    }
    expect(db.sequences.request).toBe(snapshot.sequences.request)
    expectSound(db, TODAY)

    // The user's lease: rent posted from its terms with the standard issue date, no invented payments, not demo.
    const own = db.charges.filter((charge) => charge.leaseId === lease.id)
    expect(own.map((charge) => charge.period)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10'])
    expect(own.every((charge) => !charge.demo && charge.issuedOn === `${charge.period}-01` && charge.dueDate === `${charge.period}-01` && charge.amountCents === 210000)).toBe(true)
    expect(db.payments.some((payment) => own.some((charge) => charge.id === payment.chargeId))).toBe(false)
    // The user's completed job: one bill, not demo, unpaid.
    const bill = db.expenses.filter((expense) => expense.workOrderId === order.id)
    expect(bill).toEqual([expect.objectContaining({ amountCents: 64025, source: 'work-order', vendorId: order.vendorId })])
    expect(bill[0]?.demo).toBeUndefined()
    expect(bill[0]?.paidOn).toBeUndefined()
    // Demo scope excludes everything the user created.
    expect(db.finance.demoScope.leaseIds).not.toContain(lease.id)
    expect(db.finance.demoScope.workOrderIds).not.toContain(order.id)
  })
})

const db = () => readDatabase()
