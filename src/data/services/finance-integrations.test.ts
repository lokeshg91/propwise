/**
 * Phase 8 Stage 3b: Finance integrations with tenants, properties, vendors
 * and maintenance work orders.
 */
import { addDays, addMonths } from '@/data/domain/dates'
import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { receivablesFor, resolveRange, totalsFor } from '@/data/domain/finance-summary'
import { expectedRentCharge, periodRange } from '@/data/domain/finance-schedule'
import { DEMO_INVOICE_LEAD_DAYS } from '@/data/mock/finance-seed'
import {
  addLateFee,
  completeRequest,
  createCharge,
  createExpense,
  deleteVendor,
  getFinanceOverview,
  getPropertyFinance,
  getReceivables,
  getServiceRequestDetail,
  getTenantFinance,
  getTransactions,
  getVendorDetail,
  recordPayment,
  setVendorActive,
  voidCharge,
  voidPayment,
} from '@/data/services'
import { snapshotOf } from '@/data/services/finance-service'
import { createTenant } from '@/data/services/tenant-service'
import { isStorageError, readDatabase, resetDemoData } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { DEFAULT_TRANSACTION_FILTERS, filterTransactions } from '@/features/finance/lib/transaction-list'
import { generateRentLedger } from '@/test/v07-rent-ledger'
import { type Charge, type Lease } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  vi.restoreAllMocks()
  expect(checkFinanceIntegrity(readDatabase())).toEqual([])
  vi.useRealTimers()
})

const db = () => readDatabase()
const rejection = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as Error)
const refuseWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })
const tenantOf = (lease: Lease) => db().tenants.find((tenant) => tenant.id === lease.tenantId)
const demoLeases = () => {
  const scope = new Set(db().finance.demoScope.leaseIds)
  return db().leases.filter((lease) => scope.has(lease.id))
}

/* -------------------------------------------------- tenant Payments ledger */

describe('tenant Payments tab: stored Finance ledger', () => {
  it('lists exactly the stored charges and payments of the tenant’s leases, voided ones included', async () => {
    for (const lease of demoLeases().slice(0, 25)) {
      const tenant = tenantOf(lease)
      if (!tenant) continue
      const finance = await getTenantFinance(tenant.id)
      const leaseIds = new Set(db().leases.filter((entry) => entry.tenantId === tenant.id).map((entry) => entry.id))
      const charges = db().charges.filter((charge) => charge.leaseId !== undefined && leaseIds.has(charge.leaseId))
      const chargeIds = new Set(charges.map((charge) => charge.id))
      expect(finance.entries.map((entry) => entry.charge.id).sort()).toEqual(charges.map((charge) => charge.id).sort())
      expect(finance.payments.map((row) => row.payment.id).sort()).toEqual(db().payments.filter((payment) => chargeIds.has(payment.chargeId)).map((payment) => payment.id).sort())
      // Newest first.
      const dues = finance.entries.map((entry) => entry.charge.dueDate)
      expect([...dues].sort().reverse()).toEqual(dues)
    }
  })

  it('agrees with Receivables for every tenant (one balance everywhere)', async () => {
    const rows = await getReceivables()
    const byTenant = new Map<string, number>()
    for (const row of rows) byTenant.set(row.tenantId, (byTenant.get(row.tenantId) ?? 0) + row.balanceCents)
    for (const [tenantId, balance] of [...byTenant].slice(0, 40)) {
      expect((await getTenantFinance(tenantId)).balanceCents).toBe(balance)
    }
  })

  it('keeps the months v0.7 showed paid, late or overdue (reconciliation with the old generated ledger)', () => {
    const data = db()
    const payments = paymentsByCharge(data.payments)
    const charges = new Map(data.charges.map((charge) => [charge.id, charge]))
    const window = new Set(periodRange(data.finance.startPeriod, TODAY.slice(0, 7)))
    let compared = 0
    let paidCompared = 0
    let samePaidDate = 0
    const differences: Record<string, number> = {}
    for (const lease of demoLeases()) {
      for (const old of generateRentLedger(lease, TODAY)) {
        if (!window.has(old.period) || old.dueDate > TODAY) continue
        const charge = charges.get(old.id) // Same ids as the v0.7 Payments tab: chg_<leaseId>_<period>.
        if (!charge) continue // e.g. months before a backdated lease was recorded
        compared += 1
        expect(charge.amountCents).toBe(Math.round(old.amount * 100))
        expect(charge.dueDate).toBe(old.dueDate)
        const state = chargeState(charge, payments.get(charge.id), TODAY, data.finance.graceDays)
        // v0.7 called a payment "late" when it came after the due date; Finance only after the grace period.
        // Compare on v0.7's definition, using the stored payment dates.
        const lastPaid = (payments.get(charge.id) ?? []).filter((payment) => !payment.voidedAt).map((payment) => payment.receivedOn).sort().at(-1)
        const now = state.status === 'paid' ? (lastPaid && lastPaid > charge.dueDate ? 'paid-late' : 'paid') : state.status
        const before = old.status === 'paid' ? (old.late ? 'paid-late' : 'paid') : old.status
        if (now !== before) differences[`${before}→${now}`] = (differences[`${before}→${now}`] ?? 0) + 1
        else if (old.status === 'paid' && old.paidAt) {
          paidCompared += 1
          if (lastPaid === old.paidAt) samePaidDate += 1
          else {
            // The only paid months with another date: instalments (two payments, the last one later),
            // the returned-check sample (re-paid 6 days later), and first-month rent paid before the lease
            // started (kept on the lease start: a charge is never issued before its lease starts).
            const list = (payments.get(charge.id) ?? []).filter((payment) => !payment.voidedAt)
            const returnedCheck = (payments.get(charge.id) ?? []).some((payment) => payment.voidedAt)
            const beforeLease = old.paidAt < lease.startDate && lastPaid === lease.startDate
            expect(list.length > 1 || returnedCheck || beforeLease, `${charge.id} ${old.paidAt} → ${lastPaid}`).toBe(true)
          }
          // Never dated before the charge was issued (approved rule), and the due date is v0.7's.
          for (const payment of payments.get(charge.id) ?? []) expect(payment.receivedOn >= charge.issuedOn).toBe(true)
        }
      }
    }
    expect(compared).toBeGreaterThan(1500)
    // The only intended status differences (Phase 8 Stage 1): a few late payers pay in two instalments or
    // partly, and one commercial tenant is in arrears, so a few months paid in v0.7 are still open.
    const allowed = new Set(['paid-late→partially-paid', 'paid-late→overdue', 'paid→overdue', 'overdue→partially-paid'])
    for (const key of Object.keys(differences)) expect(allowed.has(key), key).toBe(true)
    const changed = Object.values(differences).reduce((sum, count) => sum + count, 0)
    expect(changed / compared).toBeLessThan(0.02)
    // Payment dates are the ones v0.7 showed for almost every paid month (2,810 of 2,893 today).
    expect(samePaidDate / paidCompared).toBeGreaterThan(0.96)
    expect(paidCompared).toBeGreaterThan(2500)
  })

  it('never invents history for a tenant the user created', async () => {
    const unit = db().units.find((entry) => entry.status === 'vacant' && !db().leases.some((lease) => lease.unitId === entry.id && (lease.status === 'active' || lease.status === 'pending')))
    if (!unit) throw new Error('no free unit')
    const tenant = await createTenant({
      kind: 'individual',
      name: 'Rowan Pierce',
      email: 'rowan.pierce@example.com',
      phone: '(512) 555-0199',
      mailingAddress: { street: '1 Test St', city: 'Austin', state: 'TX', postalCode: '78701' },
      emergencyContact: null,
      notes: '',
      lease: { propertyId: unit.propertyId, unitId: unit.id, startDate: addMonths(TODAY, -3), endDate: addMonths(TODAY, 9), monthlyRent: 2000, securityDeposit: 2000, paymentDueDay: 1, status: 'active' },
    })
    const finance = await getTenantFinance(tenant.id)
    expect(finance.payments).toEqual([])
    expect(finance.hasDemo).toBe(false)
    // Backdated lease: billed from the month it was recorded (October), never earlier.
    expect(finance.entries.map((entry) => entry.charge.period)).toEqual(['2026-10'])
    expect(finance.entries[0]?.charge).toMatchObject({ amountCents: 200000, source: 'lease' })
    expect(finance.balanceCents).toBe(200000)
    expect(finance.next).toMatchObject({ dueDate: '2026-11-01', amountCents: 200000, projected: true })
  })

  it('shows payments, voids and their reasons straight after they are saved, and nothing after a failed save', async () => {
    const owing = (await getReceivables()).find((row) => row.balanceCents > 0 && row.demo)
    const lease = db().leases.find((entry) => entry.id === owing?.leaseId) as Lease
    const tenant = tenantOf(lease)
    if (!tenant) throw new Error('no tenant')
    const parking = await createCharge({ leaseId: lease.id, category: 'parking', description: 'Guest permit', amountCents: 2500, dueDate: TODAY })
    const payment = await recordPayment(parking.id, { amountCents: 1000, receivedOn: TODAY, method: 'cash' })
    await voidPayment(payment.id, 'Counterfeit note')
    await voidCharge(parking.id, 'Permit not issued')
    let finance = await getTenantFinance(tenant.id)
    const entry = finance.entries.find((item) => item.charge.id === parking.id)
    expect(entry).toMatchObject({ state: { status: 'void' }, charge: { voidReason: 'Permit not issued' } })
    expect(finance.payments.find((row) => row.payment.id === payment.id)?.payment).toMatchObject({ voidReason: 'Counterfeit note' })

    const before = JSON.stringify(finance)
    const open = finance.entries.find((item) => item.state.balanceCents > 0 && item.charge.dueDate <= TODAY)
    if (!open) throw new Error('nothing open')
    refuseWrites()
    expect(isStorageError(await rejection(recordPayment(open.charge.id, { amountCents: 100, receivedOn: TODAY, method: 'cash' })))).toBe(true)
    finance = await getTenantFinance(tenant.id)
    expect(JSON.stringify(finance)).toBe(before)
  })

  it('notes that months before the Finance window aren’t stored', async () => {
    const lease = demoLeases().find((entry) => entry.startDate < `${db().finance.startPeriod}-01`) as Lease
    const finance = await getTenantFinance(lease.tenantId)
    expect(finance.startsBeforeWindow).toBe(true)
    expect(finance.entries.every((entry) => (entry.charge.period ?? db().finance.startPeriod) >= db().finance.startPeriod)).toBe(true)
  })
})

/* ------------------------------------------------------ property Finance */

describe('property Finance tab', () => {
  it('matches the Finance summaries for the property', async () => {
    for (const property of db().properties.slice(0, 6)) {
      const finance = await getPropertyFinance(property.id)
      const scope = new Set([property.id])
      const snapshot = snapshotOf(db())
      expect(finance.totals).toEqual(totalsFor(snapshot, resolveRange('12m', TODAY), scope))
      expect(finance.receivables).toEqual(receivablesFor(snapshot, TODAY, scope))
      expect(finance.trend).toHaveLength(12)
      const sum = finance.tenants.reduce((total, row) => total + row.balanceCents, 0)
      expect(sum).toBe(finance.receivables.outstandingCents)
      expect(finance.tenants.every((row) => row.propertyId === property.id && row.balanceCents > 0)).toBe(true)
      expect(finance.recent.every((item) => (item.kind === 'payment' ? item.charge.propertyId : item.expense.propertyId) === property.id)).toBe(true)
      expect(finance.totals.netCashFlowCents).toBe(finance.totals.collectedCents - finance.totals.expensesPaidCents)
    }
  })

  it('updates after a saved payment and is unchanged after a failed one', async () => {
    const data = db()
    const payments = paymentsByCharge(data.payments)
    const charge = data.charges.find((entry) => entry.category === 'rent' && chargeState(entry, payments.get(entry.id), TODAY).balanceCents > 0 && entry.dueDate <= TODAY) as Charge
    const before = await getPropertyFinance(charge.propertyId)
    refuseWrites()
    await rejection(recordPayment(charge.id, { amountCents: 5000, receivedOn: TODAY, method: 'cash' }))
    expect(await getPropertyFinance(charge.propertyId)).toEqual(before)
    vi.restoreAllMocks()
    await recordPayment(charge.id, { amountCents: 5000, receivedOn: TODAY, method: 'cash' })
    const after = await getPropertyFinance(charge.propertyId)
    expect(after.totals.collectedCents).toBe(before.totals.collectedCents + 5000)
    expect(after.receivables.outstandingCents).toBe(before.receivables.outstandingCents - 5000)
  })
})

/* ------------------------------------------------- relationships and links */

describe('relationship integrity', () => {
  it('every work-order bill points to its completed work order, vendor, property and request', () => {
    const data = db()
    const bills = data.expenses.filter((expense) => expense.source === 'work-order')
    expect(bills.length).toBeGreaterThan(10)
    for (const bill of bills) {
      const order = data.workOrders.find((entry) => entry.id === bill.workOrderId)
      const request = data.serviceRequests.find((entry) => entry.id === order?.requestId)
      expect(order?.status).toBe('completed')
      expect(bill.vendorId).toBe(order?.vendorId)
      expect(bill.amountCents).toBe(Math.round((order?.actualCost ?? 0) * 100))
      expect(bill.propertyId).toBe(request?.propertyId)
      expect(data.expenses.filter((expense) => expense.workOrderId === bill.workOrderId)).toHaveLength(1)
    }
  })

  it('completing a work order creates one linked bill, shown on the request and the vendor', async () => {
    const order = db().workOrders.find((entry) => entry.status === 'in-progress')
    if (!order) throw new Error('no work order in progress')
    const vendorBefore = await getVendorDetail(order.vendorId)
    await completeRequest(order.requestId, { completedOn: TODAY, actualCost: 640.25, notes: '', returnUnitToVacant: false })
    const bill = db().expenses.find((expense) => expense.workOrderId === order.id)
    expect(bill).toMatchObject({ source: 'work-order', vendorId: order.vendorId, amountCents: 64025 })
    const detail = await getServiceRequestDetail(order.requestId)
    expect(detail?.workOrders.find((entry) => entry.id === order.id)?.bill).toMatchObject({ id: bill?.id, reference: bill?.reference, status: 'pending', amountCents: 64025 })
    const vendorAfter = await getVendorDetail(order.vendorId)
    expect(vendorAfter?.bills.count).toBe((vendorBefore?.bills.count ?? 0) + 1)
    expect(vendorAfter?.bills.unpaidCents).toBe((vendorBefore?.bills.unpaidCents ?? 0) + 64025)
  })

  it('a bill keeps its vendor when the vendor is deactivated, and a vendor with bills can’t be deleted', async () => {
    const bill = db().expenses.find((expense) => expense.source === 'work-order') ?? null
    if (!bill?.vendorId) throw new Error('no bill')
    const vendor = db().vendors.find((entry) => entry.id === bill.vendorId)
    if (vendor?.active) await setVendorActive(bill.vendorId, false, { confirmOpenJobs: true })
    expect(db().expenses.find((expense) => expense.id === bill.id)?.vendorId).toBe(bill.vendorId)
    expect((await getVendorDetail(bill.vendorId))?.canDelete).toBe(false)
    expect(await rejection(deleteVendor(bill.vendorId))).toBeTruthy()

    // A vendor with only a manual bill (no work orders) is protected too.
    const fresh = db().vendors.find((entry) => entry.active && !db().workOrders.some((order) => order.vendorId === entry.id) && !db().expenses.some((expense) => expense.vendorId === entry.id))
    if (fresh) {
      await createExpense({ category: 'maintenance', vendorId: fresh.id, propertyId: 'prop_101', description: 'Gutter clean', amountCents: 12000, billDate: TODAY })
      expect((await getVendorDetail(fresh.id))?.canDelete).toBe(false)
      expect(await rejection(deleteVendor(fresh.id))).toBeTruthy()
    }
  })

  it('vendor bill totals match the Finance records', async () => {
    const vendorId = db().expenses.find((expense) => expense.vendorId)?.vendorId as string
    const detail = await getVendorDetail(vendorId)
    const rows = (await getTransactions()).filter((row) => row.kind === 'expense' && row.record.vendorId === vendorId)
    expect(detail?.bills.count).toBe(rows.length)
    expect(detail?.bills.unpaidCents).toBe(rows.reduce((sum, row) => sum + row.balanceCents, 0))
  })

  it('the Transactions party filter selects exactly a tenant’s charges or a vendor’s bills', async () => {
    const rows = await getTransactions()
    const lease = demoLeases()[0] as Lease
    const tenantRows = filterTransactions(rows, { ...DEFAULT_TRANSACTION_FILTERS, range: 'all', party: `tenant:${lease.tenantId}` }, TODAY)
    const leaseIds = new Set(db().leases.filter((entry) => entry.tenantId === lease.tenantId).map((entry) => entry.id))
    expect(tenantRows.length).toBe(db().charges.filter((charge) => charge.leaseId !== undefined && leaseIds.has(charge.leaseId)).length)
    expect(tenantRows.every((row) => row.kind === 'income' && row.partyHref === `/tenants/${lease.tenantId}?tab=payments`)).toBe(true)

    const vendorId = db().expenses.find((expense) => expense.vendorId)?.vendorId as string
    const vendorRows = filterTransactions(rows, { ...DEFAULT_TRANSACTION_FILTERS, range: 'all', party: `vendor:${vendorId}` }, TODAY)
    expect(vendorRows.length).toBe(db().expenses.filter((expense) => expense.vendorId === vendorId).length)
    expect(vendorRows.every((row) => row.kind === 'expense' && row.partyHref === `/vendors/${vendorId}`)).toBe(true)
  })

  it('the integrity check rejects a second late-fee record on one charge', async () => {
    const payments = paymentsByCharge(db().payments)
    const fees = new Set(db().charges.map((charge) => charge.parentChargeId).filter(Boolean))
    const late = db().charges.find((charge) => charge.category === 'rent' && !fees.has(charge.id) && chargeState(charge, payments.get(charge.id), TODAY).balanceCents > 0 && charge.dueDate < addDays(TODAY, -5)) as Charge
    const fee = await addLateFee(late.id)
    const copy = structuredClone(db())
    copy.charges.push({ ...fee, id: 'chg_extra', reference: 'INC-99999' })
    expect(checkFinanceIntegrity(copy)).toContain(`charge ${late.id}: more than one late-fee record`)
  })
})

/* ------------------------------------------------- demo issue dates (3b review) */

describe('demo invoice dates', () => {
  const standardIssue = (charge: Charge) => {
    const lease = db().leases.find((entry) => entry.id === charge.leaseId) as Lease
    return expectedRentCharge(lease, charge.period as string, charge.amountCents)
  }

  it('demo history is issued 3 days before the due date (never before the lease starts); due dates are unchanged', () => {
    let moved = 0
    for (const charge of db().charges) {
      if (charge.source !== 'lease' && charge.source !== 'recurring') continue
      const standard = standardIssue(charge)
      expect(charge.dueDate).toBe(standard.dueDate)
      const lease = db().leases.find((entry) => entry.id === charge.leaseId) as Lease
      if (charge.demo && charge.dueDate <= TODAY) {
        const lead = addDays(charge.dueDate, -DEMO_INVOICE_LEAD_DAYS)
        const expected = [standard.issuedOn, lead > lease.startDate ? lead : lease.startDate].sort()[0]
        expect(charge.issuedOn, charge.id).toBe(expected)
        if (charge.issuedOn !== standard.issuedOn) moved += 1
      } else {
        expect(charge.issuedOn, charge.id).toBe(standard.issuedOn)
      }
      expect(charge.issuedOn <= charge.dueDate).toBe(true)
      expect(charge.issuedOn >= lease.startDate).toBe(true)
    }
    expect(moved).toBeGreaterThan(3000)
  })

  it('no payment is dated before its charge was issued', () => {
    const charges = new Map(db().charges.map((charge) => [charge.id, charge]))
    expect(db().payments.filter((payment) => payment.receivedOn < (charges.get(payment.chargeId)?.issuedOn ?? ''))).toEqual([])
  })

  it('statuses, balances and aging don’t depend on the issue date', () => {
    const payments = paymentsByCharge(db().payments)
    for (const charge of db().charges.filter((entry) => entry.demo).slice(0, 2000)) {
      const standard = { ...charge, issuedOn: charge.source === 'lease' || charge.source === 'recurring' ? standardIssue(charge).issuedOn : charge.issuedOn }
      expect(chargeState(charge, payments.get(charge.id), TODAY)).toEqual(chargeState(standard, payments.get(charge.id), TODAY))
    }
  })

  it('charges posted later and charges the user creates keep the standard issue date', async () => {
    const unit = db().units.find((entry) => entry.status === 'vacant' && !db().leases.some((lease) => lease.unitId === entry.id && (lease.status === 'active' || lease.status === 'pending')))
    if (!unit) throw new Error('no free unit')
    const tenant = await createTenant({
      kind: 'individual',
      name: 'Rowan Pierce',
      email: 'rowan.pierce@example.com',
      phone: '(512) 555-0199',
      mailingAddress: { street: '1 Test St', city: 'Austin', state: 'TX', postalCode: '78701' },
      emergencyContact: null,
      notes: '',
      lease: { propertyId: unit.propertyId, unitId: unit.id, startDate: '2026-09-15', endDate: '2027-09-14', monthlyRent: 2000, securityDeposit: 2000, paymentDueDay: 1, status: 'active' },
    })
    const history = new Map(db().charges.map((charge) => [charge.id, charge.issuedOn]))
    const raw = window.localStorage.getItem(STORAGE_KEYS.demoData) ?? ''
    resetDemoData()
    vi.setSystemTime(new Date('2026-12-05T12:00:00'))
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    const later = readDatabase()
    // Stored history is never rewritten.
    for (const charge of later.charges) if (history.has(charge.id)) expect(charge.issuedOn).toBe(history.get(charge.id))
    // November and December are posted with the standard issue date, for demo and user leases alike.
    const posted = later.charges.filter((charge) => !history.has(charge.id) && (charge.source === 'lease' || charge.source === 'recurring'))
    expect(posted.length).toBeGreaterThan(300)
    for (const charge of posted) {
      const lease = later.leases.find((entry) => entry.id === charge.leaseId) as Lease
      expect(charge.issuedOn).toBe(expectedRentCharge(lease, charge.period as string, charge.amountCents).issuedOn)
    }
    const own = later.leases.find((lease) => lease.tenantId === tenant.id) as Lease
    expect(later.charges.filter((charge) => charge.leaseId === own.id).map((charge) => [charge.period, charge.issuedOn])).toEqual([
      ['2026-10', '2026-10-01'],
      ['2026-11', '2026-11-01'],
      ['2026-12', '2026-12-01'],
    ])
    expect(later.payments.some((payment) => later.charges.find((charge) => charge.id === payment.chargeId)?.leaseId === own.id)).toBe(false)
  })

  it('doesn’t compare with a previous period that starts before Finance history', async () => {
    const start = `${db().finance.startPeriod}-01`
    for (const range of ['this-month', '3m', '6m', '12m', 'ytd'] as const) {
      const overview = await getFinanceOverview({ range, propertyType: 'all', propertyId: 'all' })
      if (overview.range.previous.from < start) expect(overview.previousTotals, range).toBeNull()
      else expect(overview.previousTotals, range).not.toBeNull()
    }
    expect((await getFinanceOverview({ range: '12m', propertyType: 'all', propertyId: 'all' })).previousTotals).toBeNull()
    expect((await getFinanceOverview({ range: '6m', propertyType: 'all', propertyId: 'all' })).previousTotals).not.toBeNull()
  })
})
