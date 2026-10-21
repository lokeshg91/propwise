import { isCurrentLease } from '@/data/domain/lease-rules'
import { createId, type DemoDatabase } from '@/data/store/demo-store'
import { ServiceError } from '@/data/services/service-error'
import { type Lease, type Property, type PropertyEventKind, type Unit } from '@/types'

/**
 * The only place that changes unit occupancy or a property's derived totals.
 * Every function works on a transaction draft from `updateDatabase`, so a
 * failed check rolls back all related changes.
 */

export function findProperty(db: DemoDatabase, id: string): Property {
  const property = db.properties.find((entry) => entry.id === id)
  if (!property) throw new ServiceError('not-found', 'Property not found.')
  return property
}

export function findUnit(db: DemoDatabase, id: string): Unit {
  const unit = db.units.find((entry) => entry.id === id)
  if (!unit) throw new ServiceError('not-found', 'Unit not found.')
  return unit
}

/** The active or pending lease holding a unit, if any. */
export function currentLeaseForUnit(db: DemoDatabase, unitId: string, exceptLeaseId?: string): Lease | undefined {
  return db.leases.find((lease) => lease.unitId === unitId && lease.id !== exceptLeaseId && isCurrentLease(lease))
}

/**
 * Ensures a unit can take a new or moved lease: it exists, isn't under
 * maintenance or occupied, and has no other active or pending lease.
 */
export function assertUnitAvailable(db: DemoDatabase, unitId: string, exceptLeaseId?: string): Unit {
  const unit = findUnit(db, unitId)
  const holder = currentLeaseForUnit(db, unitId, exceptLeaseId)
  if (holder) {
    throw new ServiceError(
      'conflict',
      holder.status === 'active' ? 'This unit already has an active tenant.' : 'This unit is reserved by a pending lease.',
      'unitId',
    )
  }
  if (unit.status === 'maintenance') throw new ServiceError('conflict', 'This unit is under maintenance.', 'unitId')
  if (unit.status === 'occupied' && !exceptLeaseId) throw new ServiceError('conflict', 'This unit is occupied.', 'unitId')
  return unit
}

/** Keeps a property's occupancy and revenue in sync with its units. */
export function refreshPropertyTotals(db: DemoDatabase, propertyId: string): void {
  const property = findProperty(db, propertyId)
  const units = db.units.filter((unit) => unit.propertyId === propertyId)
  const occupied = units.filter((unit) => unit.status === 'occupied')
  property.occupiedUnits = occupied.length
  property.maintenanceUnits = units.filter((unit) => unit.status === 'maintenance').length
  property.monthlyRevenue = occupied.reduce((sum, unit) => sum + unit.rent, 0)
  property.updatedAt = new Date().toISOString()
}

/** Marks a unit occupied by an active lease and copies the lease terms onto it. */
export function occupyUnit(db: DemoDatabase, lease: Lease, tenantName: string): void {
  const unit = findUnit(db, lease.unitId)
  Object.assign(unit, {
    status: 'occupied',
    tenantName,
    leaseEndDate: lease.endDate,
    rent: lease.monthlyRent,
    updatedAt: new Date().toISOString(),
  } satisfies Partial<Unit>)
  refreshPropertyTotals(db, unit.propertyId)
}

/** Releases a unit after its lease ended or moved. The rent stays as the asking rent. */
export function vacateUnit(db: DemoDatabase, unitId: string): void {
  const unit = findUnit(db, unitId)
  Object.assign(unit, {
    status: 'vacant',
    tenantName: null,
    leaseEndDate: null,
    updatedAt: new Date().toISOString(),
  } satisfies Partial<Unit>)
  refreshPropertyTotals(db, unit.propertyId)
}

export function recordPropertyEvent(
  db: DemoDatabase,
  propertyId: string,
  kind: PropertyEventKind,
  title: string,
  description: string,
): void {
  db.events.unshift({ id: createId('evt'), propertyId, kind, title, description, createdAt: new Date().toISOString() })
}
