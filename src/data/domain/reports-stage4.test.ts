import { agingBucket } from '@/data/domain/finance-rules'
import { expenseBreakdown, propertyPerformance, receivablesFor, totalsFor, type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { type RecordSource } from '@/data/domain/report-income-expense'
import { isMaintenanceBill, maintenanceReport } from '@/data/domain/report-maintenance'
import { propertyPerformanceReport } from '@/data/domain/report-property'
import { resolveReportWindow, type ReportRangeSpec } from '@/data/domain/report-range'
import { RECEIVABLE_BUCKETS, receivableBucket, receivablesReport } from '@/data/domain/report-receivables'
import { chargeState, graceFor, paymentsByCharge } from '@/data/domain/finance-rules'
import { createCharge, createExpense, recordPayment } from '@/data/services'
import { snapshotOf } from '@/data/services/finance-service'
import { readDatabase, resetDemoData, sampleRecordIds } from '@/data/store/demo-store'
import { REPORT_RANGE_PRESETS, type Charge, type Expense, type FinanceRuleVersion, type Payment, type WorkOrder } from '@/types'

const TODAY = '2026-10-12'
const NOW = new Date(`${TODAY}T12:00:00`)
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0)

/* ------------------------------------------------------------ fixtures */

const rule: FinanceRuleVersion = { id: 'a', effectiveFrom: '2025-11-01', graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 }, createdAt: '' }
const charge = (id: string, dueDate: string, amountCents: number, extra: Partial<Charge> = {}): Charge => ({
  id,
  reference: id,
  category: 'rent',
  source: 'lease',
  leaseId: 'lease_a',
  propertyId: 'prop_a',
  unitId: 'unit_a',
  amountCents,
  issuedOn: dueDate,
  dueDate,
  createdAt: '',
  ...extra,
})
const payment = (id: string, chargeId: string, amountCents: number, receivedOn: string, extra: Partial<Payment> = {}): Payment => ({ id, reference: id, chargeId, amountCents, receivedOn, method: 'cash', createdAt: '', ...extra })
const bill = (id: string, extra: Partial<Expense>): Expense => ({
  id,
  reference: id,
  category: 'maintenance',
  source: 'manual',
  propertyId: 'prop_a',
  description: '',
  amountCents: 10000,
  billDate: '2026-09-01',
  dueDate: '2026-10-01',
  paidOn: '2026-09-10',
  createdAt: '',
  ...extra,
})
const base = (): FinanceSnapshot & { tenants: Array<{ id: string; name: string }>; serviceRequests: Array<{ id: string; propertyId: string; category: 'plumbing' | 'hvac' }>; vendors: Array<{ id: string; name: string }> } => ({
  charges: [],
  payments: [],
  expenses: [],
  properties: [
    { id: 'prop_a', name: 'Alpha', type: 'residential' },
    { id: 'prop_b', name: 'Beta', type: 'commercial' },
  ] as unknown as FinanceSnapshot['properties'],
  units: [
    { id: 'unit_a', number: '101', propertyId: 'prop_a', status: 'occupied' },
    { id: 'unit_b', number: '102', propertyId: 'prop_a', status: 'vacant' },
  ] as unknown as FinanceSnapshot['units'],
  leases: [{ id: 'lease_a', tenantId: 'ten_a' }] as unknown as FinanceSnapshot['leases'],
  workOrders: [],
  rules: [rule],
  tenants: [{ id: 'ten_a', name: 'Avery Tenant' }],
  serviceRequests: [
    { id: 'MR-1', propertyId: 'prop_a', category: 'plumbing' },
    { id: 'MR-2', propertyId: 'prop_b', category: 'hvac' },
  ],
  vendors: [{ id: 'ven_a', name: 'Aqua Plumbing' }],
})
const options = { categoryLabel: (category: string) => category, isSampleWorkOrder: () => false }

/* ---------------------------------------------------------- receivables */

describe('Receivables & Aging (C2)', () => {
  it('puts every open balance in exactly one of six buckets', () => {
    const snapshot = base()
    snapshot.charges = [
      charge('future', '2026-10-25', 1000),
      charge('today', '2026-10-12', 2000),
      charge('d10', '2026-10-02', 3000),
      charge('d45', '2026-08-28', 4000),
      charge('d75', '2026-07-29', 5000),
      charge('d120', '2026-06-14', 6000),
      charge('partly', '2026-10-02', 7000),
      charge('paid', '2026-09-05', 8000),
      charge('void', '2026-09-05', 9000, { voidedAt: '2026-09-06' }),
      charge('other', '2026-10-01', 500, { leaseId: undefined, payerName: 'Laundry Co', category: 'other-income' }),
    ]
    snapshot.payments = [payment('p1', 'partly', 2500, '2026-10-05'), payment('p2', 'paid', 8000, '2026-09-05'), payment('p3', 'd10', 1000, '2026-10-05', { voidedAt: '2026-10-06' })]
    const report = receivablesReport(snapshot, TODAY, null, 'all')
    expect(report.totals.buckets).toEqual({ 'not-yet-due': 1000, 'due-today': 2000, '1-30': 3000 + 4500 + 500, '31-60': 4000, '61-90': 5000, '90+': 6000 })
    expect(report.totals).toMatchObject({ openCharges: 8, totalOpenCents: 26000, notYetDueCents: 1000, dueCents: 25000, overdueCents: 23000, oldestDueDate: '2026-06-14' })
    expect(report.byTenant.map((row) => [row.name, row.totalOpenCents])).toEqual([
      ['Avery Tenant', 25500],
      ['Laundry Co', 500],
    ])
    expect(receivableBucket('2026-10-12', 0, TODAY)).toBe('due-today')
    expect(receivableBucket('2026-10-13', 0, TODAY)).toBe('not-yet-due')
    expect(receivableBucket('2026-07-14', 90, TODAY)).toBe('61-90')
    expect(receivableBucket('2026-07-13', 91, TODAY)).toBe('90+')
  })
})

/* ---------------------------------------------------------- maintenance */

describe('Maintenance expenses (C3)', () => {
  it('counts Finance bills only, each bill once, and never adds up work-order costs', () => {
    const snapshot = base()
    const both = bill('wo_bill', { source: 'work-order', workOrderId: 'WO-1-1', requestId: 'MR-1', vendorId: 'ven_a', estimatedCents: 9000, amountCents: 12000 })
    snapshot.expenses = [
      both,
      both, // the same bill twice in the list still counts once
      bill('manual', { amountCents: 3000, payeeName: 'Handy Person' }),
      bill('operating', { source: 'operating', amountCents: 50000, payeeName: 'Lift Service Co', propertyId: 'prop_b' }),
      bill('wo_other_category', { source: 'work-order', category: 'other-expense', workOrderId: 'WO-2-1', requestId: 'MR-2', amountCents: 700, propertyId: 'prop_b' }),
      bill('utilities', { category: 'utilities', amountCents: 99999 }),
      bill('void', { amountCents: 88888, voidedAt: '2026-09-11' }),
      bill('unpaid', { amountCents: 1500, paidOn: undefined, billDate: '2026-09-20' }),
    ]
    const order = (id: string, actualCost: number | null, completedAt: string | null, status: WorkOrder['status'] = 'completed'): WorkOrder =>
      ({ id, requestId: 'MR-1', vendorId: 'ven_a', status, scheduledFor: null, estimatedCost: null, actualCost, notes: '', createdAt: '', updatedAt: '', completedAt, cancelledAt: null }) as WorkOrder
    snapshot.workOrders = [order('WO-1-1', 120, '2026-09-05T10:00:00Z'), order('WO-9-1', null, '2026-09-08T10:00:00Z'), order('WO-9-2', null, '2026-06-01T10:00:00Z'), order('WO-9-3', 5000, '2026-09-09T10:00:00Z')]
    const window = { from: '2026-09-01', to: '2026-09-30' }

    const paid = maintenanceReport(snapshot, window, null, 'all', 'paid', options)
    expect(paid.totals.totalCents).toBe(12000 + 3000 + 50000 + 700)
    expect(paid.totals.bills).toBe(4)
    expect(paid.totals.bySource).toEqual({ 'work-order': 12700, manual: 3000, operating: 50000 })
    expect(paid.averageCents).toBe(Math.round(65700 / 4))
    expect([paid.totals.estimatedBills, paid.totals.estimatedCents, paid.totals.actualOnEstimatedCents, paid.variancePercent]).toEqual([1, 9000, 12000, 33.3])
    expect(paid.completedWithoutCost).toBe(1) // WO-9-1 in September; WO-9-2 is earlier; WO-9-3 has a cost but no bill and adds nothing
    expect(paid.byCategory.map((row) => [row.id, row.totalCents])).toEqual([
      ['plumbing', 12000],
      ['hvac', 700],
      ['not-linked', 53000],
    ])
    expect(paid.byPayee.map((row) => [row.name, row.totalCents])).toEqual([
      ['Lift Service Co', 50000],
      ['Aqua Plumbing', 12000],
      ['Handy Person', 3000],
      ['No payee', 700],
    ])
    const incurred = maintenanceReport(snapshot, window, null, 'all', 'incurred', options)
    expect(incurred.totals.totalCents).toBe(65700 + 1500)

    // Work-order costs are never summed: changing them changes nothing.
    snapshot.workOrders = snapshot.workOrders.map((entry) => ({ ...entry, actualCost: 1_000_000 }))
    expect(maintenanceReport(snapshot, window, null, 'all', 'paid', options).totals).toEqual(paid.totals)
    expect(isMaintenanceBill({ source: 'manual', category: 'utilities' })).toBe(false)
  })
})

/* ------------------------------------------- reconciliation with Finance */

describe('Stage 4 reconciliation with Finance (sample workspace plus user records)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
    resetDemoData()
    const db = readDatabase()
    const lease = db.leases.find((entry) => entry.status === 'active') as (typeof db.leases)[number]
    const created = await createCharge({ leaseId: lease.id, category: 'other-income', amountCents: 4567, dueDate: '2026-11-05', issuedOn: TODAY, description: 'Future user charge' })
    await recordPayment(created.id, { amountCents: 1000, receivedOn: TODAY, method: 'card' })
    const property = db.properties[0] as (typeof db.properties)[number]
    await createExpense({ propertyId: property.id, category: 'maintenance', payeeName: 'User Plumber', description: 'User repair', amountCents: 33333, billDate: '2026-09-10', dueDate: '2026-10-10' }, { paidNow: { paidOn: '2026-09-15', method: 'bank-transfer' } })
  })
  afterEach(() => vi.useRealTimers())

  const db = () => readDatabase()
  const full = () => ({ ...snapshotOf(db()), tenants: db().tenants, serviceRequests: db().serviceRequests, vendors: db().vendors })
  const sampleOptions = () => ({ categoryLabel: (category: string) => category, isSampleWorkOrder: (id: string) => sampleRecordIds().workOrders.has(id) })
  const scopes = (): Array<[string, PropertyScope]> => [
    ['all properties', null],
    ['one property', new Set([db().properties[0]?.id as string])],
    ['commercial only', new Set(db().properties.filter((property) => property.type === 'commercial').map((property) => property.id))],
  ]
  const ranges: ReportRangeSpec[] = [
    ...REPORT_RANGE_PRESETS.map((preset) => ({ kind: 'preset', preset }) as ReportRangeSpec),
    { kind: 'custom', from: '2026-03-15', to: '2026-07-10' },
    { kind: 'custom', from: '2024-01-01', to: '2025-12-31' },
    { kind: 'custom', from: '2026-10-01', to: '2027-03-31' },
  ]

  it('Receivables: six buckets = total open = rows = every open balance; the due part equals Finance receivables', () => {
    const snapshot = full()
    const payments = paymentsByCharge(snapshot.payments)
    for (const [, scope] of scopes()) {
      const report = receivablesReport(snapshot, TODAY, scope, 'all')
      const { totals } = report
      expect(sum(RECEIVABLE_BUCKETS.map((bucket) => totals.buckets[bucket]))).toBe(totals.totalOpenCents)
      expect(totals.dueCents + totals.notYetDueCents).toBe(totals.totalOpenCents)
      expect(sum(report.byTenant.map((row) => row.totalOpenCents))).toBe(totals.totalOpenCents)
      expect(sum(report.byProperty.map((row) => row.totalOpenCents))).toBe(totals.totalOpenCents)
      expect(sum(report.byTenant.map((row) => row.openCharges))).toBe(totals.openCharges)
      for (const bucket of RECEIVABLE_BUCKETS) expect(sum(report.byTenant.map((row) => row.buckets[bucket]))).toBe(totals.buckets[bucket])
      // Independently: every non-void posted charge's open balance.
      const direct = snapshot.charges
        .filter((entry) => !entry.voidedAt && (scope === null || scope.has(entry.propertyId)))
        .map((entry) => chargeState(entry, payments.get(entry.id), TODAY, graceFor(snapshot, entry)).balanceCents)
      expect(sum(direct)).toBe(totals.totalOpenCents)
      // Finance: due only, same buckets.
      const finance = receivablesFor(snapshot, TODAY, scope)
      expect(totals.dueCents).toBe(finance.outstandingCents)
      expect(totals.overdueCents).toBe(finance.overdueCents)
      expect(totals.buckets['due-today']).toBe(finance.aging.current)
      for (const bucket of ['1-30', '31-60', '61-90', '90+'] as const) expect(totals.buckets[bucket]).toBe(finance.aging[bucket])
    }
    // The user's future charge is in Not yet due, not in Finance's outstanding.
    expect(receivablesReport(snapshot, TODAY, null, 'user').totals.buckets['not-yet-due']).toBe(4567 - 1000)
    expect(agingBucket(0)).toBe('current')
  })

  it('Receivables: sample + created by you = all', () => {
    const snapshot = full()
    const [all, sample, user] = (['all', 'sample', 'user'] as RecordSource[]).map((source) => receivablesReport(snapshot, TODAY, null, source).totals)
    for (const bucket of RECEIVABLE_BUCKETS) expect((sample?.buckets[bucket] ?? 0) + (user?.buckets[bucket] ?? 0)).toBe(all?.buckets[bucket])
    expect((sample?.totalOpenCents ?? 0) + (user?.totalOpenCents ?? 0)).toBe(all?.totalOpenCents)
  })

  it('Property performance equals Finance propertyPerformance and totalsFor, per property and in total', () => {
    const snapshot = full()
    for (const spec of ranges) {
      const window = resolveReportWindow(spec, TODAY)
      for (const [, scope] of scopes()) {
        const report = propertyPerformanceReport(snapshot, window, TODAY, scope, 'all', sampleOptions())
        const finance = new Map(propertyPerformance(snapshot, window, TODAY, scope).map((row) => [row.propertyId, row]))
        expect(report.rows).toHaveLength(finance.size)
        for (const row of report.rows) {
          const expected = finance.get(row.id)
          expect(expected).toBeDefined()
          if (!expected) continue
          expect([row.billedCents, row.collectedCents, row.expensesPaidCents, row.expensesIncurredCents, row.netCashFlowCents, row.collectionRate, row.dueCents, row.occupancy]).toEqual([
            expected.totals.billedCents,
            expected.totals.collectedCents,
            expected.totals.expensesPaidCents,
            expected.totals.expensesIncurredCents,
            expected.totals.netCashFlowCents,
            expected.totals.collectionRate,
            expected.outstandingCents,
            expected.occupancy,
          ])
          expect(row.maintenancePaidCents).toBe(maintenanceReport(snapshot, window, new Set([row.id]), 'all', 'paid', sampleOptions()).totals.totalCents)
        }
        const total = totalsFor(snapshot, window, scope)
        expect([report.totals.billedCents, report.totals.collectedCents, report.totals.expensesPaidCents, report.totals.expensesIncurredCents, report.totals.netCashFlowCents, report.totals.collectionRate]).toEqual([
          total.billedCents,
          total.collectedCents,
          total.expensesPaidCents,
          total.expensesIncurredCents,
          total.netCashFlowCents,
          total.collectionRate,
        ])
        expect(report.totals.dueCents).toBe(receivablesFor(snapshot, TODAY, scope).outstandingCents)
        for (const key of ['billedCents', 'collectedCents', 'expensesPaidCents', 'maintenancePaidCents', 'dueCents'] as const) expect(sum(report.rows.map((row) => row[key]))).toBe(report.totals[key])
      }
    }
  })

  it('Maintenance equals the Finance maintenance line plus work-order bills in other categories, with no double counting', () => {
    const snapshot = full()
    for (const spec of ranges) {
      const window = resolveReportWindow(spec, TODAY)
      for (const [, scope] of scopes()) {
        const report = maintenanceReport(snapshot, window, scope, 'all', 'paid', sampleOptions())
        const line = expenseBreakdown(snapshot, window, scope).find((entry) => entry.category === 'maintenance')?.amountCents ?? 0
        const otherWorkOrderBills = snapshot.expenses.filter(
          (entry) => !entry.voidedAt && entry.source === 'work-order' && entry.category !== 'maintenance' && entry.paidOn !== undefined && entry.paidOn >= window.from && entry.paidOn <= window.to && (scope === null || scope.has(entry.propertyId)),
        )
        expect(otherWorkOrderBills).toHaveLength(0) // work-order bills are always Maintenance
        expect(report.totals.totalCents).toBe(line + sum(otherWorkOrderBills.map((entry) => entry.amountCents)))
        expect(sum(Object.values(report.totals.bySource))).toBe(report.totals.totalCents)
        for (const groups of [report.byProperty, report.byPayee, report.byCategory]) {
          expect(sum(groups.map((row) => row.totalCents))).toBe(report.totals.totalCents)
          expect(sum(groups.map((row) => row.bills))).toBe(report.totals.bills)
        }
        const incurred = maintenanceReport(snapshot, window, scope, 'all', 'incurred', sampleOptions())
        const direct = snapshot.expenses.filter((entry) => !entry.voidedAt && isMaintenanceBill(entry) && entry.billDate >= window.from && entry.billDate <= window.to && (scope === null || scope.has(entry.propertyId)))
        expect(incurred.totals.totalCents).toBe(sum(direct.map((entry) => entry.amountCents)))
        expect(incurred.totals.bills).toBe(new Set(direct.map((entry) => entry.id)).size)
      }
    }
    // Work-order costs never change the report.
    const window = resolveReportWindow({ kind: 'preset', preset: '12m' }, TODAY)
    const before = maintenanceReport(snapshot, window, null, 'all', 'paid', sampleOptions())
    const changed = { ...snapshot, workOrders: snapshot.workOrders.map((order) => ({ ...order, actualCost: 999_999 })) }
    expect(maintenanceReport(changed, window, null, 'all', 'paid', sampleOptions()).totals).toEqual(before.totals)
    // The user's bill is counted under "Created by you" only.
    expect(maintenanceReport(snapshot, resolveReportWindow({ kind: 'preset', preset: '3m' }, TODAY), null, 'user', 'paid', sampleOptions()).totals.totalCents).toBe(33333)
  })
})
