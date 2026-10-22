import { AGING_BUCKETS, emptyAging, type AgingBucket } from '@/data/domain/finance-rules'
import { type ReceivableRow } from '@/data/services'
import { PROPERTY_TYPES, type PropertyType } from '@/types'

export interface ReceivableFilters extends Record<string, string | boolean> {
  q: string
  type: PropertyType | 'all'
  property: string
  /** Only leases with an open balance (default). */
  open: boolean
}

export const DEFAULT_RECEIVABLE_FILTERS: ReceivableFilters = { q: '', type: 'all', property: 'all', open: true }

export function parseReceivableFilters(params: URLSearchParams): ReceivableFilters {
  const type = params.get('type') ?? ''
  return {
    q: params.get('q') ?? '',
    type: (PROPERTY_TYPES as readonly string[]).includes(type) ? (type as PropertyType) : 'all',
    property: params.get('property') || 'all',
    open: params.get('open') !== '0',
  }
}

export interface ReceivableView extends ReceivableRow {
  propertyType: PropertyType | null
  /** Oldest bucket with a balance, for sorting by age. */
  worstBucket: number
}

export function toReceivableViews(rows: readonly ReceivableRow[], types: ReadonlyMap<string, PropertyType>): ReceivableView[] {
  return rows.map((row) => ({
    ...row,
    propertyType: types.get(row.propertyId) ?? null,
    worstBucket: AGING_BUCKETS.reduce((worst, bucket, index) => (row.aging[bucket] > 0 ? index : worst), -1),
  }))
}

export function filterReceivables(rows: readonly ReceivableView[], filters: ReceivableFilters): ReceivableView[] {
  const query = filters.q.trim().toLowerCase()
  return rows.filter(
    (row) =>
      (!filters.open || row.balanceCents > 0) &&
      (filters.type === 'all' || row.propertyType === filters.type) &&
      (filters.property === 'all' || row.propertyId === filters.property) &&
      (query === '' || `${row.tenantName} ${row.propertyName} ${row.unitLabel}`.toLowerCase().includes(query)),
  )
}

export interface ReceivableSummary {
  balanceCents: number
  overdueCents: number
  aging: Record<AgingBucket, number>
  withBalance: number
}

export function summarizeReceivables(rows: readonly ReceivableView[]): ReceivableSummary {
  const summary: ReceivableSummary = { balanceCents: 0, overdueCents: 0, aging: emptyAging(), withBalance: 0 }
  for (const row of rows) {
    summary.balanceCents += row.balanceCents
    if (row.balanceCents > 0) summary.withBalance += 1
    for (const bucket of AGING_BUCKETS) {
      summary.aging[bucket] += row.aging[bucket]
      if (bucket !== 'current') summary.overdueCents += row.aging[bucket]
    }
  }
  return summary
}
