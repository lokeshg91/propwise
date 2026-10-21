import { todayIso } from '@/data/domain/dates'
import { getLeaseDisplayStatus } from '@/data/domain/lease-rules'
import { type TenantListItem } from '@/data/services'
import { LEASE_DISPLAY_STATUSES, type LeaseDisplayStatus, TENANT_STATUSES, type TenantStatus } from '@/types'

import { unitPrefixFor } from './tenant-meta'

export interface TenantListFilters {
  q: string
  status: TenantStatus | 'all'
  lease: LeaseDisplayStatus | 'all'
}

export const DEFAULT_TENANT_FILTERS: TenantListFilters = { q: '', status: 'all', lease: 'all' }

export interface TenantRow {
  id: string
  name: string
  email: string
  phone: string
  kind: TenantListItem['tenant']['kind']
  status: TenantStatus
  leaseId: string | null
  leaseStatus: LeaseDisplayStatus | null
  propertyId: string | null
  propertyName: string
  unitLabel: string
  monthlyRent: number
  /** Lease end, or start for pending move-ins. */
  keyDate: string | null
  leaseStart: string | null
  leaseEnd: string | null
  /** Contact text used by search. */
  contactText: string
  /** Property and unit text used by search. */
  locationText: string
}

export function parseTenantFilters(params: URLSearchParams): TenantListFilters {
  const status = params.get('status') ?? ''
  const lease = params.get('lease') ?? ''
  return {
    q: params.get('q') ?? '',
    status: (TENANT_STATUSES as readonly string[]).includes(status) ? (status as TenantStatus) : 'all',
    lease: (LEASE_DISPLAY_STATUSES as readonly string[]).includes(lease) ? (lease as LeaseDisplayStatus) : 'all',
  }
}

export function toTenantRow(item: TenantListItem, today: string = todayIso()): TenantRow {
  const { tenant, lease, property, unit } = item
  const unitLabel = property && unit ? `${unitPrefixFor(property.type)} ${unit.number}` : ''
  return {
    id: tenant.id,
    name: tenant.name,
    email: tenant.email,
    phone: tenant.phone,
    kind: tenant.kind,
    status: item.status,
    leaseId: lease?.id ?? null,
    leaseStatus: lease ? getLeaseDisplayStatus(lease, today) : null,
    propertyId: property?.id ?? null,
    propertyName: property?.name ?? '',
    unitLabel,
    monthlyRent: lease?.monthlyRent ?? 0,
    keyDate: lease ? (lease.status === 'pending' ? lease.startDate : (lease.endedAt ?? lease.endDate)) : null,
    leaseStart: lease?.startDate ?? null,
    leaseEnd: lease?.endDate ?? null,
    contactText: `${tenant.email} ${tenant.phone} ${tenant.phone.replace(/\D/g, '')}`,
    locationText: `${property?.name ?? ''} ${unitLabel}`.trim(),
  }
}

/** Status and lease filters. Text search is handled by the table. */
export function filterTenantRows(rows: TenantRow[], filters: TenantListFilters): TenantRow[] {
  return rows.filter(
    (row) => (filters.status === 'all' || row.status === filters.status) && (filters.lease === 'all' || row.leaseStatus === filters.lease),
  )
}

export function summarizeTenants(rows: TenantRow[]) {
  const active = rows.filter((row) => row.status === 'active')
  return {
    total: rows.length,
    active: active.length,
    pending: rows.filter((row) => row.status === 'pending').length,
    past: rows.filter((row) => row.status === 'past').length,
    expiring: rows.filter((row) => row.leaseStatus === 'expiring').length,
    holdover: rows.filter((row) => row.leaseStatus === 'holdover').length,
    moveInDue: rows.filter((row) => row.leaseStatus === 'move-in-due').length,
    rentRoll: active.reduce((sum, row) => sum + row.monthlyRent, 0),
  }
}

export type TenantSummary = ReturnType<typeof summarizeTenants>
