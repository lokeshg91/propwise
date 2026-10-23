import { type RecordSource } from '@/data/domain/report-income-expense'
import { customRangeErrors, type ReportRangeSpec } from '@/data/domain/report-range'
import { type ReportFilters } from '@/data/services'
import { PROPERTY_TYPES, REPORT_RANGE_PRESETS, type PropertyType, type ReportRangePreset } from '@/types'

/** Report filters live in the URL: `range` (a preset or `custom` with `from`/`to`), `type`, `property`, `source`. */

export const RECORD_SOURCES = ['all', 'sample', 'user'] as const satisfies readonly RecordSource[]
export const RECORD_SOURCE_LABELS: Record<RecordSource, string> = { all: 'All records', sample: 'Sample records', user: 'Created by you' }

const isPreset = (value: string | null): value is ReportRangePreset => (REPORT_RANGE_PRESETS as readonly (string | null)[]).includes(value)
const isType = (value: string | null): value is PropertyType => (PROPERTY_TYPES as readonly (string | null)[]).includes(value)
const isSource = (value: string | null): value is RecordSource => (RECORD_SOURCES as readonly (string | null)[]).includes(value)

export interface ParsedReportFilters {
  filters: ReportFilters
  /** A custom range in the URL that isn't valid; the report falls back to the default period. */
  invalidCustom: { from: string; to: string; message: string } | null
}

/** Reads the filters; a missing or invalid period uses the default report period from Settings. */
export function parseReportFilters(params: URLSearchParams, defaultPreset: ReportRangePreset): ParsedReportFilters {
  const rangeParam = params.get('range')
  let range: ReportRangeSpec = { kind: 'preset', preset: isPreset(rangeParam) ? rangeParam : defaultPreset }
  let invalidCustom: ParsedReportFilters['invalidCustom'] = null
  if (rangeParam === 'custom') {
    const from = params.get('from') ?? ''
    const to = params.get('to') ?? ''
    const errors = customRangeErrors(from, to)
    if (errors.from || errors.to) invalidCustom = { from, to, message: (errors.from ?? errors.to) as string }
    else range = { kind: 'custom', from, to }
  }
  const type = params.get('type')
  const source = params.get('source')
  return {
    filters: {
      range,
      propertyType: isType(type) ? type : 'all',
      propertyId: params.get('property') || 'all',
      source: isSource(source) ? source : 'all',
    },
    invalidCustom,
  }
}

/** URL changes for a new period. */
export function rangeParams(range: ReportRangeSpec): Record<string, string | null> {
  return range.kind === 'preset' ? { range: range.preset, from: null, to: null } : { range: 'custom', from: range.from, to: range.to }
}

/** "propwise-income-expense-2026-08-01_2026-10-31.csv" */
export const reportFileName = (slug: string, from: string, to: string, view?: string) => `propwise-${slug}${view ? `-${view}` : ''}-${from}_${to}.csv`
