import {
  DATE_RANGES,
  type DashboardFilters,
  type DateRange,
  PROPERTY_TYPE_FILTERS,
  type PropertyType,
  type PropertyTypeFilter,
} from '@/types'

export const DEFAULT_FILTERS: DashboardFilters = { range: '12m', type: 'all' }

export const RANGE_OPTIONS: ReadonlyArray<{ value: DateRange; label: string; months: number; short: string }> = [
  { value: '3m', label: 'Last 3 months', months: 3, short: '3 months' },
  { value: '6m', label: 'Last 6 months', months: 6, short: '6 months' },
  { value: '12m', label: 'Last 12 months', months: 12, short: '12 months' },
]

export const TYPE_OPTIONS: ReadonlyArray<{ value: PropertyTypeFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  residential: 'Residential',
  commercial: 'Commercial',
}

export function rangeMonths(range: DateRange): number {
  return RANGE_OPTIONS.find((option) => option.value === range)?.months ?? 12
}

export function rangeShortLabel(range: DateRange): string {
  return RANGE_OPTIONS.find((option) => option.value === range)?.short ?? range
}

export const isDateRange = (value: unknown): value is DateRange =>
  typeof value === 'string' && (DATE_RANGES as readonly string[]).includes(value)

export const isPropertyTypeFilter = (value: unknown): value is PropertyTypeFilter =>
  typeof value === 'string' && (PROPERTY_TYPE_FILTERS as readonly string[]).includes(value)

/** Reads filters from URL search params, falling back to defaults. */
export function parseFilters(params: URLSearchParams): DashboardFilters {
  const range = params.get('range')
  const type = params.get('type')
  return {
    range: isDateRange(range) ? range : DEFAULT_FILTERS.range,
    type: isPropertyTypeFilter(type) ? type : DEFAULT_FILTERS.type,
  }
}

export function matchesType(type: PropertyType, filter: PropertyTypeFilter): boolean {
  return filter === 'all' || filter === type
}
