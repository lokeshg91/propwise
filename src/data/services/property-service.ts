import { activities } from '@/data/mock/activities'
import { maintenanceRequests } from '@/data/mock/maintenance-requests'
import { rentPayments } from '@/data/mock/payments'
import { createId, type DemoDatabase, readDatabase, updateDatabase } from '@/data/store/demo-store'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import {
  type Activity,
  type MaintenanceRequest,
  type Property,
  type PropertyEvent,
  type PropertyEventKind,
  type PropertyInput,
  type RentPayment,
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
      assertUniqueNumber(units, input.number)
      const unit: Unit = {
        id: createId('unit'),
        propertyId,
        ...normalizeUnit(input),
        updatedAt: new Date().toISOString(),
      }
      db.units.push(unit)
      refreshTotals(db, property)
      record(db, propertyId, 'unit-added', `Unit ${unit.number} added`, describeUnit(unit))
      return unit
    }),
  )
}

export function updateUnit(unitId: string, input: UnitInput): Promise<Unit> {
  return run(() =>
    updateDatabase((db) => {
      const unit = db.units.find((entry) => entry.id === unitId)
      if (!unit) throw new ServiceError('not-found', 'Unit not found.')
      const property = findProperty(db, unit.propertyId)
      assertUniqueNumber(
        db.units.filter((entry) => entry.propertyId === unit.propertyId && entry.id !== unitId),
        input.number,
      )
      Object.assign(unit, normalizeUnit(input), { updatedAt: new Date().toISOString() })
      refreshTotals(db, property)
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

function findProperty(db: DemoDatabase, id: string): Property {
  const property = db.properties.find((entry) => entry.id === id)
  if (!property) throw new ServiceError('not-found', 'Property not found.')
  return property
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
  const occupied = input.status === 'occupied'
  return {
    ...input,
    number: input.number.trim(),
    tenantName: occupied ? (input.tenantName?.trim() ?? null) : null,
    leaseEndDate: occupied ? input.leaseEndDate || null : null,
  }
}

function assertUniqueNumber(units: Unit[], number: string) {
  const normalized = number.trim().toLowerCase()
  if (units.some((unit) => unit.number.toLowerCase() === normalized)) {
    throw new ServiceError('conflict', `Unit ${number.trim()} already exists in this property.`, 'number')
  }
}

/** Keeps a property's occupancy and revenue in sync with its units. */
function refreshTotals(db: DemoDatabase, property: Property) {
  const units = db.units.filter((unit) => unit.propertyId === property.id)
  const occupied = units.filter((unit) => unit.status === 'occupied')
  property.occupiedUnits = occupied.length
  property.maintenanceUnits = units.filter((unit) => unit.status === 'maintenance').length
  property.monthlyRevenue = occupied.reduce((sum, unit) => sum + unit.rent, 0)
  property.updatedAt = new Date().toISOString()
}

function describeUnit(unit: Unit): string {
  if (unit.status === 'occupied') return `Occupied by ${unit.tenantName ?? 'a tenant'}.`
  return unit.status === 'maintenance' ? 'Marked as under maintenance.' : 'Marked as vacant and ready to lease.'
}

function record(db: DemoDatabase, propertyId: string, kind: PropertyEventKind, title: string, description: string) {
  db.events.unshift({ id: createId('evt'), propertyId, kind, title, description, createdAt: new Date().toISOString() })
}
