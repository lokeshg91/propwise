import { buildCsv, type CsvValue } from '@/lib/csv'
import { csvColumns, csvRow, type ReportTableData } from '@/features/reports/lib/report-table'

/** The CSV for one report table: filter lines as comments, the rows, the totals row and a currency-code column. */
export function reportCsv(title: string, lines: readonly string[], table: ReportTableData, currency: string): string {
  const hasAmounts = table.columns.some((column) => column.kind === 'amount')
  const columns = [...csvColumns(table.columns), ...(hasAmounts ? [{ header: 'Currency', kind: 'text' as const }] : [])]
  const withCurrency = (values: CsvValue[]) => (hasAmounts ? [...values, currency] : values)
  const rows = table.rows.map((row) => withCurrency(csvRow(table.columns, row)))
  if (table.total) rows.push(withCurrency(csvRow(table.columns, table.total)))
  return buildCsv({ comments: [`Propwise report: ${title}`, ...lines], columns, rows })
}
