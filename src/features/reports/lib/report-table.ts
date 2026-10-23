import { type CsvColumn, type CsvKind, type CsvValue } from '@/lib/csv'

/**
 * One table definition drives the screen, the print view and the CSV file,
 * so an export always holds exactly what the report shows.
 */
export type ReportRow = Record<string, CsvValue>

export interface ReportColumn {
  key: string
  header: string
  kind: CsvKind
  /** Shown as the card title on small screens. */
  primary?: boolean
  /** Hidden on small screens' cards (still printed and exported). */
  secondary?: boolean
  /** Column for the CSV only (e.g. From/To dates behind a month label). */
  exportOnly?: boolean
}

export interface ReportTableData {
  columns: ReportColumn[]
  rows: ReportRow[]
  /** Totals row (first text column reads "Total"). */
  total?: ReportRow
}

export const csvColumns = (columns: readonly ReportColumn[]): CsvColumn[] => columns.map(({ header, kind }) => ({ header, kind }))
export const csvRow = (columns: readonly ReportColumn[], row: ReportRow): CsvValue[] => columns.map((column) => row[column.key] ?? null)
