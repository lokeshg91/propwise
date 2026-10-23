import { expenseBreakdown, monthlyTrend, receivablesFor, totalsFor, type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { incomeExpenseReport, type RecordSource } from '@/data/domain/report-income-expense'
import { customRangeErrors, noticesFor, resolveReportWindow, type ReportRangeSpec } from '@/data/domain/report-range'
import { collectionStatus, rentCollectionReport } from '@/data/domain/report-rent-collection'
import { createCharge, createExpense, recordPayment } from '@/data/services'
import { snapshotOf } from '@/data/services/finance-service'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
import { REPORT_RANGE_PRESETS, type Charge, type FinanceRuleVersion, type Payment } from '@/types'

const TODAY = '2026-10-12'
const NOW = new Date(`${TODAY}T12:00:00`)

describe('report periods', () => {
  it('resolves every preset to whole calendar months', () => {
    const expected: Record<string, [string, string, number]> = {
      'this-month': ['2026-10-01', '2026-10-31', 1],
      'last-month': ['2026-09-01', '2026-09-30', 1],
      '3m': ['2026-08-01', '2026-10-31', 3],
      '6m': ['2026-05-01', '2026-10-31', 6],
      '12m': ['2025-11-01', '2026-10-31', 12],
      ytd: ['2026-01-01', '2026-10-31', 10],
      'last-year': ['2025-01-01', '2025-12-31', 12],
    }
    for (const preset of REPORT_RANGE_PRESETS) {
      const window = resolveReportWindow({ kind: 'preset', preset }, TODAY)
      const [from, to, months] = expected[preset] as [string, string, number]
      expect([window.from, window.to, window.months.length]).toEqual([from, to, months])
      expect(window.months.every((month) => !month.partial)).toBe(true)
    }
    expect(resolveReportWindow({ kind: 'preset', preset: 'last-month' }, '2026-01-15')).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
  })

  it('splits a custom range into months, marking cut months as partial', () => {
    const window = resolveReportWindow({ kind: 'custom', from: '2026-03-15', to: '2026-05-10' }, TODAY)
    expect(window.months).toEqual([
      { period: '2026-03', from: '2026-03-15', to: '2026-03-31', partial: true },
      { period: '2026-04', from: '2026-04-01', to: '2026-04-30', partial: false },
      { period: '2026-05', from: '2026-05-01', to: '2026-05-10', partial: true },
    ])
    expect(resolveReportWindow({ kind: 'custom', from: '2024-02-29', to: '2024-02-29' }, TODAY).months).toEqual([{ period: '2024-02', from: '2024-02-29', to: '2024-02-29', partial: true }])
    expect(resolveReportWindow({ kind: 'custom', from: '2026-02-01', to: '2026-02-28' }, TODAY).months[0]?.partial).toBe(false)
  })

  it('validates custom ranges: real dates, order and at most five years', () => {
    expect(customRangeErrors('2026-01-01', '2026-12-31')).toEqual({})
    expect(customRangeErrors('2026-02-30', '2026-03-01').from).toMatch(/valid start date/)
    expect(customRangeErrors('2026-01-01', 'soon').to).toMatch(/valid end date/)
    expect(customRangeErrors('2026-05-01', '2026-04-30').to).toMatch(/can’t be before/)
    expect(customRangeErrors('2021-01-01', '2025-12-31')).toEqual({}) // exactly five years
    expect(customRangeErrors('2021-01-01', '2026-01-01').to).toMatch(/at most 5 years/)
    expect(customRangeErrors('2023-02-29', '2023-03-01').from).toBeDefined() // not a leap year
    expect(() => resolveReportWindow({ kind: 'custom', from: '2026-05-01', to: '2026-04-01' }, TODAY)).toThrow()
  })

  it('flags ranges before Finance history, in the future or with partial months', () => {
    const window = resolveReportWindow({ kind: 'custom', from: '2025-06-10', to: '2026-12-31' }, TODAY)
    expect(noticesFor(window, TODAY, '2025-11')).toEqual({ beforeHistory: true, includesFuture: true, partialMonths: true })
    expect(noticesFor(resolveReportWindow({ kind: 'preset', preset: 'last-month' }, TODAY), TODAY, '2025-11')).toEqual({ beforeHistory: false, includesFuture: false, partialMonths: false })
  })
})

/* ------------------------------------------------------------ fixtures */

const rule = (id: string, effectiveFrom: string, graceDays: number): FinanceRuleVersion => ({ id, effectiveFrom, graceDays, lateFee: { residentialCents: 5000, commercialPercent: 5 }, createdAt: '' })
const charge = (id: string, dueDate: string, amountCents: number, extra: Partial<Charge> = {}): Charge => ({
  id,
  reference: id,
  category: 'rent',
  source: 'lease',
  leaseId: 'lease_a',
  propertyId: 'prop_a',
  unitId: 'unit_a',
  period: dueDate.slice(0, 7),
  amountCents,
  issuedOn: dueDate,
  dueDate,
  createdAt: '',
  ...extra,
})
const payment = (id: string, chargeId: string, amountCents: number, receivedOn: string, extra: Partial<Payment> = {}): Payment => ({ id, reference: id, chargeId, amountCents, receivedOn, method: 'cash', createdAt: '', ...extra })

function fixture(): FinanceSnapshot & { tenants: Array<{ id: string; name: string }> } {
  return {
    charges: [
      charge('c_ontime', '2026-08-05', 100000), // paid in full within grace
      charge('c_late', '2026-08-20', 100000), // paid after a 3-day grace (rule from Aug 15)
      charge('c_partial', '2026-09-05', 120000),
      charge('c_unpaid', '2026-10-05', 90000),
      charge('c_future', '2026-10-25', 90000),
      charge('c_void', '2026-09-05', 50000, { voidedAt: '2026-09-06' }),
      charge('c_parking', '2026-09-05', 7500, { category: 'parking', source: 'recurring' }),
      charge('c_out', '2026-07-05', 100000), // before the window
    ],
    payments: [
      payment('p1', 'c_ontime', 100000, '2026-08-09'), // 4 days after: on time with the 5-day rule
      payment('p2', 'c_late', 60000, '2026-08-21'),
      payment('p3', 'c_late', 40000, '2026-08-25'), // 5 days after; grace is 3 under rule b
      payment('p4', 'c_partial', 20000, '2026-09-06'),
      payment('p5', 'c_out', 100000, '2026-08-02'), // July rent received in August
      payment('p6', 'c_partial', 5000, '2026-09-07', { voidedAt: '2026-09-08' }),
      payment('p7', 'c_parking', 7500, '2026-09-05'),
    ],
    expenses: [],
    properties: [{ id: 'prop_a', name: 'Alpha', type: 'residential' } as FinanceSnapshot['properties'][number]],
    units: [{ id: 'unit_a', number: '101', propertyId: 'prop_a', status: 'occupied' } as FinanceSnapshot['units'][number]],
    leases: [{ id: 'lease_a', tenantId: 'ten_a' } as FinanceSnapshot['leases'][number]],
    workOrders: [],
    rules: [rule('a', '2025-11-01', 5), rule('b', '2026-08-15', 3)],
    tenants: [{ id: 'ten_a', name: 'Avery Tenant' }],
  }
}

describe('Rent Collection (hand-computed fixture)', () => {
  const window = { from: '2026-08-01', to: '2026-10-31' }

  it('classifies each charge once, with the rule in force on its due date', () => {
    const report = rentCollectionReport(fixture(), window, null, 'all', TODAY, { includeRecurring: false })
    expect(report.totals).toEqual({
      charges: 5,
      billedCents: 500000,
      collectedCents: 100000 + 100000 + 20000,
      outstandingCents: 100000 + 90000 + 90000,
      collectionRate: 44,
      counts: { 'on-time': 1, late: 1, partial: 1, unpaid: 1, 'not-yet-due': 1 },
    })
    // Rent received in the period, whichever month it was for (includes July's rent paid in August).
    expect(report.receivedInPeriodCents).toBe(100000 + 60000 + 40000 + 20000 + 100000)
    expect(report.byTenant).toEqual([expect.objectContaining({ name: 'Avery Tenant', detail: 'Alpha · Unit 101', billedCents: 500000 })])
  })

  it('adds recurring charges when asked', () => {
    const report = rentCollectionReport(fixture(), window, null, 'all', TODAY, { includeRecurring: true })
    expect(report.totals.charges).toBe(6)
    expect(report.totals.billedCents).toBe(507500)
    expect(report.receivedInPeriodCents).toBe(327500)
  })

  it('maps states to statuses', () => {
    expect(collectionStatus({ dueDate: '2026-10-25' }, { status: 'pending', paidCents: 0, balanceCents: 1, daysOverdue: 0, paidLate: false }, TODAY)).toBe('not-yet-due')
    expect(collectionStatus({ dueDate: '2026-10-12' }, { status: 'pending', paidCents: 0, balanceCents: 1, daysOverdue: 0, paidLate: false }, TODAY)).toBe('unpaid')
  })
})

describe('Income & Expense (hand-computed fixture)', () => {
  it('counts cash by received and paid dates, billed by due date, and excludes voids', () => {
    const snapshot = fixture()
    snapshot.expenses = [
      { id: 'e1', reference: 'e1', category: 'utilities', source: 'manual', propertyId: 'prop_a', description: '', amountCents: 30000, billDate: '2026-07-28', dueDate: '2026-08-27', paidOn: '2026-08-10', createdAt: '' },
      { id: 'e2', reference: 'e2', category: 'maintenance', source: 'manual', propertyId: 'prop_a', description: '', amountCents: 12345, billDate: '2026-09-01', dueDate: '2026-10-01', createdAt: '' },
      { id: 'e3', reference: 'e3', category: 'maintenance', source: 'manual', propertyId: 'prop_a', description: '', amountCents: 99999, billDate: '2026-09-01', dueDate: '2026-10-01', paidOn: '2026-09-02', voidedAt: '2026-09-03', createdAt: '' },
    ]
    const window = resolveReportWindow({ kind: 'custom', from: '2026-08-01', to: '2026-09-30' }, TODAY)
    const report = incomeExpenseReport(snapshot, window, null, 'all')
    expect(report.totals).toEqual({
      collectedCents: 100000 + 60000 + 40000 + 20000 + 100000 + 7500,
      paidCents: 30000,
      netCashFlowCents: 327500 - 30000,
      billedCents: 100000 + 100000 + 120000 + 7500,
      incurredCents: 12345,
    })
    expect(report.months.map((month) => [month.month.period, month.collectedCents, month.paidCents, month.billedCents, month.incurredCents])).toEqual([
      ['2026-08', 300000, 30000, 200000, 0],
      ['2026-09', 27500, 0, 127500, 12345],
    ])
    expect(report.income).toEqual([
      { category: 'rent', collectedCents: 320000, billedCents: 320000 },
      { category: 'parking', collectedCents: 7500, billedCents: 7500 },
    ])
    expect(report.expenses).toEqual([
      { category: 'utilities', paidCents: 30000, incurredCents: 0 },
      { category: 'maintenance', paidCents: 0, incurredCents: 12345 },
    ])
  })
})

/* ------------------------------------------- reconciliation with Finance */

describe('reconciliation with Finance (sample workspace plus user records)', () => {
  // The test setup resets the store before each test, so the user records are added for every test.
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    resetDemoData()
    const db = readDatabase()
    const lease = db.leases.find((entry) => entry.status === 'active') as (typeof db.leases)[number]
    const created = await createCharge({ leaseId: lease.id, category: 'other-income', amountCents: 4567, dueDate: '2026-09-20', issuedOn: '2026-09-01', description: 'User charge' })
    await recordPayment(created.id, { amountCents: 4567, receivedOn: '2026-09-22', method: 'card' })
    const rent = readDatabase().charges.find((entry) => entry.category === 'rent' && entry.dueDate === '2026-10-01' && !entry.voidedAt) as Charge
    await recordPayment(rent.id, { amountCents: 1111, receivedOn: TODAY, method: 'cash' }).catch(() => undefined)
    const property = db.properties[0] as (typeof db.properties)[number]
    await createExpense({ propertyId: property.id, category: 'utilities', payeeName: 'User Power', description: 'User bill', amountCents: 22222, billDate: '2026-09-10', dueDate: '2026-10-10' }, { paidNow: { paidOn: '2026-09-15', method: 'bank-transfer' } })
  })
  afterEach(() => vi.useRealTimers())

  const db = () => readDatabase()
  const scopes = (): Array<[string, PropertyScope]> => {
    const first = db().properties[0]?.id as string
    return [
      ['all properties', null],
      ['one property', new Set([first])],
      ['commercial only', new Set(db().properties.filter((property) => property.type === 'commercial').map((property) => property.id))],
    ]
  }
  const ranges: Array<[string, ReportRangeSpec]> = [
    ...REPORT_RANGE_PRESETS.map((preset) => [preset, { kind: 'preset', preset }] as [string, ReportRangeSpec]),
    ['custom across months', { kind: 'custom', from: '2026-03-15', to: '2026-07-10' }],
    ['custom before history', { kind: 'custom', from: '2024-01-01', to: '2025-12-31' }],
    ['custom into the future', { kind: 'custom', from: '2026-10-01', to: '2027-03-31' }],
  ]

  it('Income & Expense equals Finance totals, the monthly trend and the expense breakdown', () => {
    const snapshot = snapshotOf(db())
    let checks = 0
    for (const [, spec] of ranges) {
      const window = resolveReportWindow(spec, TODAY)
      for (const [, scope] of scopes()) {
        const report = incomeExpenseReport(snapshot, window, scope, 'all')
        const finance = totalsFor(snapshot, window, scope)
        expect(report.totals).toEqual({
          collectedCents: finance.collectedCents,
          paidCents: finance.expensesPaidCents,
          netCashFlowCents: finance.netCashFlowCents,
          billedCents: finance.billedCents,
          incurredCents: finance.expensesIncurredCents,
        })
        const full = window.months.filter((month) => !month.partial)
        const trend = monthlyTrend(snapshot, full.map((month) => month.period), scope)
        for (const point of trend) {
          const row = report.months.find((month) => month.month.period === point.period)
          expect([row?.collectedCents, row?.billedCents, row?.paidCents, row?.netCashFlowCents]).toEqual([point.collectedCents, point.billedCents, point.expensesPaidCents, point.netCashFlowCents])
        }
        const breakdown = new Map(expenseBreakdown(snapshot, window, scope).map((entry) => [entry.category, entry.amountCents]))
        for (const row of report.expenses) expect(row.paidCents).toBe(breakdown.get(row.category) ?? 0)
        // Rows add up to the totals.
        const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)
        expect(sum(report.months.map((month) => month.collectedCents))).toBe(report.totals.collectedCents)
        expect(sum(report.months.map((month) => month.paidCents))).toBe(report.totals.paidCents)
        expect(sum(report.months.map((month) => month.billedCents))).toBe(report.totals.billedCents)
        expect(sum(report.months.map((month) => month.incurredCents))).toBe(report.totals.incurredCents)
        expect(sum(report.income.map((row) => row.collectedCents))).toBe(report.totals.collectedCents)
        expect(sum(report.income.map((row) => row.billedCents))).toBe(report.totals.billedCents)
        expect(sum(report.expenses.map((row) => row.paidCents))).toBe(report.totals.paidCents)
        checks += 1
      }
    }
    expect(checks).toBe(ranges.length * 3)
  })

  it('sample + created by you = all records, for every figure', () => {
    const snapshot = snapshotOf(db())
    for (const [, spec] of ranges) {
      const window = resolveReportWindow(spec, TODAY)
      const [all, sample, user] = (['all', 'sample', 'user'] as RecordSource[]).map((source) => incomeExpenseReport(snapshot, window, null, source))
      for (const key of ['collectedCents', 'paidCents', 'billedCents', 'incurredCents', 'netCashFlowCents'] as const) {
        expect((sample?.totals[key] ?? 0) + (user?.totals[key] ?? 0)).toBe(all?.totals[key])
      }
      const rents = (['all', 'sample', 'user'] as RecordSource[]).map((source) => rentCollectionReport({ ...snapshot, tenants: db().tenants }, window, null, source, TODAY, { includeRecurring: true }))
      for (const key of ['charges', 'billedCents', 'collectedCents', 'outstandingCents'] as const) {
        expect((rents[1]?.totals[key] ?? 0) + (rents[2]?.totals[key] ?? 0)).toBe(rents[0]?.totals[key])
      }
    }
    const user = incomeExpenseReport(snapshot, resolveReportWindow({ kind: 'preset', preset: '3m' }, TODAY), null, 'user')
    expect(user.totals.paidCents).toBe(22222)
    expect(user.counted.sample).toBe(0)
  })

  it('Rent Collection adds up and matches Finance balances and cash', () => {
    const snapshot = snapshotOf(db())
    for (const [, spec] of ranges) {
      const window = resolveReportWindow(spec, TODAY)
      for (const [, scope] of scopes()) {
        for (const includeRecurring of [false, true]) {
          const report = rentCollectionReport({ ...snapshot, tenants: db().tenants }, window, scope, 'all', TODAY, { includeRecurring })
          const { totals } = report
          expect(totals.billedCents).toBe(totals.collectedCents + totals.outstandingCents)
          expect(Object.values(totals.counts).reduce((a, b) => a + b, 0)).toBe(totals.charges)
          for (const groups of [report.byProperty, report.byTenant]) {
            for (const key of ['charges', 'billedCents', 'collectedCents', 'outstandingCents'] as const) {
              expect(groups.reduce((total, row) => total + row[key], 0)).toBe(totals[key])
            }
          }
          // Outstanding on charges already due equals Finance receivables for the same charges.
          const counted = snapshot.charges.filter(
            (entry) => !entry.voidedAt && (entry.category === 'rent' || (includeRecurring && entry.source === 'recurring')) && entry.dueDate >= window.from && entry.dueDate <= window.to && (scope === null || scope.has(entry.propertyId)),
          )
          const receivables = receivablesFor({ ...snapshot, charges: counted }, TODAY, scope)
          const notYetDue = counted.filter((entry) => entry.dueDate > TODAY)
          const future = rentCollectionReport({ ...snapshot, charges: notYetDue, tenants: db().tenants }, window, scope, 'all', TODAY, { includeRecurring }).totals.outstandingCents
          expect(totals.outstandingCents).toBe(receivables.outstandingCents + future)
          // Billed equals the Finance billed total of the same charges.
          expect(totals.billedCents).toBe(totalsFor({ ...snapshot, charges: counted }, window, scope).billedCents)
          if (!includeRecurring) {
            const cash = incomeExpenseReport(snapshot, window, scope, 'all').income.find((row) => row.category === 'rent')?.collectedCents ?? 0
            expect(report.receivedInPeriodCents).toBe(cash)
          }
        }
      }
    }
  })

  it('a range before Finance history has no figures (nothing is made up)', () => {
    const snapshot = snapshotOf(db())
    const window = resolveReportWindow({ kind: 'custom', from: '2024-01-01', to: '2024-12-31' }, TODAY)
    const report = incomeExpenseReport(snapshot, window, null, 'all')
    expect(report.totals).toEqual({ collectedCents: 0, paidCents: 0, netCashFlowCents: 0, billedCents: 0, incurredCents: 0 })
    expect(rentCollectionReport({ ...snapshot, tenants: db().tenants }, window, null, 'all', TODAY, { includeRecurring: true }).totals.charges).toBe(0)
  })
})
