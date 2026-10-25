import { ROLE_LABELS } from '@/data/domain/staff-rules'
import { type StaffListItem } from '@/data/services'
import { STAFF_ROLES, type StaffRole } from '@/types'

/** Status filter groups for the directory. */
export const STAFF_STATUS_GROUPS = ['active', 'inactive', 'all'] as const
export type StaffStatusGroup = (typeof STAFF_STATUS_GROUPS)[number]

export const STAFF_STATUS_GROUP_LABELS: Record<StaffStatusGroup, string> = { active: 'Active', inactive: 'Inactive', all: 'All' }

/** `property`: a property id, 'unassigned' (no assignments) or 'all'. */
export interface StaffListFilters {
  q: string
  status: StaffStatusGroup
  role: StaffRole | 'all'
  property: string
}

export const DEFAULT_STAFF_FILTERS: StaffListFilters = { q: '', status: 'active', role: 'all', property: 'all' }

export interface StaffRow extends StaffListItem {
  id: string
  name: string
  /** Name and job title, for search and sorting. */
  nameText: string
  /** Email and phone (also digits only), for search. */
  contactText: string
  roleText: string
  propertyText: string
}

const PROPERTY_PARAM = /^[A-Za-z0-9_-]{1,64}$/

export function parseStaffFilters(params: URLSearchParams): StaffListFilters {
  const status = params.get('status') ?? ''
  const role = params.get('role') ?? ''
  const property = params.get('property') ?? ''
  return {
    q: params.get('q') ?? '',
    status: (STAFF_STATUS_GROUPS as readonly string[]).includes(status) ? (status as StaffStatusGroup) : DEFAULT_STAFF_FILTERS.status,
    role: (STAFF_ROLES as readonly string[]).includes(role) ? (role as StaffRole) : 'all',
    property: PROPERTY_PARAM.test(property) ? property : 'all',
  }
}

/** URL value for a filter; `null` removes the parameter (default). */
export function staffFilterParam<K extends keyof StaffListFilters>(key: K, value: StaffListFilters[K]): string | null {
  return value === DEFAULT_STAFF_FILTERS[key] ? null : String(value)
}

export function toStaffRow(item: StaffListItem): StaffRow {
  const { member } = item
  return {
    ...item,
    id: member.id,
    name: member.name,
    nameText: `${member.name} ${member.jobTitle}`,
    contactText: `${member.email} ${member.phone} ${member.phone.replace(/\D/g, '')}`,
    roleText: ROLE_LABELS[member.role],
    propertyText: item.properties.map((property) => property.name).join(' '),
  }
}

export const matchesStaffStatus = (active: boolean, group: StaffStatusGroup) => group === 'all' || (group === 'active' ? active : !active)

/** Applies every filter except text search, which the table handles. */
export function filterStaffRows(rows: StaffRow[], filters: StaffListFilters): StaffRow[] {
  return rows.filter(
    (row) =>
      matchesStaffStatus(row.member.active, filters.status) &&
      (filters.role === 'all' || row.member.role === filters.role) &&
      (filters.property === 'all' || (filters.property === 'unassigned' ? row.properties.length === 0 : row.properties.some((property) => property.id === filters.property))),
  )
}

/** Directory-wide totals (not affected by filters). */
export function summarizeStaff(rows: StaffRow[]) {
  const active = rows.filter((row) => row.member.active)
  const assigned = new Set(active.flatMap((row) => row.properties.map((property) => property.id)))
  return {
    total: rows.length,
    active: active.length,
    inactive: rows.length - active.length,
    managers: active.filter((row) => row.member.role === 'owner' || row.member.role === 'admin').length,
    coveredProperties: assigned.size,
  }
}

export type StaffSummary = ReturnType<typeof summarizeStaff>
