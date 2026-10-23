import { useMemo } from 'react'
import { useLoaderData } from 'react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PROPERTY_TYPE_LABELS } from '@/features/properties/lib/property-meta'
import { ReportFigures } from '@/features/reports/components/report-figures'
import { ReportShell } from '@/features/reports/components/report-shell'
import { ReportTable } from '@/features/reports/components/report-table'
import { ReportToolbar } from '@/features/reports/components/report-toolbar'
import { useReportParams } from '@/features/reports/hooks/use-report-params'
import { reportCsv } from '@/features/reports/lib/report-csv'
import { describeReport } from '@/features/reports/lib/report-describe'
import { reportFileName } from '@/features/reports/lib/report-filters'
import { propertyPerformanceTable } from '@/features/reports/lib/report-tables'
import { type propertyPerformanceLoader } from '@/features/reports/reports.loaders'
import { useFormat } from '@/hooks/use-format'

/** Property performance: cash in and out per property for the period, with current occupancy and today’s open balance. */
export function PropertyPerformancePage() {
  const { meta, report, properties, invalidCustom } = useLoaderData<typeof propertyPerformanceLoader>()
  const { setFilters } = useReportParams()
  const format = useFormat()
  const { money, percent } = format
  const table = useMemo(() => propertyPerformanceTable(report, (type) => PROPERTY_TYPE_LABELS[type]), [report])
  const { totals } = report

  return (
    <ReportShell
      title="Property performance"
      basis="Cash basis"
      description="For each property: billed, collected and the collection rate, expenses paid and incurred, net cash flow (collected − paid) and maintenance paid in the period. Occupancy and the amount due are as of today."
      meta={meta}
      includesSample={report.counted.sample > 0}
      csv={() => ({
        fileName: reportFileName('property-performance', meta.window.from, meta.window.to),
        contents: reportCsv('Property performance', describeReport(meta, format, [`Occupancy and amounts due: as of ${meta.today}`]), table, meta.currency),
      })}
      toolbar={<ReportToolbar filters={meta.filters} properties={properties} window={meta.window} invalidCustom={invalidCustom} onChange={setFilters} />}
    >
      <ReportFigures
        label="Property performance figures"
        figures={[
          { label: 'Collected', value: money(totals.collectedCents), note: `Billed ${money(totals.billedCents)}` },
          { label: 'Collection rate', value: totals.collectionRate === null ? '—' : percent(totals.collectionRate), note: 'Of charges due in the period' },
          { label: 'Expenses paid', value: money(totals.expensesPaidCents), note: `Maintenance ${money(totals.maintenancePaidCents)}` },
          { label: 'Net cash flow', value: money(totals.netCashFlowCents), note: 'Collected − paid', tone: totals.netCashFlowCents < 0 ? 'negative' : 'default' },
          { label: 'Occupancy now', value: totals.occupancy === null ? '—' : percent(totals.occupancy), note: `${totals.occupiedUnits} of ${totals.units} units` },
        ]}
      />
      <Card className="min-w-0 print:border-0 print:shadow-none">
        <CardHeader className="print:px-0">
          <CardTitle role="heading" aria-level={2}>
            By property
          </CardTitle>
          <CardDescription>Collection rate: payments so far on charges due in the period ÷ billed. Maintenance paid is Finance maintenance bills only.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReportTable data={table} caption="Property performance by property" emptyText="No properties match these filters." />
        </CardContent>
      </Card>
    </ReportShell>
  )
}
