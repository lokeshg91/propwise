import { useMemo } from 'react'
import { useLoaderData } from 'react-router'

import { SegmentedControl } from '@/components/shared/segmented-control'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type TrendPoint } from '@/data/domain/finance-summary'
import { CashFlowCard } from '@/features/finance/components/cash-flow-card'
import { ReportFigures } from '@/features/reports/components/report-figures'
import { ReportShell } from '@/features/reports/components/report-shell'
import { ReportTable } from '@/features/reports/components/report-table'
import { ReportToolbar } from '@/features/reports/components/report-toolbar'
import { useReportParams } from '@/features/reports/hooks/use-report-params'
import { reportCsv } from '@/features/reports/lib/report-csv'
import { describeReport } from '@/features/reports/lib/report-describe'
import { reportFileName } from '@/features/reports/lib/report-filters'
import { incomeExpenseTable } from '@/features/reports/lib/report-tables'
import { INCOME_EXPENSE_VIEWS, type IncomeExpenseView, type incomeExpenseLoader } from '@/features/reports/reports.loaders'
import { useFormat } from '@/hooks/use-format'

const VIEW_LABELS: Record<IncomeExpenseView, string> = { month: 'By month', income: 'By income category', expense: 'By expense category' }

/** Income & Expense: cash collected and paid, by month or category, with billed and incurred alongside. */
export function IncomeExpensePage() {
  const { meta, report, properties, invalidCustom, view } = useLoaderData<typeof incomeExpenseLoader>()
  const { set, setFilters } = useReportParams()
  const format = useFormat()
  const { money, month, date } = format
  const table = useMemo(
    () => incomeExpenseTable(report, view, (entry) => (entry.partial ? `${date(entry.from)} – ${date(entry.to)}` : month(entry.period, 'long'))),
    [report, view, date, month],
  )
  const trend: TrendPoint[] = report.months.map((entry) => ({
    period: entry.month.period,
    collectedCents: entry.collectedCents,
    billedCents: entry.billedCents,
    expensesPaidCents: entry.paidCents,
    netCashFlowCents: entry.netCashFlowCents,
  }))
  const { totals } = report

  return (
    <ReportShell
      title="Income & Expense"
      basis="Cash basis"
      description="Money collected and bills paid in the period. Billed (charges by due date) and incurred (bills by bill date) are shown alongside and never added into net cash flow."
      meta={meta}
      includesSample={report.counted.sample > 0}
      csv={() => ({
        fileName: reportFileName('income-expense', meta.window.from, meta.window.to, view),
        contents: reportCsv(`Income & Expense (${VIEW_LABELS[view].toLowerCase()})`, describeReport(meta, format), table, meta.currency),
      })}
      toolbar={
        <ReportToolbar filters={meta.filters} properties={properties} window={meta.window} invalidCustom={invalidCustom} onChange={setFilters}>
          <SegmentedControl label="Group by" value={view} options={INCOME_EXPENSE_VIEWS.map((value) => ({ value, label: VIEW_LABELS[value] }))} onValueChange={(next) => set({ view: next === 'month' ? null : next })} className="max-w-full overflow-x-auto" />
        </ReportToolbar>
      }
    >
      <ReportFigures
        label="Income and expense figures"
        figures={[
          { label: 'Income collected', value: money(totals.collectedCents), note: 'Payments received in the period' },
          { label: 'Expenses paid', value: money(totals.paidCents), note: 'Bills paid in the period' },
          { label: 'Net cash flow', value: money(totals.netCashFlowCents), note: 'Collected − paid', tone: totals.netCashFlowCents < 0 ? 'negative' : 'default' },
          { label: 'Billed', value: money(totals.billedCents), note: 'Charges due in the period' },
          { label: 'Incurred', value: money(totals.incurredCents), note: 'Bills dated in the period' },
        ]}
      />
      {view === 'month' ? (
        <div className="print:break-inside-avoid">
          <CashFlowCard trend={trend} />
        </div>
      ) : null}
      <Card className="min-w-0 print:border-0 print:shadow-none">
        <CardHeader className="print:px-0">
          <CardTitle role="heading" aria-level={2}>
            {VIEW_LABELS[view]}
          </CardTitle>
          <CardDescription>
            {view === 'month'
              ? 'Each month’s cash in and out. Months cut by a custom range only count the dates inside it.'
              : view === 'income'
                ? 'Collected by the category of the charge each payment was for; billed by due date.'
                : 'Paid by paid date; incurred by bill date. Voided bills aren’t counted.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReportTable data={table} caption={`Income and expense ${VIEW_LABELS[view].toLowerCase()}`} emptyText="Nothing was collected, paid, billed or incurred in this period." />
        </CardContent>
      </Card>
    </ReportShell>
  )
}
