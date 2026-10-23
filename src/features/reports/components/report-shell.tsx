import { CalendarRange, Download, FlaskConical, Info, Printer } from 'lucide-react'
import { type ReactNode } from 'react'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { describeReport, type AnyReportMeta } from '@/features/reports/lib/report-describe'
import { usePrintLight } from '@/features/reports/hooks/use-print-light'
import { useFormat } from '@/hooks/use-format'
import { downloadTextFile } from '@/lib/download'

interface ReportShellProps {
  title: string
  basis: string
  description: string
  meta: AnyReportMeta
  /** Extra filter lines for print and CSV (e.g. "Includes recurring charges"). */
  extraLines?: string[]
  /** Builds the CSV for the current view; null when there's nothing to export. */
  csv: () => { fileName: string; contents: string } | null
  toolbar: ReactNode
  /** Sample records are part of the figures. */
  includesSample: boolean
  children: ReactNode
}

/** Header (title, basis, generated time, Export CSV, Print), toolbar, notices and the printable body. */
export function ReportShell({ title, basis, description, meta, extraLines = [], csv, toolbar, includesSample, children }: ReportShellProps) {
  usePrintLight()
  const format = useFormat()
  const lines = describeReport(meta, format, extraLines)
  const notices: Array<{ icon: typeof Info; text: string }> = []
  const notes = 'notices' in meta ? meta.notices : null
  if (notes?.beforeHistory) {
    notices.push({ icon: CalendarRange, text: `Finance records start in ${format.month(meta.financeStartPeriod, 'long')}. Earlier dates have no records here, and nothing is estimated.` })
  }
  if (notes?.includesFuture) {
    notices.push({
      icon: CalendarRange,
      text:
        meta.filters.range.kind === 'preset'
          ? `${format.month(meta.today.slice(0, 7), 'long')} is still in progress: its figures run to today.`
          : 'The period runs past today. Future dates have no money received or paid yet, and nothing is projected.',
    })
  }
  if (notes?.partialMonths) notices.push({ icon: CalendarRange, text: 'The first or last month is cut by the custom range; those months only count the dates inside it.' })
  if (includesSample) notices.push({ icon: FlaskConical, text: 'Includes sample records (fictional demo history). Choose “Created by you” to see only your records.' })
  if (meta.unknownProperty) notices.push({ icon: Info, text: 'The selected property no longer exists, so nothing matches.' })

  const exportCsv = () => {
    try {
      const file = csv()
      if (!file) return
      downloadTextFile(file.fileName, file.contents, 'text/csv')
      toast.success('CSV downloaded', { description: file.fileName })
    } catch (error) {
      toast.error('The CSV couldn’t be created', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  return (
    <PageContainer data-report-print className="report-page">
      <NavigationProgress />
      <div data-report-noprint>
        <BackLink to="/reports" label="Reports" />
      </div>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="hidden text-caption font-semibold tracking-wider text-muted-foreground uppercase print:block">Propwise report</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1 text-foreground">{title}</h1>
            <Badge variant="secondary">{basis}</Badge>
          </div>
          <p className="max-w-2xl text-body text-muted-foreground">{description}</p>
          <p className="text-caption text-muted-foreground print:hidden">Generated {format.dateTime(meta.generatedAt)} · amounts in {meta.currency}</p>
        </div>
        <div data-report-noprint className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download data-icon="inline-start" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer data-icon="inline-start" />
            Print or save PDF
          </Button>
        </div>
      </header>

      <ul aria-label="Report filters" className="hidden flex-col gap-0.5 border-y border-border py-2 text-caption text-foreground print:flex">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      {toolbar}

      {notices.length > 0 ? (
        <ul aria-label="Notes about this report" className="flex flex-col gap-2">
          {notices.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-body text-foreground/85 dark:bg-info/15 print:border-border print:bg-transparent">
              <Icon className="mt-0.5 size-4 shrink-0 text-info" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      ) : null}

      {children}
    </PageContainer>
  )
}
