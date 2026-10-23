import { useMemo } from 'react'
import { useLoaderData } from 'react-router'

import { SegmentedControl } from '@/components/shared/segmented-control'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { COLLECTION_STATUSES, type CollectionStatus } from '@/data/domain/report-rent-collection'
import { ReportFigures } from '@/features/reports/components/report-figures'
import { ReportShell } from '@/features/reports/components/report-shell'
import { ReportTable } from '@/features/reports/components/report-table'
import { ReportToolbar } from '@/features/reports/components/report-toolbar'
import { useReportParams } from '@/features/reports/hooks/use-report-params'
import { reportCsv } from '@/features/reports/lib/report-csv'
import { describeReport } from '@/features/reports/lib/report-describe'
import { reportFileName } from '@/features/reports/lib/report-filters'
import { rentCollectionTable } from '@/features/reports/lib/report-tables'
import { RENT_COLLECTION_VIEWS, type RentCollectionView, type rentCollectionLoader } from '@/features/reports/reports.loaders'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

const VIEW_LABELS: Record<RentCollectionView, string> = { property: 'By property', tenant: 'By tenant' }
const STATUS_LABELS: Record<CollectionStatus, string> = { 'on-time': 'Paid on time', late: 'Paid late', partial: 'Partly paid', unpaid: 'Unpaid', 'not-yet-due': 'Not yet due' }
const STATUS_COLORS: Record<CollectionStatus, string> = { 'on-time': 'bg-success', late: 'bg-warning', partial: 'bg-info', unpaid: 'bg-danger', 'not-yet-due': 'bg-muted-foreground/40' }

/** Rent Collection: rent due in the period and how it stands today, plus rent received in the period. */
export function RentCollectionPage() {
  const { meta, report, properties, invalidCustom, view, includeRecurring } = useLoaderData<typeof rentCollectionLoader>()
  const { set, setFilters } = useReportParams()
  const format = useFormat()
  const { money, number, percent, date } = format
  const table = useMemo(() => rentCollectionTable(report, view), [report, view])
  const { totals } = report
  const scopeLine = includeRecurring ? 'Charges: rent and recurring charges' : 'Charges: rent'

  return (
    <ReportShell
      title="Rent Collection"
      basis={`Status as of ${date(meta.today)}`}
      description="Rent due in the period and how much of it has been collected so far. Late means paid after the grace period of the rule in force on the due date. Rent received in the period is shown separately."
      meta={meta}
      extraLines={[scopeLine]}
      includesSample={report.counted.sample > 0}
      csv={() => ({
        fileName: reportFileName('rent-collection', meta.window.from, meta.window.to, view),
        contents: reportCsv(`Rent Collection (${VIEW_LABELS[view].toLowerCase()})`, describeReport(meta, format, [scopeLine, `Status as of: ${meta.today}`]), table, meta.currency),
      })}
      toolbar={
        <ReportToolbar filters={meta.filters} properties={properties} window={meta.window} invalidCustom={invalidCustom} onChange={setFilters}>
          <SegmentedControl label="Group by" value={view} options={RENT_COLLECTION_VIEWS.map((value) => ({ value, label: VIEW_LABELS[value] }))} onValueChange={(next) => set({ view: next === 'property' ? null : next })} />
          <div className="flex items-center gap-2 sm:ml-auto">
            <Switch id="include-recurring" checked={includeRecurring} onCheckedChange={(checked) => set({ recurring: checked ? '1' : null })} />
            <Label htmlFor="include-recurring">Include recurring charges (parking, service charges…)</Label>
          </div>
        </ReportToolbar>
      }
    >
      <ReportFigures
        label="Rent collection figures"
        figures={[
          { label: includeRecurring ? 'Billed' : 'Rent billed', value: money(totals.billedCents), note: `${number(totals.charges)} ${totals.charges === 1 ? 'charge' : 'charges'} due in the period` },
          { label: 'Collected to date', value: money(totals.collectedCents), note: 'Paid against these charges so far' },
          { label: 'Outstanding', value: money(totals.outstandingCents), note: 'Still open on these charges', tone: totals.outstandingCents > 0 ? 'negative' : 'default' },
          { label: 'Collection rate', value: totals.collectionRate === null ? '—' : percent(totals.collectionRate), note: 'Collected ÷ billed' },
          { label: 'Received in the period', value: money(report.receivedInPeriodCents), note: 'Cash received, for any month' },
        ]}
      />

      <Card className="min-w-0 print:break-inside-avoid">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Charges by status
          </CardTitle>
          <CardDescription>Each charge due in the period counts once.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {COLLECTION_STATUSES.map((status) =>
              totals.counts[status] > 0 ? <span key={status} className={cn('h-full', STATUS_COLORS[status])} style={{ width: `${(totals.counts[status] / Math.max(totals.charges, 1)) * 100}%` }} /> : null,
            )}
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {COLLECTION_STATUSES.map((status) => (
              <div key={status} className="flex flex-col gap-0.5">
                <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <span className={cn('size-2 rounded-full', STATUS_COLORS[status])} aria-hidden="true" />
                  {STATUS_LABELS[status]}
                </dt>
                <dd className="text-h3 text-foreground tabular-nums">{number(totals.counts[status])}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      <Card className="min-w-0 print:border-0 print:shadow-none">
        <CardHeader className="print:px-0">
          <CardTitle role="heading" aria-level={2}>
            {VIEW_LABELS[view]}
          </CardTitle>
          <CardDescription>{view === 'tenant' ? 'Tenants with charges due in the period, largest outstanding first.' : 'Properties with charges due in the period.'}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReportTable data={table} caption={`Rent collection ${VIEW_LABELS[view].toLowerCase()}`} emptyText="No charges were due in this period." />
        </CardContent>
      </Card>
    </ReportShell>
  )
}
