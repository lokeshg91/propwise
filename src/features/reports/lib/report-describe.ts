import { REPORT_RANGE_LABELS, type ReceivablesResult, type ReportMeta } from '@/data/services'
import { RECORD_SOURCE_LABELS } from '@/features/reports/lib/report-filters'
import { type Formatters } from '@/lib/formatters'

/** The filters as plain text lines: printed under the title and written at the top of the CSV. */
export type AnyReportMeta = ReportMeta | ReceivablesResult['meta']

export function describeReport(meta: AnyReportMeta, format: Formatters, extra: string[] = []): string[] {
  const { filters } = meta
  let period: string
  if ('window' in meta) {
    const span = `${format.date(meta.window.from)} – ${format.date(meta.window.to)}`
    period = filters.range.kind === 'preset' ? `${REPORT_RANGE_LABELS[filters.range.preset]} (${span})` : `Custom range (${span})`
  } else period = `As of ${format.date(meta.asOf)}`
  const properties =
    filters.propertyId !== 'all'
      ? (meta.propertyName ?? 'Unknown property')
      : filters.propertyType === 'all'
        ? 'All properties'
        : `All ${filters.propertyType} properties`
  return [
    `${'window' in meta ? 'Period' : 'Balances'}: ${period}`,
    `Properties: ${properties}`,
    `Records: ${RECORD_SOURCE_LABELS[filters.source]}`,
    ...extra,
    `Amounts in ${meta.currency}`,
    `Generated: ${format.dateTime(meta.generatedAt)}`,
  ]
}
