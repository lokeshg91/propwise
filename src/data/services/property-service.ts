import { activities } from '@/data/mock/activities'
import { maintenanceRequests } from '@/data/mock/maintenance-requests'
import { rentPayments } from '@/data/mock/payments'
import { createId, type DemoDatabase, readDatabase, updateDatabase } from '@/data/store/demo-store'
import { isCurrentLease } from '@/data/domain/lease-rules'
import {
  currentLeaseForUnit,
  findProperty,
  findUnit,
  recordPropertyEvent,
  refreshPropertyTotals,
} from '@/data/services/occupancy'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import {
  type Activity,
  type Lease,
  type MaintenanceRequest,
  type Property,
  type PropertyEvent,
  type PropertyEventKind,
  type PropertyInput,
  type RentPayment,
  type Tenant,
  type Unit,
  type UnitInput,
} from '@/types'

/** Everything the property details page needs. */
export interface PropertyDetail {
  property: Property
  units: Unit[]
  events: PropertyEvent[]
  activities: Activity[]
  maintenanceRequests: MaintenanceRequest[]
  payments: RentPayment[]
  /** Active and pending leases on this property's units. */
  currentLeases: Array<Lease & { tenant: Pick<Tenant, 'id' | 'name'> }>
}

export function getProperties(): Promise<Property[]> {
  return simulateLatency(readDatabase().properties)
}

export function getProperty(id: string): Promise<Property | null> {
  return simulateLatency(readDatabase().properties.find((property) => property.id === id) ?? null)
}

export function getPropertyDetail(id: string): Promise<PropertyDetail | null> {
  const db = readDatabase()
  const property = db.properties.find((entry) => entry.id === id)
  if (!property) return simulateLatency(null)
  return simulateLatency({
    property,
    units: db.units.filter((unit) => unit.propertyId === id),
    events: db.events.filter((event) => event.propertyId === id),
    activities: activities.filter((activity) => activity.propertyId === id),
    maintenanceRequests: maintenanceRequests.filter((request) => request.propertyId === id),
    payments: rentPayments.filter((payment) => payment.propertyId === id),
    currentLeases: db.leases
      .filter((lease) => lease.propertyId === id && isCurrentLease(lease))
      .map((lease) => {
        const tenant = db.tenants.find((entry) => entry.id === lease.tenantId)
        return { ...lease, tenant: { id: lease.tenantId, name: tenant?.name ?? 'Tenant' } }
      }),
  })
}

export function createProperty(input: PropertyInput): Promise<Property> {
  const now = new Date().toISOString()
  const property = updateDatabase((db) => {
    const created: Property = {
      id: createId('prop'),
      ...toPropertyFields(input),
      occupiedUnits: 0,
      maintenanceUnits: 0,
      monthlyRevenue: 0,
      acquiredAt: now.slice(0, 10),
      updatedAt: now,
    }
    db.properties.unshift(created)
    record(db, created.id, 'property-created', 'Property added', `${created.name} was added to the portfolio.`)
    return created
  })
  return simulateLatency(property, 250)
}

export function updateProperty(id: string, input: PropertyInput): Promise<Property> {
  return run(
    () =>
      updateDatabase((db) => {
        const property = findProperty(db, id)
        const unitCount = db.units.filter((unit) => unit.propertyId === id).length
        if (input.totalUnits < unitCount) {
          throw new ServiceError(
            'invalid',
            `This property already has ${unitCount} units. Total units can't be lower than that.`,
            'totalUnits',
          )
        }
        Object.assign(property, toPropertyFields(input), { updatedAt: new Date().toISOString() })
        record(db, id, 'property-updated', 'Property details updated', `Details for ${property.name} were edited.`)
        return property
      }),
    250,
  )
}

export function createUnit(propertyId: string, input: UnitInput): Promise<Unit> {
  return run(() =>
    updateDatabase((db) => {
      const property = findProperty(db, propertyId)
      const units = db.units.filter((unit) => unit.propertyId === propertyId)
      if (units.length >= property.totalUnits) {
        throw new ServiceError(
          'conflict',
          `${property.name} already has all ${property.totalUnits} units. Increase total units to add more.`,
        )
      }
      if (input.status === 'occupied') {
        throw new ServiceError('invalid', 'New units start vacant. Assign a tenant from the Tenants module.', 'status')
      }
      assertUniqueNumber(units, input.number)
      const unit: Unit = {
        id: createId('unit'),
        propertyId,
        ...normalizeUnit(input),
        tenantName: null,
        leaseEndDate: null,
        updatedAt: new Date().toISOString(),
      }
      db.units.push(unit)
      refreshPropertyTotals(db, propertyId)
      record(db, propertyId, 'unit-added', `Unit ${unit.number} added`, describeUnit(unit))
      return unit
    }),
  )
}

export function updateUnit(unitId: string, input: UnitInput): Promise<Unit> {
  return run(() =>
    updateDatabase((db) => {
      const unit = findUnit(db, unitId)
      const property = findProperty(db, unit.propertyId)
      assertUniqueNumber(
        db.units.filter((entry) => entry.propertyId === unit.propertyId && entry.id !== unitId),
        input.number,
      )
      const lease = currentLeaseForUnit(db, unitId)
      if (lease?.status === 'active') {
        // Occupancy and rent of a leased unit follow its lease.
        if (input.status !== 'occupied') {
          throw new ServiceError('conflict', 'End the tenant’s lease before changing this unit’s occupancy.', 'status')
        }
        if (input.rent !== unit.rent) {
          throw new ServiceError('conflict', 'Rent for a leased unit is set by the lease. Edit it from the tenant.', 'rent')
        }
      } else if (input.status === 'occupied') {
        throw new ServiceError('invalid', 'Assign a tenant from the Tenants module to mark this unit occupied.', 'status')
      } else if (lease?.status === 'pending' && input.status === 'maintenance') {
        throw new ServiceError('conflict', 'This unit is reserved by a pending lease. Cancel the lease first.', 'status')
      }
      Object.assign(unit, normalizeUnit(input), { updatedAt: new Date().toISOString() })
      refreshPropertyTotals(db, property.id)
      record(db, property.id, 'unit-updated', `Unit ${unit.number} updated`, describeUnit(unit))
      return unit
    }),
  )
}

/* ----------------------------------------------------------------------- */

/** Runs a synchronous mutation, returning a promise that rejects on error. */
function run<T>(mutation: () => T, latency?: number): Promise<T> {
  try {
    return simulateLatency(mutation(), latency)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

function toPropertyFields(input: PropertyInput) {
  return {
    name: input.name.trim(),
    type: input.type,
    status: input.status,
    totalUnits: input.totalUnits,
    location: {
      street: input.street.trim(),
      city: input.city.trim(),
      state: input.state,
      postalCode: input.postalCode.trim(),
    },
    description: input.description.trim() || undefined,
    yearBuilt: input.yearBuilt ?? undefined,
    areaSqft: input.areaSqft ?? undefined,
  }
}

function normalizeUnit(input: UnitInput): UnitInput {
  return { ...input, number: input.number.trim() }
}

function assertUniqueNumber(units: Unit[], number: string) {
  const normalized = number.trim().toLowerCase()
  if (units.some((unit) => unit.number.toLowerCase() === normalized)) {
    throw new ServiceError('conflict', `Unit ${number.trim()} already exists in this property.`, 'number')
  }
}

function describeUnit(unit: Unit): string {
  if (unit.status === 'occupied') return `Occupied by ${unit.tenantName ?? 'a tenant'}.`
  return unit.status === 'maintenance' ? 'Marked as under maintenance.' : 'Marked as vacant and ready to lease.'
}

function record(db: DemoDatabase, propertyId: string, kind: PropertyEventKind, title: string, description: string) {
  recordPropertyEvent(db, propertyId, kind, title, description)
}
