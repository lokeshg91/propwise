import { type VendorListItem } from '@/data/services'
import { CATEGORY_LABELS } from '@/features/maintenance/lib/request-meta'
import { REQUEST_CATEGORIES, type RequestCategory } from '@/types'

import { VENDOR_STATUS_GROUPS, type VendorStatusGroup } from './vendor-meta'

export interface VendorListFilters {
  q: string
  status: VendorStatusGroup
  category: RequestCategory | 'all'
  /** Only vendors with scheduled or in-progress work orders. */
  openJobs: boolean
}

export const DEFAULT_VENDOR_FILTERS: VendorListFilters = { q: '', status: 'active', category: 'all', openJobs: false }

export interface VendorRow extends VendorListItem {
  id: string
  name: string
  open: number
  completed: number
  /** ISO timestamp of the last completed job, or '' (sorts last). */
  lastJobAt: string
  /** Contact text for search: person, email and phone (with digits only). */
  contactText: string
  /** Name and company for search and sorting. */
  nameText: string
  categoryText: string
}

export function parseVendorFilters(params: URLSearchParams): VendorListFilters {
  const status = params.get('status') ?? ''
  const category = params.get('category') ?? ''
  return {
    q: params.get('q') ?? '',
    status: (VENDOR_STATUS_GROUPS as readonly string[]).includes(status) ? (status as VendorStatusGroup) : DEFAULT_VENDOR_FILTERS.status,
    category: (REQUEST_CATEGORIES as readonly string[]).includes(category) ? (category as RequestCategory) : 'all',
    openJobs: params.get('openJobs') === '1',
  }
}

/** URL value for a filter; `null` removes the parameter (default). */
export function vendorFilterParam<K extends keyof VendorListFilters>(key: K, value: VendorListFilters[K]): string | null {
  if (value === DEFAULT_VENDOR_FILTERS[key]) return null
  if (typeof value === 'boolean') return value ? '1' : null
  return String(value)
}

export function toVendorRow(item: VendorListItem): VendorRow {
  const { vendor, performance } = item
  return {
    ...item,
    id: vendor.id,
    name: vendor.name,
    open: performance.open,
    completed: performance.completed,
    lastJobAt: performance.lastJob?.completedAt ?? '',
    contactText: `${vendor.contactName} ${vendor.email} ${vendor.phone} ${vendor.phone.replace(/\D/g, '')}`,
    nameText: `${vendor.name} ${vendor.company}`.trim(),
    categoryText: vendor.categories.map((category) => CATEGORY_LABELS[category]).join(' '),
  }
}

export const matchesVendorStatus = (active: boolean, group: VendorStatusGroup) =>
  group === 'all' || (group === 'active' ? active : !active)

/** Applies every filter except text search, which the table handles. */
export function filterVendorRows(rows: VendorRow[], filters: VendorListFilters): VendorRow[] {
  return rows.filter(
    (row) =>
      matchesVendorStatus(row.vendor.active, filters.status) &&
      (filters.category === 'all' || row.vendor.categories.includes(filters.category)) &&
      (!filters.openJobs || row.open > 0),
  )
}

/** Directory-wide totals (not affected by list filters). */
export function summarizeVendors(rows: VendorRow[]) {
  const active = rows.filter((row) => row.vendor.active)
  return {
    total: rows.length,
    active: active.length,
    inactive: rows.length - active.length,
    openWorkOrders: rows.reduce((sum, row) => sum + row.open, 0),
    vendorsWithOpenJobs: rows.filter((row) => row.open > 0).length,
    inactiveWithOpenJobs: rows.filter((row) => !row.vendor.active && row.open > 0).length,
  }
}

export type VendorSummary = ReturnType<typeof summarizeVendors>
