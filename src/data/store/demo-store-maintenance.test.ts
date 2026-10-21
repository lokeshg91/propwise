import { isActiveRequest } from '@/data/domain/maintenance-rules'
import { LEGACY_REQUEST_IDS } from '@/data/mock/maintenance-seed'
import { properties as seedProperties } from '@/data/mock/properties'
import { applyDemoAttentionStates, buildTenancyRecords } from '@/data/mock/tenancy-seed'
import { generateSeedUnits } from '@/data/mock/units'
import {
  type DemoDatabase,
  type DemoDatabaseV1,
  type DemoDatabaseV2,
  isPersistenceSuspended,
  migrateDatabase,
  migrationHooks,
  readDatabase,
  resetDemoData,
  SCHEMA_VERSION,
  updateDatabase,
} from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type Lease, type Tenant, type Unit } from '@/types'

/** A Phase 5 (v2) snapshot with typical user edits on top of the seed. */
function buildV2Snapshot(): DemoDatabaseV2 {
  const properties = structuredClone(seedProperties)
  const units = generateSeedUnits(properties)
  const { tenants, leases } = buildTenancyRecords(properties, units)
  applyDemoAttentionStates(units, leases)

  // Edit 1: a renamed property.
  ;(properties[0] as (typeof properties)[number]).name = 'Renamed in Phase 5'

  // Edit 2: a tenant added in the app, with an active lease on a formerly vacant unit.
  const isFree = (unit: Unit) =>
    unit.status === 'vacant' && !leases.some((entry) => entry.unitId === unit.id && (entry.status === 'active' || entry.status === 'pending'))
  const vacant = units.find(isFree) as Unit
  const tenant: Tenant = {
    ...structuredClone(tenants[0] as Tenant),
    id: 'ten_user1',
    name: 'Rowan Pierce',
    email: 'rowan.pierce@example.com',
  }
  const lease: Lease = {
    ...structuredClone(leases[0] as Lease),
    id: 'lease_user1',
    tenantId: tenant.id,
    propertyId: vacant.propertyId,
    unitId: vacant.id,
    status: 'active',
    endedAt: null,
    endReason: null,
  }
  Object.assign(vacant, { status: 'occupied', tenantName: tenant.name, leaseEndDate: lease.endDate })
  tenants.push(tenant)
  leases.push(lease)

  // Edit 3: an ended lease (unit released).
  const ended = leases.find((entry) => entry.status === 'active' && entry.id.startsWith('lease_u_')) as Lease
  Object.assign(ended, { status: 'terminated', endedAt: '2026-10-01', endReason: 'early-termination' })
  Object.assign(units.find((unit) => unit.id === ended.unitId) as Unit, { status: 'vacant', tenantName: null, leaseEndDate: null })

  // Edit 4: a unit the user put under maintenance by hand.
  const manual = units.find((unit) => isFree(unit) && unit.id !== ended.unitId) as Unit
  manual.status = 'maintenance'

  return {
    version: 2,
    properties,
    units,
    events: [{ id: 'evt_user', propertyId: properties[0]?.id ?? '', kind: 'property-updated', title: 'Property updated', description: 'Renamed.', createdAt: '2026-10-10T10:00:00.000Z' }],
    tenants,
    leases,
    tenantEvents: [{ id: 'tev_user', tenantId: tenant.id, kind: 'tenant-created', title: 'Tenant added', description: 'Rowan Pierce was added.', createdAt: '2026-10-12T10:00:00.000Z' }],
  }
}

function storeRaw(value: unknown) {
  resetDemoData()
  window.localStorage.setItem(STORAGE_KEYS.demoData, typeof value === 'string' ? value : JSON.stringify(value))
}

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)

/** References between maintenance records and the rest of the data are valid. */
function expectConsistent(db: DemoDatabase) {
  const ids = (list: Array<{ id: string }>) => list.map((entry) => entry.id)
  for (const list of [db.serviceRequests, db.workOrders, db.vendors, db.maintenanceEvents]) {
    expect(new Set(ids(list)).size).toBe(list.length)
  }
  const requestIds = new Set(ids(db.serviceRequests))
  const vendorIds = new Set(ids(db.vendors))
  for (const request of db.serviceRequests) {
    const unit = request.unitId ? db.units.find((entry) => entry.id === request.unitId) : null
    expect(db.properties.some((property) => property.id === request.propertyId)).toBe(true)
    if (request.unitId) expect(unit?.propertyId).toBe(request.propertyId)
    else expect(request.area).toBeTruthy()
    if (request.tenantId) {
      expect(db.leases.some((lease) => lease.tenantId === request.tenantId && lease.unitId === request.unitId)).toBe(true)
    }
    const active = db.workOrders.filter((order) => order.requestId === request.id && (order.status === 'scheduled' || order.status === 'in-progress'))
    expect(active.length).toBeLessThanOrEqual(1)
  }
  for (const order of db.workOrders) {
    expect(requestIds.has(order.requestId)).toBe(true)
    expect(vendorIds.has(order.vendorId)).toBe(true)
    if (order.status === 'completed') expect(order.completedAt && order.actualCost !== null).toBeTruthy()
  }
  for (const event of db.maintenanceEvents) expect(requestIds.has(event.requestId)).toBe(true)
}

afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
})

describe('fresh installation', () => {
  it('seeds vendors, the 17 original requests and generated demo requests', () => {
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expect(db.vendors).toHaveLength(15)
    expect(db.vendors.filter((vendor) => !vendor.active)).toHaveLength(1)
    for (const id of LEGACY_REQUEST_IDS) expect(db.serviceRequests.some((request) => request.id === id)).toBe(true)
    expect(db.serviceRequests.length).toBeGreaterThanOrEqual(55)
    expect(db.sequences.request).toBe(2062)
    expectConsistent(db)

    // Every unit under maintenance has an active request explaining why.
    for (const unit of db.units.filter((entry) => entry.status === 'maintenance')) {
      expect(db.serviceRequests.some((request) => request.unitId === unit.id && isActiveRequest(request))).toBe(true)
    }
    // Seeding never changes unit occupancy.
    const statuses = (units: Unit[]) => units.map((unit) => unit.status)
    expect(statuses(db.units).filter((status) => status === 'occupied')).toHaveLength(340)
  })

  it('includes the demo states the UI needs', () => {
    const db = readDatabase()
    const byStatus = (status: string) => db.serviceRequests.filter((request) => request.status === status).length
    expect(byStatus('cancelled')).toBe(3)
    expect(byStatus('on-hold')).toBe(3)
    expect(byStatus('completed')).toBeGreaterThan(20)
    expect(db.serviceRequests.some((request) => request.reopenCount > 0)).toBe(true)
    expect(db.workOrders.some((order) => order.status === 'cancelled')).toBe(true)
    expect(db.maintenanceEvents.some((event) => event.kind === 'reassigned')).toBe(true)
    expect(db.serviceRequests.filter((request) => request.source === 'tenant').length).toBeGreaterThanOrEqual(10)
  })
})

describe('Phase 5 (v2) → v3 migration', () => {
  it('keeps every Phase 5 record and adds maintenance', () => {
    const v2 = buildV2Snapshot()
    storeRaw(v2)
    const db = readDatabase()

    expect(db.version).toBe(SCHEMA_VERSION)
    expect(db.properties).toEqual(v2.properties)
    expect(db.units).toEqual(v2.units)
    expect(db.events).toEqual(v2.events)
    expect(db.tenants).toEqual(v2.tenants)
    expect(db.leases).toEqual(v2.leases)
    expect(db.tenantEvents).toEqual(v2.tenantEvents)

    expect(db.vendors).toHaveLength(15)
    for (const id of LEGACY_REQUEST_IDS) expect(db.serviceRequests.filter((request) => request.id === id)).toHaveLength(1)
    expectConsistent(db)

    // The unit the user put under maintenance gets a request but keeps its status and isn't marked as taken offline by it.
    const manual = v2.units.filter((unit) => unit.status === 'maintenance')
    for (const unit of manual) {
      const request = db.serviceRequests.find((entry) => entry.unitId === unit.id && isActiveRequest(entry))
      expect(request?.unitTakenOffline).toBe(false)
    }
  })

  it('saves the migration immediately so a refresh loads the same data', () => {
    storeRaw(buildV2Snapshot())
    const first = readDatabase()
    const raw = stored()
    expect(JSON.parse(raw ?? '{}').version).toBe(SCHEMA_VERSION)

    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    expect(readDatabase()).toEqual(first)
  })

  it('is idempotent: running it again adds nothing and keeps ids', () => {
    const now = new Date()
    const v2 = buildV2Snapshot()
    const once = migrateDatabase(v2, now)
    expect(migrateDatabase(once, now)).toEqual(once)

    const retry = migrateDatabase(buildV2Snapshot(), now)
    expect(retry.serviceRequests.map((request) => request.id)).toEqual(once.serviceRequests.map((request) => request.id))
    expect(retry.vendors.map((vendor) => vendor.id)).toEqual(once.vendors.map((vendor) => vendor.id))
    expect(retry.workOrders.map((order) => order.id)).toEqual(once.workOrders.map((order) => order.id))
  })

  it('continues request numbers after the originals, and keeps them after a reload', () => {
    storeRaw(buildV2Snapshot())
    expect(readDatabase().sequences.request).toBe(2062)
    updateDatabase((db) => {
      db.sequences.request = 2070
    })
    const raw = stored()
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    expect(readDatabase().sequences.request).toBe(2070)
  })

  it('rolls back on failure: stored data stays untouched and nothing is saved', () => {
    const v2 = buildV2Snapshot()
    storeRaw(v2)
    const before = stored()
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated failure')
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)

    const db = readDatabase()
    expect(warn).toHaveBeenCalled()
    expect(stored()).toBe(before)
    expect(isPersistenceSuspended()).toBe(true)
    // The session runs on sample data, and edits don't overwrite the stored Phase 5 data.
    expect(db.version).toBe(SCHEMA_VERSION)
    updateDatabase((draft) => {
      draft.properties[0] = { ...(draft.properties[0] as DemoDatabase['properties'][number]), name: 'Changed' }
    })
    expect(stored()).toBe(before)
    warn.mockRestore()

    // The next load retries and succeeds.
    migrationHooks.beforeCommit = () => undefined
    storeRaw(JSON.parse(before ?? '{}'))
    expect(readDatabase().tenants).toEqual(v2.tenants)
    expect(JSON.parse(stored() ?? '{}').version).toBe(SCHEMA_VERSION)
  })
})

describe('Phase 4 (v1) → v3 migration', () => {
  it('chains through v2 and keeps units and history', () => {
    const properties = structuredClone(seedProperties)
    const v1: DemoDatabaseV1 = { version: 1, properties, units: generateSeedUnits(properties), events: [] }
    storeRaw(v1)
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expect(db.units).toEqual(v1.units)
    expect(db.tenants.length).toBeGreaterThan(300)
    expect(db.serviceRequests.length).toBeGreaterThanOrEqual(55)
    expectConsistent(db)
  })
})
