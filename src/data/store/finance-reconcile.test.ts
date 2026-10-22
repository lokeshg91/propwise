import { addDays, todayIso } from '@/data/domain/dates'
import { isCurrentLease } from '@/data/domain/lease-rules'
import { addPeriods, periodOf } from '@/data/domain/finance-schedule'
import {
  cancelRequest,
  completeRequest,
  createServiceRequest,
  createTenant,
  deleteVendor,
  endLease,
  reopenRequest,
  updateTenant,
} from '@/data/services'
import { readDatabase, resetDemoData, type DemoDatabase } from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { reconcileFinance, rentChargeId, workOrderBillId } from '@/data/store/finance-reconcile'
import { type Lease, type LeaseAssignmentInput, type ServiceRequestInput, type TenantInput, type Unit } from '@/types'

/** Fixed clock: the 12th, so a rent due on the 28th is still "not yet due". */
const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'
const CURRENT = '2026-10'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  vi.useRealTimers()
})

const FINANCE_KEYS = ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance', 'sequences'] as const
const nonFinance = (db: DemoDatabase) => Object.fromEntries(Object.entries(db).filter(([key]) => !(FINANCE_KEYS as readonly string[]).includes(key)))
const context = (today = TODAY) => ({ today, now: `${today}T12:00:00.000Z` })

function freeUnit(db: DemoDatabase, skip = 0): Unit {
  const free = db.units.filter((unit) => unit.status === 'vacant' && !db.leases.some((lease) => lease.unitId === unit.id && isCurrentLease(lease)))
  return free[skip] as Unit
}

/** Adds a lease recorded long ago, due on the 28th, to a copy of the database. */
function withLease(db: DemoDatabase, overrides: Partial<Lease> = {}): Lease {
  const unit = freeUnit(db)
  const lease: Lease = {
    id: 'lease_test',
    tenantId: db.tenants[0]?.id ?? 'ten',
    propertyId: unit.propertyId,
    unitId: unit.id,
    startDate: `${db.finance.startPeriod}-01`,
    endDate: '2027-12-31',
    monthlyRent: 1800,
    securityDeposit: 1800,
    paymentDueDay: 28,
    status: 'active',
    endedAt: null,
    endReason: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
  db.leases.push(lease)
  return lease
}

describe('reconciliation (pure)', () => {
  it('is idempotent on the seeded data and passes the integrity check', () => {
    const db = structuredClone(readDatabase())
    expect(checkFinanceIntegrity(db)).toEqual([])
    const before = structuredClone(db)
    expect(reconcileFinance(db, context()).changed).toBe(false)
    expect(db).toEqual(before)
  })

  it('posts rent for every billable month and only writes Finance collections', () => {
    const db = structuredClone(readDatabase())
    const lease = withLease(db)
    const base = structuredClone(nonFinance(db))
    const payments = structuredClone(db.payments)
    const report = reconcileFinance(db, context())
    expect(report.posted).toBe(12)
    const posted = db.charges.filter((charge) => charge.leaseId === lease.id)
    expect(posted.map((charge) => charge.period)).toEqual(Array.from({ length: 12 }, (_, index) => addPeriods(db.finance.startPeriod, index)))
    expect(posted.every((charge) => charge.amountCents === 180000 && !charge.demo)).toBe(true)
    expect(nonFinance(db)).toEqual(base)
    expect(db.payments).toEqual(payments)
    expect(checkFinanceIntegrity(db)).toEqual([])
    // Running again changes nothing.
    const after = structuredClone(db)
    expect(reconcileFinance(db, context()).changed).toBe(false)
    expect(db).toEqual(after)
  })

  it('re-syncs only a provisional charge and records why', () => {
    const db = structuredClone(readDatabase())
    const lease = withLease(db)
    reconcileFinance(db, context())
    lease.monthlyRent = 1950
    const report = reconcileFinance(db, context())
    expect(report.resynced).toBe(1)
    const current = db.charges.find((charge) => charge.id === rentChargeId(lease.id, CURRENT))
    expect(current?.amountCents).toBe(195000)
    // Months already due keep the old rent: history is never rewritten.
    expect(db.charges.find((charge) => charge.id === rentChargeId(lease.id, addPeriods(CURRENT, -1)))?.amountCents).toBe(180000)
    const events = db.financeEvents.filter((event) => event.recordId === current?.id)
    expect(events).toEqual([expect.objectContaining({ kind: 'auto-adjusted', actor: 'system', reason: expect.stringMatching(/lease terms changed/i) })])
    expect(events[0]?.description).toContain('$1,800.00 → $1,950.00')
    // Idempotent: no second event.
    expect(reconcileFinance(db, context()).changed).toBe(false)
    expect(db.financeEvents.filter((event) => event.recordId === current?.id)).toHaveLength(1)
  })

  it('never changes a charge with a payment (even a voided one), an adjustment or a void', () => {
    const db = structuredClone(readDatabase())
    const lease = withLease(db)
    reconcileFinance(db, context())
    const id = rentChargeId(lease.id, CURRENT)
    db.payments.push({ id: 'pay_x', reference: 'PAY-99999', chargeId: id, amountCents: 1000, receivedOn: TODAY, method: 'cash', voidedAt: 'x', voidReason: 'Entered twice', createdAt: 'x' })
    db.sequences.payment = 100000
    lease.monthlyRent = 2100
    const snapshot = structuredClone(db.charges.find((charge) => charge.id === id))
    expect(reconcileFinance(db, context()).resynced).toBe(0)
    expect(db.charges.find((charge) => charge.id === id)).toEqual(snapshot)

    const other = structuredClone(readDatabase())
    const second = withLease(other)
    reconcileFinance(other, context())
    const adjusted = other.charges.find((charge) => charge.id === rentChargeId(second.id, CURRENT))
    if (adjusted) Object.assign(adjusted, { amountCents: 150000, adjusted: true })
    second.monthlyRent = 2100
    reconcileFinance(other, context())
    expect(other.charges.find((charge) => charge.id === adjusted?.id)?.amountCents).toBe(150000)
  })

  it('voids untouched charges after move-out with a reason and keeps paid ones', () => {
    const db = structuredClone(readDatabase())
    const lease = withLease(db)
    const paidLease = withLease(db, { id: 'lease_paid', unitId: freeUnit(db, 1).id, propertyId: freeUnit(db, 1).propertyId })
    reconcileFinance(db, context())
    const paidId = rentChargeId(paidLease.id, CURRENT)
    db.payments.push({ id: 'pay_pre', reference: 'PAY-99998', chargeId: paidId, amountCents: 180000, receivedOn: TODAY, method: 'bank-transfer', createdAt: 'x' })
    db.sequences.payment = 100000
    for (const entry of [lease, paidLease]) Object.assign(entry, { status: 'terminated', endedAt: addDays(TODAY, -2), endReason: 'early-termination' })
    const report = reconcileFinance(db, context())
    expect(report.autoVoided).toBe(1)
    const voided = db.charges.find((charge) => charge.id === rentChargeId(lease.id, CURRENT))
    expect(voided).toMatchObject({ voidedBy: 'system', voidReason: 'The lease ended before this charge was due.' })
    expect(db.financeEvents.find((event) => event.recordId === voided?.id)).toMatchObject({ kind: 'auto-voided', actor: 'system', reason: voided?.voidReason })
    // The prepaid charge is kept as it was; earlier months are still owed.
    expect(db.charges.find((charge) => charge.id === paidId)?.voidedAt).toBeUndefined()
    expect(db.charges.find((charge) => charge.id === rentChargeId(lease.id, addPeriods(CURRENT, -1)))?.voidedAt).toBeUndefined()
    expect(reconcileFinance(db, context()).changed).toBe(false)
    expect(checkFinanceIntegrity(db)).toEqual([])
  })

  it('never voids anything when the clock moves backwards', () => {
    const db = structuredClone(readDatabase())
    const before = structuredClone(db)
    expect(reconcileFinance(db, context(addDays(TODAY, -40))).changed).toBe(false)
    expect(db).toEqual(before)
  })

  it('creates one bill per completed work order and never changes it', () => {
    const db = structuredClone(readDatabase())
    const order = db.workOrders.find((entry) => entry.status === 'in-progress')
    if (!order) throw new Error('no in-progress work order')
    Object.assign(order, { status: 'completed', actualCost: 321.45, completedAt: `${TODAY}T10:00:00.000Z` })
    expect(reconcileFinance(db, context()).billsCreated).toBe(1)
    const bill = db.expenses.find((expense) => expense.id === workOrderBillId(order.id))
    expect(bill).toMatchObject({ amountCents: 32145, source: 'work-order', billDate: TODAY, dueDate: addDays(TODAY, 30), vendorId: order.vendorId })
    expect(bill?.demo).toBeUndefined()
    expect(bill?.paidOn).toBeUndefined()
    // Even if the work order's cost were changed, the bill isn't rewritten; the integrity check reports it.
    order.actualCost = 999
    expect(reconcileFinance(db, context()).changed).toBe(false)
    expect(db.expenses.find((expense) => expense.id === bill?.id)?.amountCents).toBe(32145)
    expect(checkFinanceIntegrity(db)).toEqual([expect.stringContaining('amount differs from work order')])
  })
})

/* ---------------------------------------------------- through the services */

const leaseInput = (unit: Unit, overrides: Partial<LeaseAssignmentInput> = {}): LeaseAssignmentInput => ({
  propertyId: unit.propertyId,
  unitId: unit.id,
  startDate: '2026-05-01',
  endDate: '2027-04-30',
  monthlyRent: 2000,
  securityDeposit: 2000,
  paymentDueDay: 28,
  status: 'active',
  ...overrides,
})
const tenantInput = (lease: LeaseAssignmentInput, email = 'finance.test@example.com'): TenantInput => ({
  kind: 'individual',
  name: 'Finance Test',
  email,
  phone: '(512) 555-0101',
  mailingAddress: { street: '1 Test St', city: 'Austin', state: 'TX', postalCode: '78701' },
  emergencyContact: null,
  notes: '',
  lease,
})
const leaseOf = (tenantId: string) => readDatabase().leases.find((lease) => lease.tenantId === tenantId) as Lease

describe('Finance follows Tenants and Maintenance in the same commit', () => {
  it('bills a backdated lease from the month it was recorded, with no fabricated payments', async () => {
    const tenant = await createTenant(tenantInput(leaseInput(freeUnit(readDatabase()))))
    const lease = leaseOf(tenant.id)
    const db = readDatabase()
    const charges = db.charges.filter((charge) => charge.leaseId === lease.id)
    expect(charges.map((charge) => charge.period)).toEqual([CURRENT])
    expect(charges[0]).toMatchObject({ amountCents: 200000, dueDate: '2026-10-28' })
    expect(charges[0]?.demo).toBeUndefined()
    expect(db.payments.some((payment) => payment.chargeId === charges[0]?.id)).toBe(false)
    expect(checkFinanceIntegrity(db)).toEqual([])
  })

  it('re-syncs the not-yet-due charge when lease terms change, and voids it at move-out', async () => {
    const unit = freeUnit(readDatabase())
    const tenant = await createTenant(tenantInput(leaseInput(unit)))
    await updateTenant(tenant.id, tenantInput(leaseInput(unit, { monthlyRent: 2150 })))
    const lease = leaseOf(tenant.id)
    const id = rentChargeId(lease.id, CURRENT)
    expect(readDatabase().charges.find((charge) => charge.id === id)?.amountCents).toBe(215000)

    await endLease(lease.id, TODAY, 'moved-out')
    const db = readDatabase()
    expect(db.charges.find((charge) => charge.id === id)).toMatchObject({ voidedBy: 'system', voidReason: expect.stringMatching(/ended before/) })
    expect(db.financeEvents.filter((event) => event.recordId === id).map((event) => event.kind)).toEqual(['auto-adjusted', 'auto-voided'])
    expect(checkFinanceIntegrity(db)).toEqual([])
  })

  it('creates one bill when a work order completes; reopening keeps it; cancelling creates none', async () => {
    const input: ServiceRequestInput = {
      title: 'Finance bill check',
      description: '',
      category: 'plumbing',
      priority: 'medium',
      propertyId: 'prop_101',
      unitId: null,
      area: 'Lobby',
      tenantId: null,
      source: 'staff',
      permissionToEnter: false,
      accessNotes: '',
    }
    const vendorId = readDatabase().vendors.find((vendor) => vendor.active && vendor.categories.includes('plumbing'))?.id ?? ''
    const request = await createServiceRequest(input, { assign: { vendorId, scheduledFor: null, estimatedCost: 200, notes: '' } })
    await completeRequest(request.id, { completedOn: TODAY, actualCost: 215.5, notes: '', returnUnitToVacant: false })
    const order = readDatabase().workOrders.find((entry) => entry.requestId === request.id)
    const bills = () => readDatabase().expenses.filter((expense) => expense.workOrderId === order?.id)
    expect(bills()).toEqual([expect.objectContaining({ amountCents: 21550, estimatedCents: 20000, propertyId: 'prop_101', requestId: request.id })])
    await reopenRequest(request.id, 'Leak came back')
    expect(bills()).toHaveLength(1)

    const other = await createServiceRequest({ ...input, title: 'Cancelled job' }, { assign: { vendorId, scheduledFor: null, estimatedCost: 90, notes: '' } })
    await cancelRequest(other.id, { reason: 'Duplicate', returnUnitToVacant: false })
    expect(readDatabase().expenses.some((expense) => expense.requestId === other.id)).toBe(false)
    expect(checkFinanceIntegrity(readDatabase())).toEqual([])
  })

  it('blocks deleting a vendor that appears on a bill', async () => {
    const db = readDatabase()
    const vendorId = 'ven_northstar-painting-co'
    expect(db.workOrders.some((order) => order.vendorId === vendorId)).toBe(false)
    const { createExpense } = await import('@/data/services')
    await createExpense({ category: 'other-expense', vendorId, propertyId: 'prop_101', description: 'Hallway touch-up', amountCents: 45000, billDate: TODAY })
    await expect(deleteVendor(vendorId)).rejects.toThrow(/appears on 1 bill/)
  })

  it('uses today, not the posting time, as the billing horizon', () => {
    expect(todayIso()).toBe(TODAY)
    expect(periodOf(TODAY)).toBe(CURRENT)
  })
})
