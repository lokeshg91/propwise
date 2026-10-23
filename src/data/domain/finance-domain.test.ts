import {
  agingBucket,
  chargeState,
  costVariancePercent,
  expenseStatus,
  findChargeDuplicates,
  findExpenseDuplicates,
  findPaymentDuplicates,
  lateFeeBlock,
  normalizeInvoiceNumber,
  suggestedLateFeeCents,
} from '@/data/domain/finance-rules'
import {
  addPeriods,
  dueDateFor,
  expectedRentCharge,
  lastDayOf,
  leaseBillablePeriods,
  leaseBillingBlock,
  periodRange,
  projectedRent,
  recurringBillablePeriods,
  type ScheduleContext,
} from '@/data/domain/finance-schedule'
import { resolveRange, receivablesFor, totalsFor, type FinanceSnapshot } from '@/data/domain/finance-summary'
import { isSupportedCurrency, isValidCents, MAX_CENTS, percentOfCents, ratioPercent, sumCents, toCents } from '@/data/domain/money'
import { DEFAULT_CURRENCY, formatMoney } from '@/lib/format'
import { type Charge, type Expense, type Lease, type Payment, type RecurringCharge } from '@/types'

const charge = (overrides: Partial<Charge> = {}): Charge => ({
  id: 'chg_1',
  reference: 'INC-1',
  category: 'rent',
  source: 'lease',
  leaseId: 'lease_1',
  propertyId: 'prop_1',
  period: '2026-09',
  amountCents: 100000,
  issuedOn: '2026-09-01',
  dueDate: '2026-09-01',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
})
const payment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay_1',
  reference: 'PAY-1',
  chargeId: 'chg_1',
  amountCents: 100000,
  receivedOn: '2026-09-01',
  method: 'bank-transfer',
  createdAt: '2026-09-01T00:00:00.000Z',
  ...overrides,
})
const lease = (overrides: Partial<Lease> = {}): Lease => ({
  id: 'lease_1',
  tenantId: 'ten_1',
  propertyId: 'prop_1',
  unitId: 'unit_1',
  startDate: '2026-01-15',
  endDate: '2027-01-15',
  monthlyRent: 1500,
  securityDeposit: 1500,
  paymentDueDay: 1,
  status: 'active',
  endedAt: null,
  endReason: null,
  createdAt: '2026-01-10T12:00:00.000Z',
  updatedAt: '2026-01-10T12:00:00.000Z',
  ...overrides,
})
const context = (overrides: Partial<ScheduleContext> = {}): ScheduleContext => ({
  startPeriod: '2025-11',
  throughPeriod: '2026-10',
  cancelledLeaseIds: new Set(),
  ...overrides,
})

describe('money', () => {
  it('converts to integer cents without float noise', () => {
    expect(toCents(12.345)).toBe(1235)
    expect(toCents(1.005)).toBe(101)
    expect(toCents(0.1 + 0.2)).toBe(30)
    expect(toCents(-12.345)).toBe(-1235)
    expect(toCents(1490)).toBe(149000)
    expect(() => toCents(Number.NaN)).toThrow()
    expect(sumCents([10, 20, 30])).toBe(60)
    expect(percentOfCents(185000, 5)).toBe(9250)
    expect(percentOfCents(12345, 5)).toBe(617)
  })

  it('validates amounts and ratios', () => {
    expect(isValidCents(1)).toBe(true)
    expect(isValidCents(0)).toBe(false)
    expect(isValidCents(1.5)).toBe(false)
    expect(isValidCents(MAX_CENTS + 1)).toBe(false)
    expect(ratioPercent(1, 3)).toBe(33.3)
    expect(ratioPercent(5, 0)).toBeNull()
  })

  it('formats through the configured currency, not a hardcoded symbol', () => {
    expect(formatMoney(125050)).toBe('$1,250.50')
    expect(formatMoney(125050, { currency: 'EUR', locale: 'de-DE' }).replace(/\s/g, ' ')).toBe('1.250,50 €')
    expect(formatMoney(125050, { currency: 'GBP', locale: 'en-GB' })).toBe('£1,250.50')
    expect(formatMoney(-500, DEFAULT_CURRENCY)).toBe('-$5.00')
    expect(formatMoney(125050, DEFAULT_CURRENCY, { whole: true })).toBe('$1,251')
    expect(isSupportedCurrency('EUR')).toBe(true)
    expect(isSupportedCurrency('JPY')).toBe(false)
    expect(isSupportedCurrency('XYZ1')).toBe(false)
  })
})

describe('charge status', () => {
  const today = '2026-10-22'

  it('is pending until the due date, then overdue', () => {
    expect(chargeState(charge({ dueDate: '2026-10-22' }), [], today).status).toBe('pending')
    expect(chargeState(charge({ dueDate: '2026-10-25' }), [], today).status).toBe('pending')
    expect(chargeState(charge({ dueDate: '2026-10-21' }), [], today)).toMatchObject({ status: 'overdue', daysOverdue: 1, balanceCents: 100000 })
  })

  it('handles partial, full, late and voided payments', () => {
    const partial = chargeState(charge(), [payment({ amountCents: 40000 })], today)
    expect(partial).toMatchObject({ status: 'partially-paid', paidCents: 40000, balanceCents: 60000, daysOverdue: 51 })
    expect(chargeState(charge(), [payment({ amountCents: 40000 }), payment({ id: 'p2', amountCents: 60000 })], today).status).toBe('paid')
    // Paid on grace day 5 isn't late; day 6 is.
    expect(chargeState(charge(), [payment({ receivedOn: '2026-09-06' })], today, 5).paidLate).toBe(false)
    expect(chargeState(charge(), [payment({ receivedOn: '2026-09-07' })], today, 5).paidLate).toBe(true)
    // A voided payment doesn't count.
    expect(chargeState(charge(), [payment({ voidedAt: 'x', voidReason: 'Returned' })], today).status).toBe('overdue')
    expect(chargeState(charge({ voidedAt: 'x', voidReason: 'Error' }), [], today)).toMatchObject({ status: 'void', balanceCents: 0 })
  })

  it('derives expense status', () => {
    expect(expenseStatus({ dueDate: '2026-10-22' }, today)).toBe('pending')
    expect(expenseStatus({ dueDate: '2026-10-21' }, today)).toBe('overdue')
    expect(expenseStatus({ dueDate: '2026-10-21', paidOn: '2026-10-20' }, today)).toBe('paid')
    expect(expenseStatus({ dueDate: '2026-10-21', voidedAt: 'x' }, today)).toBe('void')
  })

  it('buckets aging at the boundaries', () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91].map(agingBucket)).toEqual(['current', '1-30', '1-30', '31-60', '31-60', '61-90', '61-90', '90+'])
  })
})

describe('late fees', () => {
  const settings = { lateFee: { residentialCents: 5000, commercialPercent: 5 } }
  it('suggests $50 residential and 5 % commercial (rounded to the cent)', () => {
    expect(suggestedLateFeeCents(charge(), 'residential', settings)).toBe(5000)
    expect(suggestedLateFeeCents(charge({ amountCents: 123457 }), 'commercial', settings)).toBe(6173)
  })

  it('is allowed once, after the grace period, on open rent only', () => {
    const open = (today: string) => chargeState(charge(), [], today)
    expect(lateFeeBlock(charge(), open('2026-09-06'), '2026-09-06', 5, false)).toBe('within-grace')
    expect(lateFeeBlock(charge(), open('2026-09-07'), '2026-09-07', 5, false)).toBeNull()
    expect(lateFeeBlock(charge(), open('2026-09-07'), '2026-09-07', 5, true)).toBe('already-charged')
    expect(lateFeeBlock(charge({ category: 'parking' }), open('2026-09-07'), '2026-09-07', 5, false)).toBe('not-rent')
    const paid = chargeState(charge(), [payment()], '2026-09-20')
    expect(lateFeeBlock(charge(), paid, '2026-09-20', 5, false)).toBe('paid')
  })
})

describe('duplicates', () => {
  const expense = (overrides: Partial<Expense> = {}): Expense => ({
    id: 'exp_1',
    reference: 'EXP-1',
    category: 'utilities',
    source: 'manual',
    payeeName: 'Larkspur Power & Water',
    propertyId: 'prop_1',
    description: 'Electricity',
    invoiceNumber: 'INV-0042',
    amountCents: 50000,
    billDate: '2026-10-01',
    dueDate: '2026-10-20',
    createdAt: 'x',
    ...overrides,
  })

  it('normalises invoice numbers', () => {
    expect(normalizeInvoiceNumber(' inv #0042 ')).toBe(normalizeInvoiceNumber('INV-0042'))
    expect(normalizeInvoiceNumber('No. 42')).toBe('42')
    expect(normalizeInvoiceNumber('0042')).toBe('42')
  })

  it('blocks the same invoice for the same payee and warns for same payee, property, amount and date', () => {
    const existing = [expense()]
    expect(findExpenseDuplicates(existing, { ...expense(), invoiceNumber: 'inv 0042', payeeName: '  larkspur power & water ' }).blocking).toHaveLength(1)
    // Different payee: no match.
    expect(findExpenseDuplicates(existing, { ...expense(), payeeName: 'Other Co' }).blocking).toHaveLength(0)
    const warn = findExpenseDuplicates(existing, { ...expense(), invoiceNumber: undefined })
    expect(warn).toMatchObject({ blocking: [], warnings: [{ id: 'exp_1' }] })
    // Voided bills and the bill being edited are ignored.
    expect(findExpenseDuplicates([expense({ voidedAt: 'x' })], expense()).blocking).toHaveLength(0)
    expect(findExpenseDuplicates(existing, expense(), 'exp_1').blocking).toHaveLength(0)
  })

  it('warns on repeated charges and payments', () => {
    const manual = charge({ id: 'chg_m', source: 'manual', category: 'parking', amountCents: 2500, dueDate: '2026-10-01' })
    expect(findChargeDuplicates([manual], { ...manual })).toHaveLength(1)
    expect(findChargeDuplicates([manual], { ...manual, amountCents: 2600 })).toHaveLength(0)
    expect(findPaymentDuplicates([payment()], { chargeId: 'chg_1', amountCents: 100000, receivedOn: '2026-09-01' })).toHaveLength(1)
    expect(findPaymentDuplicates([payment({ voidedAt: 'x' })], { chargeId: 'chg_1', amountCents: 100000, receivedOn: '2026-09-01' })).toHaveLength(0)
  })

  it('reports cost variance only with a usable estimate', () => {
    expect(costVariancePercent(20000, 21500)).toBe(7.5)
    expect(costVariancePercent(undefined, 21500)).toBeNull()
    expect(costVariancePercent(0, 21500)).toBeNull()
  })
})

describe('rent schedule', () => {
  it('works with months across year ends', () => {
    expect(addPeriods('2025-11', 3)).toBe('2026-02')
    expect(addPeriods('2026-01', -1)).toBe('2025-12')
    expect(periodRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(lastDayOf('2024-02')).toBe('2024-02-29')
    expect(dueDateFor('2026-02', 28)).toBe('2026-02-28')
  })

  it('bills a full month when the due date is inside the lease (no proration)', () => {
    // Starts Jan 15 with rent due on the 1st: first charge is February.
    expect(leaseBillablePeriods(lease(), context())[0]).toBe('2026-02')
    expect(leaseBillablePeriods(lease({ paymentDueDay: 20 }), context())[0]).toBe('2026-01')
    expect(leaseBillablePeriods(lease(), context()).at(-1)).toBe('2026-10')
  })

  it('stops at move-out, keeps billing in holdover and never bills pending or cancelled leases', () => {
    const ended = lease({ status: 'terminated', endedAt: '2026-06-10' })
    expect(leaseBillablePeriods(ended, context()).at(-1)).toBe('2026-06')
    expect(leaseBillingBlock(ended, '2026-07', context())).toBe('after-lease-end')
    const holdover = lease({ endDate: '2026-05-15' })
    expect(leaseBillablePeriods(holdover, context()).at(-1)).toBe('2026-10')
    expect(leaseBillablePeriods(lease({ status: 'pending' }), context())).toEqual([])
    expect(leaseBillablePeriods(lease({ status: 'terminated', endedAt: '2026-10-01' }), context({ cancelledLeaseIds: new Set(['lease_1']) }))).toEqual([])
  })

  it('starts backdated leases from the month they were recorded and respects the finance start', () => {
    const backdated = lease({ startDate: '2025-06-01', createdAt: '2026-08-12T09:00:00.000Z' })
    expect(leaseBillablePeriods(backdated, context())[0]).toBe('2026-08')
    expect(leaseBillingBlock(backdated, '2026-07', context())).toBe('before-recorded')
    const old = lease({ startDate: '2024-01-01', createdAt: '2024-01-01T00:00:00.000Z' })
    expect(leaseBillablePeriods(old, context())[0]).toBe('2025-11')
    expect(leaseBillingBlock(old, '2026-11', context())).toBe('future')
  })

  it('derives the expected charge from current terms and projects next month', () => {
    expect(expectedRentCharge(lease(), '2026-02', 150000)).toEqual({
      amountCents: 150000,
      dueDate: '2026-02-01',
      issuedOn: '2026-02-01',
      propertyId: 'prop_1',
      unitId: 'unit_1',
    })
    expect(expectedRentCharge(lease({ startDate: '2026-02-10', paymentDueDay: 20 }), '2026-02', 1).issuedOn).toBe('2026-02-10')
    const projected = projectedRent([lease(), lease({ id: 'l2', status: 'pending' })], context(), () => 150000)
    expect(projected).toEqual([expect.objectContaining({ leaseId: 'lease_1', period: '2026-11', dueDate: '2026-11-01' })])
  })

  it('bills recurring schedules inside both the schedule and the lease', () => {
    const schedule: RecurringCharge = {
      id: 'rc_1',
      leaseId: 'lease_1',
      category: 'parking',
      description: 'Parking',
      amountCents: 7500,
      startPeriod: '2026-03',
      endPeriod: '2026-05',
      createdAt: 'x',
    }
    expect(recurringBillablePeriods(schedule, lease(), context())).toEqual(['2026-03', '2026-04', '2026-05'])
    expect(recurringBillablePeriods({ ...schedule, endPeriod: undefined }, lease({ status: 'expired', endedAt: '2026-07-15' }), context()).at(-1)).toBe('2026-07')
  })
})

describe('summaries', () => {
  it('resolves month ranges with a previous window of the same length', () => {
    expect(resolveRange('3m', '2026-10-22')).toMatchObject({ from: '2026-08-01', to: '2026-10-31', previous: { from: '2026-05-01', to: '2026-07-31' } })
    expect(resolveRange('ytd', '2026-01-05').periods).toEqual(['2026-01'])
    expect(resolveRange('12m', '2026-10-22').periods).toHaveLength(12)
  })

  const snapshot = (overrides: Partial<FinanceSnapshot> = {}): FinanceSnapshot => ({
    charges: [
      charge({ id: 'a', dueDate: '2026-09-01' }),
      charge({ id: 'b', dueDate: '2026-10-01' }),
      charge({ id: 'c', dueDate: '2026-10-01', voidedAt: 'x', voidReason: 'Error' }),
      charge({ id: 'd', dueDate: '2026-10-01', propertyId: 'prop_2' }),
    ],
    payments: [
      payment({ id: 'p1', chargeId: 'a', receivedOn: '2026-09-02' }),
      payment({ id: 'p2', chargeId: 'b', amountCents: 30000, receivedOn: '2026-10-03' }),
      payment({ id: 'p3', chargeId: 'b', amountCents: 10000, receivedOn: '2026-10-04', voidedAt: 'x', voidReason: 'Returned' }),
    ],
    expenses: [
      { id: 'e1', reference: 'EXP-1', category: 'utilities', source: 'manual', payeeName: 'X', propertyId: 'prop_1', description: 'x', amountCents: 20000, billDate: '2026-10-01', dueDate: '2026-10-15', paidOn: '2026-10-10', createdAt: 'x' },
      { id: 'e2', reference: 'EXP-2', category: 'insurance', source: 'manual', payeeName: 'Y', propertyId: 'prop_1', description: 'y', amountCents: 5000, billDate: '2026-10-05', dueDate: '2026-11-05', createdAt: 'x' },
    ],
    properties: [],
    units: [],
    leases: [],
    workOrders: [],
    rules: [{ id: 'rule_initial', effectiveFrom: '2025-11-01', graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 }, createdAt: 'x' }],
    ...overrides,
  })

  it('reports cash basis with billed and incurred alongside', () => {
    const october = { from: '2026-10-01', to: '2026-10-31' }
    expect(totalsFor(snapshot(), october, null)).toEqual({
      collectedCents: 30000,
      billedCents: 200000,
      expensesPaidCents: 20000,
      expensesIncurredCents: 25000,
      netCashFlowCents: 10000,
      collectionRate: 15,
    })
    expect(totalsFor(snapshot(), october, new Set(['prop_2']))).toMatchObject({ billedCents: 100000, collectedCents: 0, collectionRate: 0 })
    expect(totalsFor(snapshot(), { from: '2030-01-01', to: '2030-01-31' }, null).collectionRate).toBeNull()
  })

  it('computes receivables and aging as of today', () => {
    expect(receivablesFor(snapshot(), '2026-10-22', null)).toMatchObject({
      outstandingCents: 170000,
      overdueCents: 170000,
      openCharges: 2,
      oldestOverdueDays: 21,
      aging: { current: 0, '1-30': 170000, '31-60': 0, '61-90': 0, '90+': 0 },
    })
  })
})
