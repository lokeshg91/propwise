import { getRequestTiming, isActiveRequest, type RequestTiming } from '@/data/domain/maintenance-rules'
import { type RequestListItem } from '@/data/services'
import { PRIORITY_RANK } from '@/features/maintenance/lib/maintenance-meta'
import {
  MAINTENANCE_PRIORITIES,
  type MaintenancePriority,
  REQUEST_CATEGORIES,
  type RequestCategory,
  type RequestStatus,
  type ServiceRequest,
} from '@/types'

import { CATEGORY_LABELS, STATUS_GROUPS, type StatusGroup } from './request-meta'

export interface RequestListFilters {
  q: string
  status: StatusGroup
  priority: MaintenancePriority | 'all'
  category: RequestCategory | 'all'
  property: string
  overdue: boolean
}

export const DEFAULT_REQUEST_FILTERS: RequestListFilters = {
  q: '',
  status: 'active',
  priority: 'all',
  category: 'all',
  property: 'all',
  overdue: false,
}

export interface RequestRow {
  id: string
  request: ServiceRequest
  title: string
  category: RequestCategory
  priority: MaintenancePriority
  priorityRank: number
  status: RequestStatus
  timing: RequestTiming
  propertyId: string
  propertyName: string
  /** "Unit 204", "Suite 310" or the common-area name. */
  locationLabel: string
  tenantName: string
  vendorId: string
  vendorName: string
  vendorActive: boolean
  /** The work order points at a vendor id that no longer exists. */
  vendorMissing: boolean
  createdAt: string
  /** Text used by search: id, title, property, location, vendor and tenant. */
  searchText: string
}

export function parseRequestFilters(params: URLSearchParams): RequestListFilters {
  const status = params.get('status') ?? ''
  const priority = params.get('priority') ?? ''
  const category = params.get('category') ?? ''
  return {
    q: params.get('q') ?? '',
    status: (STATUS_GROUPS as readonly string[]).includes(status) ? (status as StatusGroup) : DEFAULT_REQUEST_FILTERS.status,
    priority: (MAINTENANCE_PRIORITIES as readonly string[]).includes(priority) ? (priority as MaintenancePriority) : 'all',
    category: (REQUEST_CATEGORIES as readonly string[]).includes(category) ? (category as RequestCategory) : 'all',
    property: params.get('property') ?? 'all',
    overdue: params.get('overdue') === '1',
  }
}

/** URL value for a filter; `null` removes the parameter (default). */
export function filterParam<K extends keyof RequestListFilters>(key: K, value: RequestListFilters[K]): string | null {
  if (value === DEFAULT_REQUEST_FILTERS[key]) return null
  if (typeof value === 'boolean') return value ? '1' : null
  return String(value)
}

export function locationLabel(item: Pick<RequestListItem, 'request' | 'property' | 'unit'>): string {
  if (item.unit) return `${item.property?.type === 'commercial' ? 'Suite' : 'Unit'} ${item.unit.number}`
  return item.request.area ?? 'Common area'
}

export function toRequestRow(item: RequestListItem, now: Date = new Date()): RequestRow {
  const { request } = item
  const location = locationLabel(item)
  return {
    id: request.id,
    request,
    title: request.title,
    category: request.category,
    priority: request.priority,
    priorityRank: PRIORITY_RANK[request.priority],
    status: request.status,
    timing: getRequestTiming(request, now),
    propertyId: request.propertyId,
    propertyName: item.property?.name ?? 'Unknown property',
    locationLabel: location,
    tenantName: item.tenant?.name ?? '',
    vendorId: item.vendor?.id ?? '',
    vendorName: item.vendor?.name ?? '',
    vendorActive: item.vendor?.active ?? true,
    vendorMissing: item.vendor?.missing ?? false,
    createdAt: request.createdAt,
    searchText: [request.id, request.title, CATEGORY_LABELS[request.category], item.property?.name, location, item.vendor?.name, item.tenant?.name]
      .filter(Boolean)
      .join(' '),
  }
}

export function matchesStatusGroup(status: RequestStatus, group: StatusGroup): boolean {
  if (group === 'all') return true
  if (group === 'active') return isActiveRequest({ status })
  return status === group
}

/** Applies every filter except text search, which the table handles. */
export function filterRequestRows(rows: RequestRow[], filters: RequestListFilters): RequestRow[] {
  return rows.filter(
    (row) =>
      matchesStatusGroup(row.status, filters.status) &&
      (filters.priority === 'all' || row.priority === filters.priority) &&
      (filters.category === 'all' || row.category === filters.category) &&
      (filters.property === 'all' || row.propertyId === filters.property) &&
      (!filters.overdue || row.timing === 'overdue'),
  )
}

const DAY = 86_400_000

/** Portfolio-wide maintenance metrics (not affected by list filters). */
export function summarizeRequests(rows: RequestRow[], now: Date = new Date()) {
  const active = rows.filter((row) => isActiveRequest(row))
  const completedRecently = rows.filter(
    (row) => row.status === 'completed' && row.request.completedAt && now.getTime() - Date.parse(row.request.completedAt) <= 30 * DAY,
  )
  const resolutionHours = completedRecently.map((row) => (Date.parse(row.request.completedAt ?? '') - Date.parse(row.createdAt)) / 3_600_000)
  return {
    active: active.length,
    unassigned: active.filter((row) => row.status === 'open').length,
    overdue: active.filter((row) => row.timing === 'overdue').length,
    urgentOpen: active.filter((row) => row.priority === 'urgent').length,
    inProgress: active.filter((row) => row.status === 'in-progress' || row.status === 'scheduled').length,
    onHold: active.filter((row) => row.status === 'on-hold').length,
    completed30: completedRecently.length,
    averageResolutionHours: resolutionHours.length ? resolutionHours.reduce((sum, value) => sum + value, 0) / resolutionHours.length : null,
    total: rows.length,
  }
}

export type RequestSummary = ReturnType<typeof summarizeRequests>
