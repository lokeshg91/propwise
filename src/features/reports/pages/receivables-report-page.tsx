import { useMemo } from 'react'
import { useLoaderData } from 'react-router'

import { SegmentedControl } from '@/components/shared/segmented-control'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RECEIVABLE_BUCKETS, type ReceivableBucket } from '@/data/domain/report-receivables'
import { ReportFigures } from '@/features/reports/components/report-figures'
import { ReportShell } from '@/features/reports/components/report-shell'
import { ReportTable } from '@/features/reports/components/report-table'
import { ReportToolbar } from '@/features/reports/components/report-toolbar'
import { useReportParams } from '@/features/reports/hooks/use-report-params'
import { reportCsv } from '@/features/reports/lib/report-csv'
import { describeReport } from '@/features/reports/lib/report-describe'
import { receivablesTable } from '@/features/reports/lib/report-tables'
import { RECEIVABLES_VIEWS, type ReceivablesView, type receivablesLoader } from '@/features/reports/reports.loaders'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

const VIEW_LABELS: Record<ReceivablesView, string> = { tenant: 'By tenant', property: 'By property' }
const BUCKET_LABELS: Record<ReceivableBucket, string> = {
  'not-yet-due': 'Not yet due',
  'due-today': 'Due today',
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
}
const BUCKET_COLORS: Record<ReceivableBucket, string> = {
  'not-yet-due': 'bg-muted-foreground/40',
  'due-today': 'bg-info',
  '1-30': 'bg-warning/70',
  '31-60': 'bg-warning',
  '61-90': 'bg-danger/70',
  '90+': 'bg-danger',
}

/** Receivables & Aging: every open balance today, in one of six buckets. */
export function ReceivablesReportPage() {
  const { meta, report, properties, view } = useLoaderData<typeof receivablesLoader>()
  const { set, setFilters } = useReportParams()
  const format = useFormat()
  const { money, number, date } = format
  const table = useMemo(() => receivablesTable(report, view), [report, view])
  const { totals } = report

  return (
    <ReportShell
      title="Receivables & Aging"
      basis={`As of ${date(meta.asOf)}`}
      description="Every open balance on a posted charge today, in exactly one age bucket. Total open = due and overdue + not yet due. Rent that hasn’t been posted yet isn’t included."
      meta={meta}
      includesSample={report.counted.sample > 0}
      csv={() => ({
        fileName: `propwise-receivables-${view}-${meta.asOf}.csv`,
        contents: reportCsv(`Receivables & Aging (${VIEW_LABELS[view].toLowerCase()})`, describeReport(meta, format), table, meta.currency),
      })}
      toolbar={
        <ReportToolbar filters={meta.filters} properties={properties} window={{ from: meta.asOf, to: meta.asOf }} invalidCustom={null} onChange={setFilters} showPeriod={false}>
          <SegmentedControl label="Group by" value={view} options={RECEIVABLES_VIEWS.map((value) => ({ value, label: VIEW_LABELS[value] }))} onValueChange={(next) => set({ view: next === 'tenant' ? null : next })} />
          <p className="text-caption text-muted-foreground sm:ml-auto">Balances are as of today; there’s no period to choose.</p>
        </ReportToolbar>
      }
    >
      <ReportFigures
        label="Receivables figures"
        figures={[
          { label: 'Total open', value: money(totals.totalOpenCents), note: `${number(totals.openCharges)} open ${totals.openCharges === 1 ? 'charge' : 'charges'}` },
          { label: 'Due and overdue', value: money(totals.dueCents), note: 'As on the Finance pages' },
          { label: 'Overdue', value: money(totals.overdueCents), note: '1 day or more past due', tone: totals.overdueCents > 0 ? 'negative' : 'default' },
          { label: 'Not yet due', value: money(totals.notYetDueCents), note: 'Posted, due after today' },
          { label: 'Oldest open', value: totals.oldestDueDate ? date(totals.oldestDueDate) : '—', note: 'Due date' },
        ]}
      />

      <Card className="min-w-0 print:break-inside-avoid">
        <CardHeader>
          <CardTitle role="heading" aria-level={2}>
            Aging
          </CardTitle>
          <CardDescription>Each open balance counts in one bucket. The six buckets add up to the total open.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-muted" aria-hidden="true">
            {RECEIVABLE_BUCKETS.map((bucket) =>
              totals.buckets[bucket] > 0 ? <span key={bucket} className={cn('h-full', BUCKET_COLORS[bucket])} style={{ width: `${(totals.buckets[bucket] / Math.max(totals.totalOpenCents, 1)) * 100}%` }} /> : null,
            )}
          </div>
          <dl aria-label="Aging buckets" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
            {RECEIVABLE_BUCKETS.map((bucket) => (
              <div key={bucket} className="flex flex-col gap-0.5">
                <dt className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <span className={cn('size-2 rounded-full', BUCKET_COLORS[bucket])} aria-hidden="true" />
                  {BUCKET_LABELS[bucket]}
                </dt>
                <dd className="text-label text-foreground tabular-nums">{money(totals.buckets[bucket])}</dd>
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
          <CardDescription>{view === 'tenant' ? 'Tenants and other payers with an open balance, most overdue first.' : 'Properties with an open balance.'}</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ReportTable data={table} caption={`Receivables ${VIEW_LABELS[view].toLowerCase()}`} emptyText="Nothing is open: every posted charge is paid." />
        </CardContent>
      </Card>
    </ReportShell>
  )
}
