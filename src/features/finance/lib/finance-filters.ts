import { FINANCE_RANGES, type FinanceRange } from '@/data/domain/finance-summary'
import { type FinanceFilters } from '@/data/services'
import { PROPERTY_TYPES, type PropertyType } from '@/types'

const isRange = (value: string): value is FinanceRange => (FINANCE_RANGES as readonly string[]).includes(value)
const isType = (value: string): value is PropertyType => (PROPERTY_TYPES as readonly string[]).includes(value)

export const DEFAULT_OVERVIEW_FILTERS = { range: '3m', type: 'all', property: 'all' } as const satisfies Record<string, string>
export type OverviewFilters = { range: FinanceRange; type: PropertyType | 'all'; property: string }

export function parseOverviewFilters(params: URLSearchParams): OverviewFilters {
  const range = params.get('range') ?? ''
  const type = params.get('type') ?? ''
  return {
    range: isRange(range) ? range : DEFAULT_OVERVIEW_FILTERS.range,
    type: isType(type) ? type : 'all',
    property: params.get('property') || 'all',
  }
}

export const toServiceFilters = (filters: OverviewFilters): FinanceFilters => ({
  range: filters.range,
  propertyType: filters.type,
  propertyId: filters.property,
})
