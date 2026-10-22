import { addDays } from '@/data/domain/dates'
import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { receivablesFor, resolveRange, totalsFor } from '@/data/domain/finance-summary'
import {
  addLateFee,
  adjustCharge,
  createCharge,
  createExpense,
  createRecurringCharge,
  endRecurringCharge,
  getFinanceOverview,
  getReceivables,
  getTransactionDetail,
  getTransactions,
  isFinanceDuplicateError,
  markExpensePaid,
  markExpenseUnpaid,
  recordPayment,
  updateExpense,
  updateFinanceSettings,
  voidCharge,
  voidExpense,
  voidPayment,
} from '@/data/services'
import { snapshotOf } from '@/data/services/finance-service'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { type Charge } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  expect(checkFinanceIntegrity(readDatabase())).toEqual([])
  vi.useRealTimers()
})

const db = () => readDatabase()
const stateOf = (id: string) => {
  const data = db()
  const charge = data.charges.find((entry) => entry.id === id) as Charge
  return chargeState(charge, data.payments.filter((payment) => payment.chargeId === id), TODAY)
}
/** An open, payment-free rent charge from a sample lease. */
const openRent = () => {
  const data = db()
  const paid = new Set(data.payments.map((payment) => payment.chargeId))
  return data.charges.find((charge) => charge.category === 'rent' && !charge.voidedAt && !paid.has(charge.id) && charge.dueDate <= TODAY) as Charge
}
const activeLease = () => db().leases.find((lease) => lease.status === 'active') ?? db().leases[0]
const rejection = (promise: Promise<unknown>) => promise.then(() => null, (error: unknown) => error as Error & { field?: string })

describe('reads', () => {
  it('matches the pure summaries for the overview', async () => {
    const overview = await getFinanceOverview({ range: '3m', propertyType: 'all', propertyId: 'all' })
    const range = resolveRange('3m', TODAY)
    expect(overview.totals).toEqual(totalsFor(snapshotOf(db()), range, null))
    expect(overview.receivables).toEqual(receivablesFor(snapshotOf(db()), TODAY, null))
    expect(overview.trend).toHaveLength(3)
    expect(overview.totals.collectedCents).toBeGreaterThan(0)
    expect(overview.totals.expensesPaidCents).toBeGreaterThan(0)
    expect(overview.receivables.overdueCents).toBeGreaterThan(0)
    expect(overview.upcoming.some((item) => item.kind === 'projected-rent')).toBe(true)
    expect(overview.properties).toHaveLength(12)
    const commercial = await getFinanceOverview({ range: '3m', propertyType: 'commercial', propertyId: 'all' })
    expect(commercial.properties.every((row) => row.type === 'commercial')).toBe(true)
  })

  it('lists every record, gives details and per-lease receivables', async () => {
    const rows = await getTransactions()
    expect(rows).toHaveLength(db().charges.length + db().expenses.length)
    expect(rows.every((row) => row.demo)).toBe(true)
    const rent = rows.find((row) => row.kind === 'income' && row.category === 'rent')
    const detail = await getTransactionDetail(rent?.id ?? '')
    expect(detail?.kind).toBe('income')
    expect(await getTransactionDetail('nope')).toBeNull()
    const receivables = await getReceivables()
    const total = receivables.reduce((sum, row) => sum + row.balanceCents, 0)
    const leaseOnly = db().charges.filter((charge) => charge.leaseId)
    expect(total).toBe(receivablesFor({ ...snapshotOf(db()), charges: leaseOnly }, TODAY, null).outstandingCents)
  })
})

describe('payments', () => {
  it('records partial then full payments and blocks overpayment, future dates and dates before issue', async () => {
    const charge = openRent()
    await recordPayment(charge.id, { amountCents: 50000, receivedOn: TODAY, method: 'check', externalRef: 'Check 1201' })
    expect(stateOf(charge.id)).toMatchObject({ status: 'partially-paid', paidCents: 50000 })
    const balance = stateOf(charge.id).balanceCents
    expect(await rejection(recordPayment(charge.id, { amountCents: balance + 1, receivedOn: TODAY, method: 'cash' }))).toMatchObject({ field: 'amountCents' })
    expect(await rejection(recordPayment(charge.id, { amountCents: 100, receivedOn: addDays(TODAY, 1), method: 'cash' }))).toMatchObject({ field: 'receivedOn' })
    expect(await rejection(recordPayment(charge.id, { amountCents: 100, receivedOn: addDays(charge.issuedOn, -1), method: 'cash' }))).toMatchObject({ field: 'receivedOn' })
    await recordPayment(charge.id, { amountCents: balance, receivedOn: TODAY, method: 'bank-transfer' })
    expect(stateOf(charge.id).status).toBe('paid')
    expect(await rejection(recordPayment(charge.id, { amountCents: 1, receivedOn: TODAY, method: 'cash' }))).toMatchObject({ message: expect.stringMatching(/paid in full/) })
  })

  it('warns about a repeated payment and saves it only after confirmation', async () => {
    const charge = openRent()
    await recordPayment(charge.id, { amountCents: 10000, receivedOn: TODAY, method: 'cash' })
    const error = await rejection(recordPayment(charge.id, { amountCents: 10000, receivedOn: TODAY, method: 'cash' }))
    expect(isFinanceDuplicateError(error) && error.requiresConfirmation).toBe(true)
    await recordPayment(charge.id, { amountCents: 10000, receivedOn: TODAY, method: 'cash' }, { acknowledgeDuplicate: true })
    expect(stateOf(charge.id).paidCents).toBe(20000)
  })

  it('voids a payment with a reason, restores the balance and never deletes it', async () => {
    const charge = openRent()
    const payment = await recordPayment(charge.id, { amountCents: 30000, receivedOn: TODAY, method: 'check' })
    expect(await rejection(voidPayment(payment.id, ''))).toMatchObject({ field: 'reason' })
    await voidPayment(payment.id, 'Check returned')
    expect(stateOf(charge.id).paidCents).toBe(0)
    expect(db().payments.find((entry) => entry.id === payment.id)).toMatchObject({ voidReason: 'Check returned' })
    expect(db().financeEvents.find((event) => event.paymentId === payment.id)).toMatchObject({ kind: 'payment-voided', reason: 'Check returned', actor: 'user' })
    expect(await rejection(voidPayment(payment.id, 'Again'))).toMatchObject({ message: expect.stringMatching(/already void/) })
  })
})

describe('charges', () => {
  it('only voids a charge without active payments, with a reason', async () => {
    const charge = openRent()
    const payment = await recordPayment(charge.id, { amountCents: 1000, receivedOn: TODAY, method: 'cash' })
    expect(await rejection(voidCharge(charge.id, 'Billed in error'))).toMatchObject({ message: expect.stringMatching(/Void the payment/) })
    await voidPayment(payment.id, 'Wrong charge')
    await voidCharge(charge.id, 'Billed in error')
    expect(stateOf(charge.id).status).toBe('void')
  })

  it('adjusts an amount with a reason, never below what is paid, and reconciliation keeps it', async () => {
    const charge = openRent()
    await recordPayment(charge.id, { amountCents: 40000, receivedOn: TODAY, method: 'cash' })
    expect(await rejection(adjustCharge(charge.id, 39999, 'Concession'))).toMatchObject({ field: 'amountCents' })
    expect(await rejection(adjustCharge(charge.id, 50000, ''))).toMatchObject({ field: 'reason' })
    await adjustCharge(charge.id, 50000, 'One-month concession')
    expect(db().charges.find((entry) => entry.id === charge.id)).toMatchObject({ amountCents: 50000, adjusted: true })
    expect(db().financeEvents.find((event) => event.recordId === charge.id && event.kind === 'adjusted')?.description).toMatch(/\$500\.00/)
  })

  it('adds manual income for a tenant or a property payer, never rent, and records an immediate payment atomically', async () => {
    const lease = activeLease()
    expect(await rejection(createCharge({ leaseId: lease?.id, category: 'rent', description: '', amountCents: 100, dueDate: TODAY }))).toMatchObject({ field: 'category' })
    const parking = await createCharge({ leaseId: lease?.id, category: 'parking', description: 'Guest permit', amountCents: 2500, dueDate: TODAY })
    expect(parking).toMatchObject({ propertyId: lease?.propertyId, unitId: lease?.unitId, source: 'manual' })
    expect(await rejection(createCharge({ propertyId: 'prop_101', category: 'other-income', description: 'x', amountCents: 100, dueDate: TODAY }))).toMatchObject({ field: 'payerName' })

    const count = db().charges.length
    // A failing immediate payment leaves nothing behind.
    expect(
      await rejection(createCharge({ propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income', description: 'Vending', amountCents: 9000, dueDate: TODAY }, { receivedNow: { receivedOn: addDays(TODAY, 3), method: 'cash' } })),
    ).toMatchObject({ field: 'receivedOn' })
    expect(db().charges).toHaveLength(count)
    const vending = await createCharge({ propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income', description: 'Vending', amountCents: 9000, dueDate: TODAY }, { receivedNow: { receivedOn: TODAY, method: 'cash' } })
    expect(stateOf(vending.id).status).toBe('paid')
    expect(vending.demo).toBeUndefined()

    const duplicate = await rejection(createCharge({ propertyId: 'prop_101', payerName: 'vending co', category: 'other-income', description: 'Vending', amountCents: 9000, dueDate: TODAY }))
    expect(isFinanceDuplicateError(duplicate) && duplicate.requiresConfirmation).toBe(true)
  })

  it('adds one late fee per late rent charge after the grace period', async () => {
    const data = db()
    const payments = paymentsByCharge(data.payments)
    const hasFee = new Set(data.charges.map((charge) => charge.parentChargeId).filter(Boolean))
    const late = data.charges.find(
      (charge) => charge.category === 'rent' && !hasFee.has(charge.id) && chargeState(charge, payments.get(charge.id), TODAY).balanceCents > 0 && charge.dueDate < addDays(TODAY, -5),
    ) as Charge
    const fee = await addLateFee(late.id)
    const commercial = data.properties.find((property) => property.id === late.propertyId)?.type === 'commercial'
    expect(fee).toMatchObject({ category: 'late-fee', parentChargeId: late.id, amountCents: commercial ? Math.round(late.amountCents * 0.05) : 5000 })
    expect(await rejection(addLateFee(late.id))).toMatchObject({ message: expect.stringMatching(/already added/) })
    expect(await rejection(voidCharge(late.id, 'x'.repeat(5)))).toBeTruthy()
  })
})

describe('recurring schedules', () => {
  it('posts the current month, blocks backdating and overlaps, and voids untouched charges when ended early', async () => {
    const lease = db().leases.find((entry) => entry.status === 'active' && !db().recurringCharges.some((recurring) => recurring.leaseId === entry.id))
    if (!lease) throw new Error('no lease')
    expect(await rejection(createRecurringCharge({ leaseId: lease.id, category: 'parking', description: 'Garage', amountCents: 9000, startPeriod: '2026-09' }))).toMatchObject({ field: 'startPeriod' })
    const schedule = await createRecurringCharge({ leaseId: lease.id, category: 'parking', description: 'Garage', amountCents: 9000, startPeriod: '2026-10' })
    const posted = db().charges.find((charge) => charge.recurringId === schedule.id)
    expect(posted).toMatchObject({ period: '2026-10', amountCents: 9000, category: 'parking', source: 'recurring' })
    expect(await rejection(createRecurringCharge({ leaseId: lease.id, category: 'parking', description: 'Second', amountCents: 9000, startPeriod: '2026-11' }))).toMatchObject({ field: 'category' })
    await expect(endRecurringCharge(schedule.id, '2026-08')).rejects.toThrow()
    // A schedule starting this month can't end before it starts; set one that started earlier in the demo instead.
    const demo = db().recurringCharges.find((entry) => entry.demo) as (typeof schedule)
    const current = db().charges.find((charge) => charge.recurringId === demo.id && charge.period === '2026-10')
    await endRecurringCharge(demo.id, '2026-09')
    const after = db().charges.find((charge) => charge.id === current?.id)
    const touched = db().payments.some((payment) => payment.chargeId === current?.id)
    if (touched) expect(after?.voidedAt).toBeUndefined()
    else expect(after).toMatchObject({ voidedBy: 'system', voidReason: 'The recurring schedule ended before this month.' })
  })
})

describe('expenses', () => {
  const base = { category: 'utilities' as const, payeeName: 'Larkspur Power & Water', propertyId: 'prop_101', description: 'Electricity', amountCents: 41000, billDate: TODAY }

  it('blocks inactive vendors and duplicate invoices, warns on look-alikes, and records payment', async () => {
    expect(await rejection(createExpense({ ...base, payeeName: undefined, vendorId: 'ven_rapid-rooter-drains' }))).toMatchObject({ field: 'vendorId' })
    const bill = await createExpense({ ...base, invoiceNumber: 'LPW-77' })
    expect(bill.dueDate).toBe(addDays(TODAY, 30))
    const blocked = await rejection(createExpense({ ...base, invoiceNumber: 'lpw 77', amountCents: 1 }))
    expect(isFinanceDuplicateError(blocked) && !blocked.requiresConfirmation).toBe(true)
    const warning = await rejection(createExpense(base))
    expect(isFinanceDuplicateError(warning) && warning.requiresConfirmation).toBe(true)
    await createExpense(base, { acknowledgeDuplicate: true })

    expect(await rejection(markExpensePaid(bill.id, { paidOn: addDays(TODAY, 1), method: 'bank-transfer' }))).toMatchObject({ field: 'paidOn' })
    await markExpensePaid(bill.id, { paidOn: TODAY, method: 'bank-transfer', paymentRef: 'ACH 1' })
    expect(await rejection(voidExpense(bill.id, 'Duplicate'))).toMatchObject({ message: expect.stringMatching(/unpaid before voiding/) })
    await markExpenseUnpaid(bill.id, 'Payment bounced')
    await voidExpense(bill.id, 'Duplicate')
    expect(db().expenses.find((entry) => entry.id === bill.id)).toMatchObject({ voidReason: 'Duplicate' })
  })

  it('keeps work-order bills tied to the work order', async () => {
    const bill = db().expenses.find((expense) => expense.source === 'work-order') ?? null
    if (!bill) throw new Error('no bill')
    expect(await rejection(voidExpense(bill.id, 'No'))).toMatchObject({ message: expect.stringMatching(/can’t be voided/) })
    const input = { category: bill.category, vendorId: bill.vendorId, propertyId: bill.propertyId, description: bill.description, amountCents: bill.amountCents + 100, billDate: bill.billDate }
    expect(await rejection(updateExpense(bill.id, input))).toMatchObject({ message: expect.stringMatching(/come from the work order/) })
    await updateExpense(bill.id, { ...input, amountCents: bill.amountCents, dueDate: addDays(bill.dueDate, 5) })
    expect(db().expenses.find((entry) => entry.id === bill.id)).toMatchObject({ amountCents: bill.amountCents, dueDate: addDays(bill.dueDate, 5) })
  })
})

describe('settings', () => {
  it('changes the currency for two-decimal currencies only', async () => {
    expect(await rejection(updateFinanceSettings({ currency: 'JPY', locale: 'ja-JP' }))).toMatchObject({ field: 'currency' })
    await updateFinanceSettings({ currency: 'eur', locale: 'de-DE' })
    expect(db().finance).toMatchObject({ currency: 'EUR', locale: 'de-DE' })
  })
})
