import { properties as seedProperties } from '@/data/mock/properties'
import { generateSeedUnits } from '@/data/mock/units'
import {
  type DemoDatabase,
  type DemoDatabaseV1,
  migrateDatabase,
  readDatabase,
  resetDemoData,
  SCHEMA_VERSION,
  updateDatabase,
} from '@/data/store/demo-store'
import { getLeaseDisplayStatus, isCurrentLease } from '@/data/domain/lease-rules'
import { STORAGE_KEYS } from '@/lib/storage'
import { type Property, type Unit } from '@/types'

/** A Phase 4 (v1) snapshot with typical user edits on top of the seed. */
function buildV1Snapshot(): DemoDatabaseV1 {
  const properties: Property[] = structuredClone(seedProperties)
  const units: Unit[] = generateSeedUnits(properties)

  // Edit 1: a renamed property.
  const renamed = properties[0] as Property
  renamed.name = 'Renamed by user'

  // Edit 2: an occupied unit whose tenant and rent the user changed.
  const edited = units.find((unit) => unit.propertyId === renamed.id && unit.status === 'occupied') as Unit
  edited.tenantName = 'Edited Tenant'
  edited.rent = 2_345
  edited.leaseEndDate = '2027-09-30'

  // Edit 3: a user-created property with one occupied and one vacant unit.
  const created: Property = {
    ...structuredClone(renamed),
    id: 'prop_user1',
    name: 'User Created Lofts',
    totalUnits: 2,
    occupiedUnits: 1,
    maintenanceUnits: 0,
    monthlyRevenue: 1_900,
  }
  properties.push(created)
  const template = structuredClone(edited)
  units.push(
    { ...template, id: 'unit_user1', propertyId: created.id, number: '1A', status: 'occupied', tenantName: 'Nora Vale', rent: 1_900, leaseEndDate: '2027-03-31' },
    { ...template, id: 'unit_user2', propertyId: created.id, number: '1B', status: 'vacant', tenantName: null, rent: 1_750, leaseEndDate: null },
  )

  return {
    version: 1,
    properties,
    units,
    events: [{ id: 'evt_user', propertyId: created.id, kind: 'property-created', title: 'Property added', description: 'User Created Lofts was added.', createdAt: '2026-10-01T10:00:00.000Z' }],
  }
}

function storeRaw(value: unknown) {
  resetDemoData()
  window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(value))
}

const storedDatabase = (): DemoDatabase => JSON.parse(window.localStorage.getItem(STORAGE_KEYS.demoData) ?? 'null') as DemoDatabase

describe('demo store migration', () => {
  it('migrates v1 data without losing properties, units, edits or history', () => {
    const v1 = buildV1Snapshot()
    storeRaw(v1)
    const db = readDatabase()

    expect(db.version).toBe(SCHEMA_VERSION)
    expect(db.properties).toEqual(v1.properties)
    expect(db.units).toEqual(v1.units)
    expect(db.events).toEqual(v1.events)

    // Every occupied unit now has exactly one active lease that matches it.
    const occupied = v1.units.filter((unit) => unit.status === 'occupied')
    for (const unit of occupied) {
      const active = db.leases.filter((lease) => lease.unitId === unit.id && lease.status === 'active')
      expect(active).toHaveLength(1)
      const lease = active[0]
      const tenant = db.tenants.find((entry) => entry.id === lease?.tenantId)
      expect(tenant?.name).toBe(unit.tenantName)
      expect(lease?.monthlyRent).toBe(unit.rent)
      expect(lease?.endDate).toBe(unit.leaseEndDate)
    }

    const edited = db.leases.find((lease) => lease.unitId === v1.units.find((unit) => unit.tenantName === 'Edited Tenant')?.id)
    expect(edited).toMatchObject({ monthlyRent: 2_345, endDate: '2027-09-30', status: 'active' })
    expect(db.tenants.find((tenant) => tenant.name === 'Nora Vale')).toBeDefined()

    // No unit holds more than one active or pending lease.
    const holders = db.leases.filter(isCurrentLease).map((lease) => lease.unitId)
    expect(new Set(holders).size).toBe(holders.length)
  })

  it('persists the migration immediately so a refresh does not migrate again', () => {
    storeRaw(buildV1Snapshot())
    const first = readDatabase()
    expect(storedDatabase().version).toBe(SCHEMA_VERSION)

    // Simulate a page refresh: drop the in-memory cache but keep storage.
    const raw = window.localStorage.getItem(STORAGE_KEYS.demoData)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    const second = readDatabase()

    expect(second).toEqual(first)
  })

  it('is idempotent when migration runs again', () => {
    const once = migrateDatabase(buildV1Snapshot())
    const twice = migrateDatabase(once)
    expect(twice).toEqual(once)

    // Re-running the v1 path over the same records (e.g. a retry) creates the same ids.
    const retry = migrateDatabase(buildV1Snapshot())
    expect(retry.tenants.map((tenant) => tenant.id)).toEqual(once.tenants.map((tenant) => tenant.id))
    expect(retry.leases.map((lease) => lease.id)).toEqual(once.leases.map((lease) => lease.id))
    expect(new Set(once.tenants.map((tenant) => tenant.id)).size).toBe(once.tenants.length)
    expect(new Set(once.leases.map((lease) => lease.id)).size).toBe(once.leases.length)
  })

  it('keeps v2 data, including user-created tenants, unchanged on load', () => {
    const db = readDatabase()
    updateDatabase((draft) => {
      draft.tenants[0] = { ...(draft.tenants[0] as DemoDatabase['tenants'][number]), name: 'Changed Name' }
    })
    const raw = window.localStorage.getItem(STORAGE_KEYS.demoData)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    const reloaded = readDatabase()
    expect(reloaded.tenants[0]?.name).toBe('Changed Name')
    expect(reloaded.tenants).toHaveLength(db.tenants.length)
  })

  it('falls back to the seed when stored data is corrupt or unknown', () => {
    storeRaw({ version: 99, properties: 'nope' })
    expect(readDatabase().tenants.length).toBeGreaterThan(0)

    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, '{not json')
    expect(readDatabase().properties).toHaveLength(seedProperties.length)
  })
})

describe('demo store seed', () => {
  it('seeds 340 active, 25 past and 6 pending tenants consistent with the units', () => {
    const db = readDatabase()
    const statusOf = (tenantId: string) => {
      const leases = db.leases.filter((lease) => lease.tenantId === tenantId)
      if (leases.some((lease) => lease.status === 'active')) return 'active'
      if (leases.some((lease) => lease.status === 'pending')) return 'pending'
      return 'past'
    }
    const counts = { active: 0, pending: 0, past: 0 }
    for (const tenant of db.tenants) counts[statusOf(tenant.id)] += 1

    expect(counts).toEqual({ active: 340, past: 25, pending: 6 })
    expect(db.tenants).toHaveLength(371)
    expect(new Set(db.tenants.map((tenant) => tenant.email)).size).toBe(db.tenants.length)
    const phone = /^\(\d{3}\) 555-01\d{2}$/
    for (const tenant of db.tenants) {
      expect(tenant.phone).toMatch(phone)
      if (tenant.emergencyContact) {
        expect(tenant.emergencyContact.phone).toMatch(phone)
        expect(tenant.emergencyContact.relationship).toMatch(/^[A-Z][a-z]+$/)
        expect(tenant.emergencyContact.name).not.toMatch(/undefined/)
      }
      expect(tenant.name).not.toMatch(/undefined/)
      expect(tenant.mailingAddress.postalCode).toMatch(/^\d{5}$/)
    }

    const occupied = db.units.filter((unit) => unit.status === 'occupied')
    expect(occupied).toHaveLength(340)
    for (const unit of occupied) {
      expect(db.leases.filter((lease) => lease.unitId === unit.id && lease.status === 'active')).toHaveLength(1)
    }
    // Pending leases reserve vacant units.
    for (const lease of db.leases.filter((entry) => entry.status === 'pending')) {
      expect(db.units.find((unit) => unit.id === lease.unitId)?.status).toBe('vacant')
    }
  })
})

describe('updateDatabase', () => {
  it('rolls back every change when the mutation throws', () => {
    const before = structuredClone(readDatabase())
    const storedBefore = window.localStorage.getItem(STORAGE_KEYS.demoData)

    expect(() =>
      updateDatabase((db) => {
        db.tenants.splice(0, 5)
        ;(db.units[0] as Unit).status = 'maintenance'
        throw new Error('boom')
      }),
    ).toThrow('boom')

    expect(readDatabase()).toEqual(before)
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toBe(storedBefore)
  })
})

describe('demo attention states', () => {
  it('seeds holdover leases that keep their units occupied and one move-in due', () => {
    const db = readDatabase()
    const holdovers = db.leases.filter((lease) => getLeaseDisplayStatus(lease) === 'holdover')
    expect(holdovers).toHaveLength(3)
    for (const lease of holdovers) {
      const unit = db.units.find((entry) => entry.id === lease.unitId)
      expect(unit).toMatchObject({ status: 'occupied', leaseEndDate: lease.endDate })
    }
    expect(db.leases.filter((lease) => getLeaseDisplayStatus(lease) === 'move-in-due')).toHaveLength(1)
  })
})
