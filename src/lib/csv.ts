/**
 * CSV export (Phase 9) with typed columns. RFC 4180 quoting, UTF-8 with a
 * byte-order mark, CRLF line ends.
 *
 * - `amount`: integer cents written as a plain decimal with a dot and an
 *   optional minus (-1250.00, 0.00). Never prefixed or quoted, so
 *   spreadsheets read it as a number.
 * - `number` and `percent`: plain numerals (percent in percent units, 92.4).
 * - `date`: YYYY-MM-DD.
 * - `text`: protected against formula injection. A cell starting with
 *   =, +, -, @, tab or carriage return gets a leading apostrophe. Only text
 *   cells are protected; numbers stay numbers.
 *
 * Empty values (null) are written as empty cells.
 */

export type CsvKind = 'text' | 'amount' | 'number' | 'percent' | 'date'
export type CsvValue = string | number | null

export interface CsvColumn {
  header: string
  kind: CsvKind
}

const FORMULA_START = /^[=+\-@\t\r]/

/** Text cell content with formula injection neutralised. */
export function protectText(value: string): string {
  return FORMULA_START.test(value) ? `'${value}` : value
}

/** Integer cents → "-1250.00" (exact: no floating point). */
export function centsToCsv(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new Error(`Amounts must be whole cents: ${cents}`)
  const negative = cents < 0
  const absolute = Math.abs(cents)
  return `${negative ? '-' : ''}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, '0')}`
}

function quote(cell: string): string {
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell
}

/** One typed cell as written to the file (before quoting). */
export function formatCell(kind: CsvKind, value: CsvValue): string {
  if (value === null || value === '') return ''
  switch (kind) {
    case 'amount':
      if (typeof value !== 'number') throw new Error('Amount cells take integer cents.')
      return centsToCsv(value)
    case 'number':
    case 'percent':
      if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${kind} cells take finite numbers.`)
      return String(value)
    case 'date':
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Date cells take YYYY-MM-DD.')
      return value
    case 'text':
      return protectText(String(value))
  }
}

export interface CsvDocument {
  /** Lines written at the top as comments ("# …"), e.g. the report name and filters. */
  comments?: readonly string[]
  columns: readonly CsvColumn[]
  rows: ReadonlyArray<readonly CsvValue[]>
}

export const CSV_BOM = '﻿'

export function buildCsv(document: CsvDocument): string {
  const lines: string[] = []
  for (const comment of document.comments ?? []) lines.push(quote(`# ${comment.replace(/[\r\n]+/g, ' ')}`))
  lines.push(document.columns.map((column) => quote(protectText(column.header))).join(','))
  for (const row of document.rows) {
    if (row.length !== document.columns.length) throw new Error('Every row needs one value per column.')
    lines.push(row.map((value, index) => quote(formatCell((document.columns[index] as CsvColumn).kind, value))).join(','))
  }
  return `${CSV_BOM}${lines.join('\r\n')}\r\n`
}

/** Parses CSV text (RFC 4180) into rows of cells. Used to check exports. */
export function parseCsv(text: string): string[][] {
  const source = text.startsWith(CSV_BOM) ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index] as string
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        cell += '"'
        index += 1
      } else if (char === '"') quoted = false
      else cell += char
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\r' && source[index + 1] === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
      index += 1
    } else cell += char
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell)
    rows.push(row)
  }
  return rows
}
