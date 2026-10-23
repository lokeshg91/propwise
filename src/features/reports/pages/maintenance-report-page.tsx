import { useMemo } from 'react'
import { useLoaderData } from 'react-router'

import { SegmentedControl } from '@/components/shared/segmented-control'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { NOT_LINKED } from '@/data/domain/report-maintenance'
import { CATEGORY_LABELS } from '@/features/maintenance/lib/request-meta'
import { ReportFigures } from '@/features/reports/components/report-figures'
import { ReportShell } from '@/features/reports/components/report-shell'
import { ReportTable } from '@/features/reports/components/report-table'
import { ReportToolbar } from '@/features/reports/components/report-toolbar'
import { useReportParams } from '@/features/reports/hooks/use-report-params'
import { reportCsv } from '@/features/reports/lib/report-csv'
import { describeReport } from '@/features/reports/lib/report-describe'
import { reportFileName } from '@/features/reports/lib/report-filters'
import { maintenanceTable } from '@/features/reports/lib/report-tables'
import { MAINTENANCE_VIEWS, type MaintenanceView, type maintenanceLoader } from '@/features/reports/reports.loaders'
import { useFormat } from '@/hooks/use-format'
import { formatSigned } from '@/lib/format'
import { type RequestCategory } from '@/types'

const VIEW_LABELS: Record<MaintenanceView, string> = { property: 'By property', payee: 'By vendor or payee', category: 'By request category' }
const BASIS_LABELS = { paid: 'Paid (by paid date)', incurred: 'Incurred (by bill date)' } as const
const categoryLabel = (id: string) => (id === NOT_LINKED ? 'Not linked to a request' : (CATEGORY_LABELS[id as RequestCategory] ?? id))

/** Maintenance expenses: Finance maintenance bills only, each bill once. */
export function MaintenanceReportPage() {
  const { meta, report, properties, invalidCustom, view, basis } = useLoaderData<typeof maintenanceLoader>()
  const { set, setFilters } = useReportParams()
  const format = useFormat()
  const { money, number, percent } = format
  const table = useMemo(() => maintenanceTable(report, view, categoryLabel), [report, view])
  const { totals } = report
  const basisLine = `Basis: ${BASIS_LABELS[basis]}`

  return (
    <ReportShell
      title="Maintenance expenses"
      basis={basis === 'paid' ? 'Cash basis' : 'Incurred basis'}
      description="Finance bills only: work-order bills and any bill in the Maintenance category, each counted once. Work-order costs are never added up separately; a completed job without a final cost has no bill and is only counted."
      meta={meta}
      extraLines={[basisLine]}
      includesSample={report.counted.sample > 0}
      csv={() => ({
        fileName: reportFileName('maintenance-expenses', meta.window.from, meta.window.to, `${view}-${basis}`),
        contents: reportCsv(`Maintenance expenses (${VIEW_LABELS[view].toLowerCase()})`, describeReport(meta, format, [basisLine]), table, meta.currency),
      })}
      toolbar={
        <ReportToolbar filters={meta.filters} properties={properties} window={meta.window} invalidCustom={invalidCustom} onChange={setFilters}>
          <SegmentedControl label="Group by" value={view} options={MAINTENANCE_VIEWS.map((value) => ({ value, label: VIEW_LABELS[value] }))} onValueChange={(next) => set({ view: next === 'property' ? null : next })} className="max-w-full overflow-x-auto" />
          <SegmentedControl
            label="Basis"
            value={basis}
            options={[
              { value: 'paid', label: 'Paid' },
              { value: 'incurred', label: 'Incurred' },
            ]}
            onValueChange={(next) => set({ basis: next === 'paid' ? null : next })}
            className="sm:ml-auto"
          />
        </ReportToolbar>
      }
    >
      <ReportFigures
        label="Maintenance figures"
        figures={[
          { label: basis === 'paid' ? 'Maintenance paid' : 'Maintenance incurred', value: money(totals.totalCents), note: `${number(totals.bills)} ${totals.bills === 1 ? 'bill' : 'bills'}` },
          { label: 'Average per bill', value: report.averageCents === null ? '—' : money(report.averageCents) },
          {
            label: 'Actual vs estimate',
            value: report.variancePercent === null ? '—' : formatSigned(report.variancePercent, (value) => percent(value)),
            note: totals.estimatedBills > 0 ? `${number(totals.estimatedBills)} bills with an estimate: ${money(totals.actualOnEstimatedCents)} vs ${money(totals.estimatedCents)}` : 'No bills with an estimate',
          },
          { label: 'Work-order bills', value: money(totals.bySource['work-order']), note: `Manual ${money(totals.bySource.manual)} · operating ${money(totals.bySource.operating)}` },
          { label: 'Completed without a final cost', value: number(report.completedWithoutCost), note: 'Work orders with no bill; no amount counted' },
        ]}
      />
      <Card className="min-w-0 print:border-0 print:shadow-none">
        <CardHeader className="print:px-0">
          <CardTitle role="heading" aria-level={2}>
            {VIEW_LABELS[view]}
          </CardTitle>
          <CardDescription>
            {view === 'category' ? 'By the category of the request a bill is linked to. Bills without a request (manual and operating bills) are listed as not linked.' : 'Largest total first.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReportTable data={table} caption={`Maintenance expenses ${VIEW_LABELS[view].toLowerCase()}`} emptyText="No maintenance bills in this period." />
        </CardContent>
      </Card>
    </ReportShell>
  )
}
