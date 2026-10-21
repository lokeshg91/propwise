import { daysBetween, monthsBetween, todayIso } from '@/data/domain/dates'
import { getPrimaryLease, getTenantStatus, isCurrentLease } from '@/data/domain/lease-rules'
import { generateRentLedger } from '@/data/mock/rent-ledger'
import {
  assertUnitAvailable,
  currentLeaseForUnit,
  findProperty,
  findUnit,
  occupyUnit,
  recordPropertyEvent,
  vacateUnit,
} from '@/data/services/occupancy'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { createId, type DemoDatabase, readDatabase, updateDatabase } from '@/data/store/demo-store'
import {
  type Lease,
  type LeaseAssignmentInput,
  type LeaseEndReason,
  type Property,
  type RentCharge,
  type Tenant,
  type TenantEvent,
  type TenantEventKind,
  type TenantInput,
  type TenantStatus,
  type Unit,
} from '@/types'

export const MAX_DEPOSIT_MULTIPLE = 3

/** A tenant with their primary lease and its property/unit, for lists. */
export interface TenantListItem {
  tenant: Tenant
  status: TenantStatus
  lease: Lease | null
  property: Pick<Property, 'id' | 'name' | 'type'> | null
  unit: Pick<Unit, 'id' | 'number'> | null
}

export interface TenantDetail extends TenantListItem {
  /** All leases, newest first. */
  leases: Array<Lease & { propertyName: string; unitNumber: string; /** e.g. "Unit 204" or "Suite 310". */ unitLabel: string }>
  events: TenantEvent[]
  /** Demo ledger for the primary lease (generated sample records). */
  ledger: RentCharge[]
}

export interface AssignableProperty {
  id: string
  name: string
  type: Property['type']
  units: Array<Pick<Unit, 'id' | 'number' | 'type' | 'floor' | 'rent' | 'areaSqft'>>
}

/* ------------------------------------------------------------------ reads */

function toListItem(db: DemoDatabase, tenant: Tenant, leases: Lease[]): TenantListItem {
  const lease = getPrimaryLease(leases) ?? null
  const property = lease ? db.properties.find((entry) => entry.id === lease.propertyId) : undefined
  const unit = lease ? db.units.find((entry) => entry.id === lease.unitId) : undefined
  return {
    tenant,
    status: getTenantStatus(leases),
    lease,
    property: property ? { id: property.id, name: property.name, type: property.type } : null,
    unit: unit ? { id: unit.id, number: unit.number } : null,
  }
}

function leasesByTenant(db: DemoDatabase): Map<string, Lease[]> {
  const map = new Map<string, Lease[]>()
  for (const lease of db.leases) map.set(lease.tenantId, [...(map.get(lease.tenantId) ?? []), lease])
  return map
}

export function getTenants(): Promise<TenantListItem[]> {
  const db = readDatabase()
  const byTenant = leasesByTenant(db)
  return simulateLatency(db.tenants.map((tenant) => toListItem(db, tenant, byTenant.get(tenant.id) ?? [])))
}

export function getTenantDetail(id: string): Promise<TenantDetail | null> {
  const db = readDatabase()
  const tenant = db.tenants.find((entry) => entry.id === id)
  if (!tenant) return simulateLatency(null)
  const leases = db.leases.filter((lease) => lease.tenantId === id)
  const item = toListItem(db, tenant, leases)
  return simulateLatency({
    ...item,
    leases: [...leases]
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
      .map((lease) => {
        const property = db.properties.find((entry) => entry.id === lease.propertyId)
        const unitNumber = db.units.find((entry) => entry.id === lease.unitId)?.number ?? '—'
        return {
          ...lease,
          propertyName: property?.name ?? 'Unknown property',
          unitNumber,
          unitLabel: `${property?.type === 'commercial' ? 'Suite' : 'Unit'} ${unitNumber}`,
        }
      }),
    events: db.tenantEvents.filter((event) => event.tenantId === id),
    ledger: item.lease ? generateRentLedger(item.lease) : [],
  })
}

/**
 * Properties with units a lease can use: vacant, not under maintenance and
 * not held by another active or pending lease. `includeLeaseId` keeps the
 * unit of the lease being edited in the list.
 */
export function getAssignableUnits(includeLeaseId?: string): Promise<AssignableProperty[]> {
  const db = readDatabase()
  const ownUnitId = includeLeaseId ? db.leases.find((lease) => lease.id === includeLeaseId)?.unitId : undefined
  const result: AssignableProperty[] = db.properties
    .map((property) => ({
      id: property.id,
      name: property.name,
      type: property.type,
      units: db.units
        .filter(
          (unit) =>
            unit.propertyId === property.id &&
            (unit.id === ownUnitId || (unit.status === 'vacant' && !currentLeaseForUnit(db, unit.id))),
        )
        .sort((a, b) => a.number.localeCompare(b.number, 'en', { numeric: true }))
        .map(({ id, number, type, floor, rent, areaSqft }) => ({ id, number, type, floor, rent, areaSqft })),
    }))
    .filter((property) => property.units.length > 0)
    .sort((a, b) => a.name.localeCompare(b.name))
  return simulateLatency(result)
}

/* ----------------------------------------------------------------- writes */

export function createTenant(input: TenantInput): Promise<Tenant> {
  return run(() =>
    updateDatabase((db) => {
      if (!input.lease) throw new ServiceError('invalid', 'Assign a unit to the new tenant.', 'unitId')
      assertUniqueEmail(db, input.email)
      const now = new Date().toISOString()
      const tenant: Tenant = { id: createId('ten'), ...tenantFields(input), createdAt: now, updatedAt: now }
      db.tenants.unshift(tenant)
      const lease = createLease(db, tenant, input.lease)
      record(db, tenant.id, 'tenant-created', 'Tenant added', `${tenant.name} was added to Propwise.`)
      record(db, tenant.id, 'lease-created', leaseCreatedTitle(lease), describeLeaseUnit(db, lease), lease.id)
      return tenant
    }),
  )
}

export function updateTenant(id: string, input: TenantInput): Promise<Tenant> {
  return run(() =>
    updateDatabase((db) => {
      const tenant = db.tenants.find((entry) => entry.id === id)
      if (!tenant) throw new ServiceError('not-found', 'Tenant not found.')
      assertUniqueEmail(db, input.email, id)

      const current = db.leases.find((lease) => lease.tenantId === id && isCurrentLease(lease))
      const before = JSON.stringify({ ...tenant, updatedAt: '' })
      Object.assign(tenant, tenantFields(input))
      const detailsChanged = JSON.stringify({ ...tenant, updatedAt: '' }) !== before

      if (current && !input.lease) {
        throw new ServiceError('invalid', 'End or cancel the current lease from the Lease tab instead.', 'unitId')
      }
      if (current && input.lease) updateLease(db, tenant, current, input.lease)
      if (!current && input.lease) {
        const lease = createLease(db, tenant, input.lease)
        record(db, id, 'lease-created', leaseCreatedTitle(lease), describeLeaseUnit(db, lease), lease.id)
      }

      if (detailsChanged) {
        tenant.updatedAt = new Date().toISOString()
        record(db, id, 'tenant-updated', 'Tenant details updated', 'Contact or profile information was edited.')
        // Keep the unit's tenant name in sync.
        if (current?.status === 'active') findUnit(db, current.unitId).tenantName = tenant.name
      }
      return tenant
    }),
  )
}

/** Ends an active lease and releases its unit. The only way an occupied unit becomes vacant. */
export function endLease(leaseId: string, moveOutDate: string, reason: LeaseEndReason): Promise<Lease> {
  return run(() =>
    updateDatabase((db) => {
      const lease = findLease(db, leaseId)
      if (lease.status !== 'active') throw new ServiceError('conflict', 'Only an active lease can be ended.')
      if (moveOutDate < lease.startDate) {
        throw new ServiceError('invalid', 'Move-out date can’t be before the lease start.', 'moveOutDate')
      }
      if (moveOutDate > todayIso()) throw new ServiceError('invalid', 'Move-out date can’t be in the future.', 'moveOutDate')
      const atTerm = moveOutDate >= lease.endDate
      Object.assign(lease, {
        status: atTerm ? 'expired' : 'terminated',
        endedAt: moveOutDate,
        endReason: reason,
        updatedAt: new Date().toISOString(),
      } satisfies Partial<Lease>)
      vacateUnit(db, lease.unitId)
      const tenant = findTenant(db, lease.tenantId)
      const unit = findUnit(db, lease.unitId)
      record(db, tenant.id, 'lease-ended', atTerm ? 'Lease ended' : 'Lease terminated early', `Moved out of ${describeLeaseUnit(db, lease)}.`, lease.id)
      recordPropertyEvent(db, lease.propertyId, 'unit-vacated', `Unit ${unit.number} vacated`, `${tenant.name} moved out.`)
      return lease
    }),
  )
}

/** Cancels a pending lease; its unit was never occupied, so it simply stops being reserved. */
export function cancelLease(leaseId: string): Promise<Lease> {
  return run(() =>
    updateDatabase((db) => {
      const lease = findLease(db, leaseId)
      if (lease.status !== 'pending') throw new ServiceError('conflict', 'Only a pending lease can be cancelled.')
      Object.assign(lease, {
        status: 'terminated',
        endedAt: todayIso(),
        endReason: 'other',
        updatedAt: new Date().toISOString(),
      } satisfies Partial<Lease>)
      record(db, lease.tenantId, 'lease-cancelled', 'Pending lease cancelled', `${describeLeaseUnit(db, lease)} is available again.`, lease.id)
      return lease
    }),
  )
}

/** Moves a pending tenant in once the start date has arrived. */
export function activateLease(leaseId: string): Promise<Lease> {
  return run(() =>
    updateDatabase((db) => {
      const lease = findLease(db, leaseId)
      if (lease.status !== 'pending') throw new ServiceError('conflict', 'Only a pending lease can be activated.')
      if (lease.startDate > todayIso()) {
        throw new ServiceError('conflict', 'This lease starts in the future. Move-in can be recorded from the start date.')
      }
      assertUnitAvailable(db, lease.unitId, lease.id)
      lease.status = 'active'
      lease.updatedAt = new Date().toISOString()
      const tenant = findTenant(db, lease.tenantId)
      occupyUnit(db, lease, tenant.name)
      record(db, tenant.id, 'lease-activated', 'Moved in', `Lease for ${describeLeaseUnit(db, lease)} is now active.`, lease.id)
      recordPropertyEvent(db, lease.propertyId, 'unit-leased', `Unit ${findUnit(db, lease.unitId).number} leased`, `${tenant.name} moved in.`)
      return lease
    }),
  )
}

/* ---------------------------------------------------------------- helpers */

function run<T>(mutation: () => T): Promise<T> {
  try {
    return simulateLatency(mutation(), 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

function findTenant(db: DemoDatabase, id: string): Tenant {
  const tenant = db.tenants.find((entry) => entry.id === id)
  if (!tenant) throw new ServiceError('not-found', 'Tenant not found.')
  return tenant
}

function findLease(db: DemoDatabase, id: string): Lease {
  const lease = db.leases.find((entry) => entry.id === id)
  if (!lease) throw new ServiceError('not-found', 'Lease not found.')
  return lease
}

function tenantFields(input: TenantInput): Omit<Tenant, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    kind: input.kind,
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    phone: input.phone.trim(),
    mailingAddress: {
      street: input.mailingAddress.street.trim(),
      city: input.mailingAddress.city.trim(),
      state: input.mailingAddress.state,
      postalCode: input.mailingAddress.postalCode.trim(),
    },
    emergencyContact: input.emergencyContact
      ? {
          name: input.emergencyContact.name.trim(),
          phone: input.emergencyContact.phone.trim(),
          relationship: input.emergencyContact.relationship.trim(),
        }
      : null,
    notes: input.notes.trim() || undefined,
  }
}

function assertUniqueEmail(db: DemoDatabase, email: string, exceptId?: string) {
  const normalized = email.trim().toLowerCase()
  if (db.tenants.some((tenant) => tenant.id !== exceptId && tenant.email.toLowerCase() === normalized)) {
    throw new ServiceError('conflict', 'Another tenant already uses this email address.', 'email')
  }
}

/** Server-side lease checks; the form validates the same rules for instant feedback. */
function validateLeaseTerms(input: LeaseAssignmentInput) {
  const today = todayIso()
  if (input.endDate <= input.startDate) {
    throw new ServiceError('invalid', 'Lease end must be after the start date.', 'endDate')
  }
  if (monthsBetween(input.startDate, input.endDate) > 120) {
    throw new ServiceError('invalid', 'Leases can be at most 10 years long.', 'endDate')
  }
  if (input.status === 'active' && input.startDate > today) {
    throw new ServiceError('invalid', 'An active lease must have started. Use “Pending” for future move-ins.', 'startDate')
  }
  if (input.status === 'pending' && input.startDate <= today) {
    throw new ServiceError('invalid', 'A pending lease must start in the future.', 'startDate')
  }
  if (input.monthlyRent <= 0) throw new ServiceError('invalid', 'Monthly rent must be above $0.', 'monthlyRent')
  if (input.securityDeposit < 0 || input.securityDeposit > input.monthlyRent * MAX_DEPOSIT_MULTIPLE) {
    throw new ServiceError('invalid', `Security deposit can be at most ${MAX_DEPOSIT_MULTIPLE}× the monthly rent.`, 'securityDeposit')
  }
  if (!Number.isInteger(input.paymentDueDay) || input.paymentDueDay < 1 || input.paymentDueDay > 28) {
    throw new ServiceError('invalid', 'Payment due day must be between 1 and 28.', 'paymentDueDay')
  }
}

function assertUnitBelongs(db: DemoDatabase, input: LeaseAssignmentInput) {
  findProperty(db, input.propertyId)
  const unit = findUnit(db, input.unitId)
  if (unit.propertyId !== input.propertyId) throw new ServiceError('invalid', 'Choose a unit in the selected property.', 'unitId')
}

function createLease(db: DemoDatabase, tenant: Tenant, input: LeaseAssignmentInput): Lease {
  validateLeaseTerms(input)
  assertUnitBelongs(db, input)
  assertUnitAvailable(db, input.unitId)
  const now = new Date().toISOString()
  const lease: Lease = {
    id: createId('lease'),
    tenantId: tenant.id,
    ...input,
    endedAt: null,
    endReason: null,
    createdAt: now,
    updatedAt: now,
  }
  db.leases.push(lease)
  const unit = findUnit(db, lease.unitId)
  if (lease.status === 'active') {
    occupyUnit(db, lease, tenant.name)
    recordPropertyEvent(db, lease.propertyId, 'unit-leased', `Unit ${unit.number} leased`, `${tenant.name} moved in.`)
  } else {
    recordPropertyEvent(db, lease.propertyId, 'unit-updated', `Unit ${unit.number} reserved`, `Pending lease for ${tenant.name}.`)
  }
  return lease
}

/** Applies edited terms to the current lease, moving the tenant if the unit changed. */
function updateLease(db: DemoDatabase, tenant: Tenant, lease: Lease, input: LeaseAssignmentInput) {
  validateLeaseTerms(input)
  assertUnitBelongs(db, input)
  if (lease.status === 'active' && input.status === 'pending') {
    throw new ServiceError('invalid', 'A tenant who has moved in can’t go back to pending. End the lease instead.', 'status')
  }

  const moved = input.unitId !== lease.unitId
  const previousUnitId = lease.unitId
  const previousLabel = describeLeaseUnit(db, lease)
  if (moved) assertUnitAvailable(db, input.unitId, lease.id)

  const wasActive = lease.status === 'active'
  const changed = (Object.keys(input) as Array<keyof LeaseAssignmentInput>).some((key) => input[key] !== lease[key])
  if (!changed) return

  Object.assign(lease, input, { updatedAt: new Date().toISOString() })

  if (moved && wasActive) vacateUnit(db, previousUnitId)
  if (lease.status === 'active') occupyUnit(db, lease, tenant.name)

  if (moved) {
    record(db, tenant.id, 'lease-moved', 'Moved to a new unit', `From ${previousLabel} to ${describeLeaseUnit(db, lease)}.`, lease.id)
    const from = db.units.find((unit) => unit.id === previousUnitId)
    if (wasActive && from) {
      recordPropertyEvent(db, from.propertyId, 'unit-vacated', `Unit ${from.number} vacated`, `${tenant.name} moved to another unit.`)
    }
    if (lease.status === 'active') {
      recordPropertyEvent(db, lease.propertyId, 'unit-leased', `Unit ${findUnit(db, lease.unitId).number} leased`, `${tenant.name} moved in.`)
    }
  } else if (!wasActive && lease.status === 'active') {
    record(db, tenant.id, 'lease-activated', 'Moved in', `Lease for ${describeLeaseUnit(db, lease)} is now active.`, lease.id)
  } else {
    record(db, tenant.id, 'lease-updated', 'Lease terms updated', `Terms for ${describeLeaseUnit(db, lease)} were edited.`, lease.id)
  }
}

function describeLeaseUnit(db: DemoDatabase, lease: Lease): string {
  const property = db.properties.find((entry) => entry.id === lease.propertyId)
  const unit = db.units.find((entry) => entry.id === lease.unitId)
  const prefix = property?.type === 'commercial' ? 'Suite' : 'Unit'
  return `${property?.name ?? 'Property'}, ${prefix} ${unit?.number ?? '—'}`
}

function leaseCreatedTitle(lease: Lease): string {
  if (lease.status === 'pending') {
    return `Lease signed · move-in in ${daysBetween(todayIso(), lease.startDate)} days`
  }
  return 'Lease signed and moved in'
}

function record(
  db: DemoDatabase,
  tenantId: string,
  kind: TenantEventKind,
  title: string,
  description: string,
  leaseId?: string,
) {
  db.tenantEvents.unshift({ id: createId('tev'), tenantId, leaseId, kind, title, description, createdAt: new Date().toISOString() })
}
