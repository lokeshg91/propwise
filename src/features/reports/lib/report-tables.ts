import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS } from '@/data/domain/finance-labels'
import { type IncomeExpenseReport } from '@/data/domain/report-income-expense'
import { type ReportMonth } from '@/data/domain/report-range'
import { type CollectionGroupRow, type RentCollectionReport } from '@/data/domain/report-rent-collection'
import { type MaintenanceFigures, type MaintenanceReport } from '@/data/domain/report-maintenance'
import { type PropertyPerformanceFigures, type PropertyPerformanceReport, type PropertyPerformanceRow } from '@/data/domain/report-property'
import { type ReceivableFigures, type ReceivablesReport } from '@/data/domain/report-receivables'
import { type IncomeExpenseView, type MaintenanceView, type ReceivablesView, type RentCollectionView } from '@/features/reports/reports.loaders'
import { type ReportColumn, type ReportRow, type ReportTableData } from '@/features/reports/lib/report-table'

/** "October 2026", or "Oct 5 – Oct 31, 2026"-style for months cut by a custom range. */
export type MonthLabel = (month: ReportMonth) => string

export function incomeExpenseTable(report: IncomeExpenseReport, view: IncomeExpenseView, monthLabel: MonthLabel): ReportTableData {
  const { totals } = report
  if (view === 'income') {
    const columns: ReportColumn[] = [
      { key: 'category', header: 'Income category', kind: 'text', primary: true },
      { key: 'collected', header: 'Collected', kind: 'amount' },
      { key: 'billed', header: 'Billed (by due date)', kind: 'amount' },
    ]
    return {
      columns,
      rows: report.income.map((row) => ({ category: INCOME_CATEGORY_LABELS[row.category], collected: row.collectedCents, billed: row.billedCents })),
      total: { category: 'Total', collected: totals.collectedCents, billed: totals.billedCents },
    }
  }
  if (view === 'expense') {
    const columns: ReportColumn[] = [
      { key: 'category', header: 'Expense category', kind: 'text', primary: true },
      { key: 'paid', header: 'Paid', kind: 'amount' },
      { key: 'incurred', header: 'Incurred (by bill date)', kind: 'amount' },
    ]
    return {
      columns,
      rows: report.expenses.map((row) => ({ category: EXPENSE_CATEGORY_LABELS[row.category], paid: row.paidCents, incurred: row.incurredCents })),
      total: { category: 'Total', paid: totals.paidCents, incurred: totals.incurredCents },
    }
  }
  const columns: ReportColumn[] = [
    { key: 'month', header: 'Month', kind: 'text', primary: true },
    { key: 'from', header: 'From', kind: 'date', exportOnly: true },
    { key: 'to', header: 'To', kind: 'date', exportOnly: true },
    { key: 'collected', header: 'Collected', kind: 'amount' },
    { key: 'paid', header: 'Expenses paid', kind: 'amount' },
    { key: 'net', header: 'Net cash flow', kind: 'amount' },
    { key: 'billed', header: 'Billed', kind: 'amount', secondary: true },
    { key: 'incurred', header: 'Incurred', kind: 'amount', secondary: true },
  ]
  const rows: ReportRow[] = report.months.map((month) => ({
    month: monthLabel(month.month),
    from: month.month.from,
    to: month.month.to,
    collected: month.collectedCents,
    paid: month.paidCents,
    net: month.netCashFlowCents,
    billed: month.billedCents,
    incurred: month.incurredCents,
  }))
  const first = report.months[0]?.month.from ?? null
  const last = report.months.at(-1)?.month.to ?? null
  return {
    columns,
    rows,
    total: { month: 'Total', from: first, to: last, collected: totals.collectedCents, paid: totals.paidCents, net: totals.netCashFlowCents, billed: totals.billedCents, incurred: totals.incurredCents },
  }
}

const figures = (row: Pick<CollectionGroupRow, 'charges' | 'billedCents' | 'collectedCents' | 'outstandingCents' | 'collectionRate' | 'counts'>) => ({
  charges: row.charges,
  billed: row.billedCents,
  collected: row.collectedCents,
  outstanding: row.outstandingCents,
  rate: row.collectionRate,
  onTime: row.counts['on-time'],
  late: row.counts.late,
  partial: row.counts.partial,
  unpaid: row.counts.unpaid,
  notYetDue: row.counts['not-yet-due'],
})

export function rentCollectionTable(report: RentCollectionReport, view: RentCollectionView): ReportTableData {
  const tenant = view === 'tenant'
  const columns: ReportColumn[] = [
    { key: 'name', header: tenant ? 'Tenant' : 'Property', kind: 'text', primary: true },
    ...(tenant ? [{ key: 'detail', header: 'Property and unit', kind: 'text', secondary: true } satisfies ReportColumn] : []),
    { key: 'charges', header: 'Charges', kind: 'number', secondary: true },
    { key: 'billed', header: 'Billed', kind: 'amount' },
    { key: 'collected', header: 'Collected to date', kind: 'amount' },
    { key: 'outstanding', header: 'Outstanding', kind: 'amount' },
    { key: 'rate', header: 'Collection rate (%)', kind: 'percent' },
    { key: 'onTime', header: 'Paid on time', kind: 'number', secondary: true },
    { key: 'late', header: 'Paid late', kind: 'number', secondary: true },
    { key: 'partial', header: 'Partly paid', kind: 'number', secondary: true },
    { key: 'unpaid', header: 'Unpaid', kind: 'number', secondary: true },
    { key: 'notYetDue', header: 'Not yet due', kind: 'number', secondary: true },
  ]
  const groups = tenant ? report.byTenant : report.byProperty
  return {
    columns,
    rows: groups.map((row) => ({ name: row.name, ...(tenant ? { detail: row.detail ?? null } : {}), ...figures(row) })),
    total: { name: 'Total', ...(tenant ? { detail: null } : {}), ...figures(report.totals) },
  }
}

/* ------------------------------------------------------------- Stage 4 */

const BUCKET_COLUMNS: ReportColumn[] = [
  { key: 'notYetDue', header: 'Not yet due', kind: 'amount' },
  { key: 'dueToday', header: 'Due today', kind: 'amount', secondary: true },
  { key: 'd30', header: '1–30 days', kind: 'amount' },
  { key: 'd60', header: '31–60 days', kind: 'amount', secondary: true },
  { key: 'd90', header: '61–90 days', kind: 'amount', secondary: true },
  { key: 'd90plus', header: '90+ days', kind: 'amount' },
]

const bucketValues = (row: ReceivableFigures) => ({
  notYetDue: row.buckets['not-yet-due'],
  dueToday: row.buckets['due-today'],
  d30: row.buckets['1-30'],
  d60: row.buckets['31-60'],
  d90: row.buckets['61-90'],
  d90plus: row.buckets['90+'],
  total: row.totalOpenCents,
  charges: row.openCharges,
  oldest: row.oldestDueDate,
})

export function receivablesTable(report: ReceivablesReport, view: ReceivablesView): ReportTableData {
  const tenant = view === 'tenant'
  const columns: ReportColumn[] = [
    { key: 'name', header: tenant ? 'Tenant or payer' : 'Property', kind: 'text', primary: true },
    ...(tenant ? [{ key: 'detail', header: 'Property and unit', kind: 'text', secondary: true } satisfies ReportColumn] : []),
    { key: 'charges', header: 'Open charges', kind: 'number', secondary: true },
    ...BUCKET_COLUMNS,
    { key: 'total', header: 'Total open', kind: 'amount' },
    { key: 'oldest', header: 'Oldest due date', kind: 'date', secondary: true },
  ]
  const rows = (tenant ? report.byTenant : report.byProperty).map((row) => ({ name: row.name, ...(tenant ? { detail: row.detail ?? null } : {}), ...bucketValues(row) }))
  return { columns, rows, total: { name: 'Total', ...(tenant ? { detail: null } : {}), ...bucketValues(report.totals) } }
}

const performanceValues = (row: PropertyPerformanceFigures) => ({
  occupancy: row.occupancy,
  billed: row.billedCents,
  collected: row.collectedCents,
  rate: row.collectionRate,
  paid: row.expensesPaidCents,
  incurred: row.expensesIncurredCents,
  net: row.netCashFlowCents,
  maintenance: row.maintenancePaidCents,
  due: row.dueCents,
})

export function propertyPerformanceTable(report: PropertyPerformanceReport, typeLabel: (type: PropertyPerformanceRow['type']) => string): ReportTableData {
  const columns: ReportColumn[] = [
    { key: 'name', header: 'Property', kind: 'text', primary: true },
    { key: 'type', header: 'Type', kind: 'text', secondary: true },
    { key: 'occupancy', header: 'Occupancy now (%)', kind: 'percent' },
    { key: 'billed', header: 'Billed', kind: 'amount', secondary: true },
    { key: 'collected', header: 'Collected', kind: 'amount' },
    { key: 'rate', header: 'Collection rate (%)', kind: 'percent', secondary: true },
    { key: 'paid', header: 'Expenses paid', kind: 'amount' },
    { key: 'incurred', header: 'Incurred', kind: 'amount', secondary: true },
    { key: 'net', header: 'Net cash flow', kind: 'amount' },
    { key: 'maintenance', header: 'Maintenance paid', kind: 'amount', secondary: true },
    { key: 'due', header: 'Due and overdue today', kind: 'amount' },
  ]
  return {
    columns,
    rows: report.rows.map((row) => ({ name: row.name, type: typeLabel(row.type), ...performanceValues(row) })),
    total: { name: 'Total', type: null, ...performanceValues(report.totals) },
  }
}

const maintenanceValues = (row: MaintenanceFigures) => ({
  bills: row.bills,
  total: row.totalCents,
  average: row.bills > 0 ? Math.round(row.totalCents / row.bills) : null,
  workOrder: row.bySource['work-order'],
  manual: row.bySource.manual,
  operating: row.bySource.operating,
})

export function maintenanceTable(report: MaintenanceReport, view: MaintenanceView, categoryLabel: (id: string) => string): ReportTableData {
  const header = view === 'property' ? 'Property' : view === 'payee' ? 'Vendor or payee' : 'Request category'
  const columns: ReportColumn[] = [
    { key: 'name', header, kind: 'text', primary: true },
    { key: 'bills', header: 'Bills', kind: 'number' },
    { key: 'total', header: 'Total', kind: 'amount' },
    { key: 'average', header: 'Average per bill', kind: 'amount', secondary: true },
    { key: 'workOrder', header: 'Work-order bills', kind: 'amount', secondary: true },
    { key: 'manual', header: 'Manual bills', kind: 'amount', secondary: true },
    { key: 'operating', header: 'Operating bills', kind: 'amount', secondary: true },
  ]
  const groups = view === 'property' ? report.byProperty : view === 'payee' ? report.byPayee : report.byCategory
  return {
    columns,
    rows: groups.map((row) => ({ name: view === 'category' ? categoryLabel(row.id) : row.name, ...maintenanceValues(row) })),
    total: { name: 'Total', ...maintenanceValues(report.totals) },
  }
}
