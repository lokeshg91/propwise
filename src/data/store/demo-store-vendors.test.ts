import { buildMaintenanceRecords } from '@/data/mock/maintenance-seed'
import { properties as seedProperties } from '@/data/mock/properties'
import { applyDemoAttentionStates, buildTenancyRecords } from '@/data/mock/tenancy-seed'
import { generateSeedUnits } from '@/data/mock/units'
import { buildSeedVendors, VENDOR_PROFILES } from '@/data/mock/vendor-seed'
import {
  type DemoDatabase,
  type DemoDatabaseV1,
  type DemoDatabaseV2,
  type DemoDatabaseV3,
  isPersistenceSuspended,
  migrateDatabase,
  migrationHooks,
  readDatabase,
  resetDemoData,
  SCHEMA_VERSION,
  StorageError,
  updateDatabase,
} from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type VendorV3, type WorkOrder } from '@/types'

const NOW = new Date()
const V3_VENDOR_KEYS = ['id', 'name', 'categories', 'contactName', 'phone', 'email', 'active'] as const

function buildV2(): DemoDatabaseV2 {
  const properties = structuredClone(seedProperties)
  const units = generateSeedUnits(properties)
  const { tenants, leases } = buildTenancyRecords(properties, units)
  applyDemoAttentionStates(units, leases)
  return { version: 2, properties, units, events: [], tenants, leases, tenantEvents: [] }
}

/** A Phase 6 (v3) snapshot built like the Phase 6 seed, plus typical Phase 6 edits. */
function buildV3Snapshot(): DemoDatabaseV3 {
  const v2 = buildV2()
  const maintenance = buildMaintenanceRecords(v2, {}, NOW)
  const v3: DemoDatabaseV3 = {
    ...v2,
    version: 3,
    vendors: maintenance.vendors,
    serviceRequests: maintenance.requests,
    workOrders: maintenance.workOrders,
    maintenanceEvents: maintenance.events,
    sequences: { request: 2062 },
  }

  // Edit 1: a request created in the app with a work order for BlueLine.
  const template = structuredClone(v3.serviceRequests[0] as DemoDatabaseV3['serviceRequests'][number])
  v3.serviceRequests.unshift({ ...template, id: 'MR-2062', title: 'Created in Phase 6', status: 'scheduled', reopenCount: 0, completedAt: null, cancelledAt: null, cancelReason: null })
  const order: WorkOrder = {
    id: 'WO-2062-1',
    requestId: 'MR-2062',
    vendorId: 'ven_blueline-plumbing',
    status: 'scheduled',
    scheduledFor: null,
    estimatedCost: 150,
    actualCost: null,
    notes: '',
    createdAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-20T09:00:00.000Z',
    completedAt: null,
    cancelledAt: null,
  }
  v3.workOrders.push(order)
  v3.maintenanceEvents.push({ id: 'mev_MR-2062_x', requestId: 'MR-2062', kind: 'created', title: 'Request created', description: 'Created in Phase 6.', createdAt: '2026-10-20T08:00:00.000Z' })
  v3.sequences.request = 2063

  // Edit 2: a vendor deactivated in Phase 6 (tests did this through the store) and a changed phone.
  const proclean = v3.vendors.find((vendor) => vendor.id === 'ven_proclean-facilities') as VendorV3
  proclean.active = false
  const summit = v3.vendors.find((vendor) => vendor.id === 'ven_summit-hvac-services') as VendorV3
  summit.phone = '(214) 555-0100'
  return v3
}

function storeRaw(value: unknown) {
  resetDemoData()
  window.localStorage.setItem(STORAGE_KEYS.demoData, typeof value === 'string' ? value : JSON.stringify(value))
}
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)

function expectV3Preserved(v3: DemoDatabaseV3, v4: DemoDatabase) {
  for (const key of ['properties', 'units', 'events', 'tenants', 'leases', 'tenantEvents', 'serviceRequests', 'workOrders', 'maintenanceEvents'] as const) {
    expect(v4[key]).toEqual(v3[key])
  }
  // v5 adds finance reference counters next to the request counter.
  expect(v4.sequences.request).toBe(v3.sequences.request)
  // Every v3 vendor keeps its id and every stored field.
  for (const vendor of v3.vendors) {
    const upgraded = v4.vendors.find((entry) => entry.id === vendor.id)
    expect(upgraded).toBeDefined()
    for (const key of V3_VENDOR_KEYS) expect(upgraded?.[key]).toEqual(vendor[key])
  }
}

function expectNoDuplicates(db: DemoDatabase) {
  expect(new Set(db.vendors.map((vendor) => vendor.id)).size).toBe(db.vendors.length)
  expect(new Set(db.vendorEvents.map((event) => event.id)).size).toBe(db.vendorEvents.length)
  // Every vendor event belongs to a vendor; every work order points at a vendor.
  const ids = new Set(db.vendors.map((vendor) => vendor.id))
  for (const event of db.vendorEvents) expect(ids.has(event.vendorId)).toBe(true)
  for (const order of db.workOrders) expect(ids.has(order.vendorId)).toBe(true)
}

afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
})

describe('fresh installation (v4)', () => {
  it('has the 15 original vendors unchanged, the 3 new vendors and their history', () => {
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(5)
    expect(db.vendors).toHaveLength(18)
    for (const original of buildSeedVendors()) {
      const vendor = db.vendors.find((entry) => entry.id === original.id)
      for (const key of V3_VENDOR_KEYS) expect(vendor?.[key]).toEqual(original[key])
      expect(vendor?.company).toBe(VENDOR_PROFILES[original.id]?.company ?? '')
      expect(vendor?.createdAt).toBeTruthy()
    }

    const byName = (name: string) => db.vendors.find((vendor) => vendor.name === name)
    const securelock = byName('SecureLock Co.')
    expect(byName('Northstar Painting Co.')).toMatchObject({ active: true })
    expect(byName('Lakeside Locksmiths')).toMatchObject({ active: true, phone: securelock?.phone })
    expect(byName('Prairie HVAC Partners')).toMatchObject({ active: false })
    for (const name of ['Northstar Painting Co.', 'Lakeside Locksmiths', 'Prairie HVAC Partners']) {
      expect(db.workOrders.some((order) => order.vendorId === byName(name)?.id)).toBe(false)
    }

    // Every vendor has a "created" event; inactive ones also have "deactivated" with a date.
    for (const vendor of db.vendors) {
      const kinds = db.vendorEvents.filter((event) => event.vendorId === vendor.id).map((event) => event.kind)
      expect(kinds).toContain('created')
      if (!vendor.active) {
        expect(kinds).toContain('deactivated')
        expect(vendor.deactivatedAt).toBeTruthy()
      } else {
        expect(vendor.deactivatedAt).toBeNull()
      }
    }
    expectNoDuplicates(db)
  })

  it('doesn’t change maintenance figures compared with the Phase 6 seed', () => {
    const db = readDatabase()
    const v2 = buildV2()
    const phase6 = buildMaintenanceRecords(v2, {}, NOW)
    expect(db.serviceRequests.map((request) => [request.id, request.status, request.priority])).toEqual(
      phase6.requests.map((request) => [request.id, request.status, request.priority]),
    )
    expect(db.workOrders.map((order) => [order.id, order.vendorId, order.status, order.actualCost])).toEqual(
      phase6.workOrders.map((order) => [order.id, order.vendorId, order.status, order.actualCost]),
    )
    expect(db.maintenanceEvents).toHaveLength(phase6.events.length)
  })
})

describe('Phase 6 (v3) → v4 migration', () => {
  it('preserves every Phase 2–6 record and stored vendor field', () => {
    const v3 = buildV3Snapshot()
    storeRaw(v3)
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expectV3Preserved(v3, db)

    // Phase 6 edits survive: deactivated vendor stays inactive, edited phone kept.
    expect(db.vendors.find((vendor) => vendor.id === 'ven_proclean-facilities')).toMatchObject({ active: false })
    expect(db.vendors.find((vendor) => vendor.id === 'ven_proclean-facilities')?.deactivatedAt).toBeTruthy()
    expect(db.vendors.find((vendor) => vendor.id === 'ven_summit-hvac-services')?.phone).toBe('(214) 555-0100')
    // New fields only fill what was missing; createdAt precedes the vendor's first job.
    const blueline = db.vendors.find((vendor) => vendor.id === 'ven_blueline-plumbing')
    const firstJob = db.workOrders.filter((order) => order.vendorId === 'ven_blueline-plumbing').map((order) => order.createdAt).sort()[0] ?? ''
    expect((blueline?.createdAt ?? '') < firstJob).toBe(true)
    expect(blueline).toMatchObject({ company: 'BlueLine Plumbing LLC' })

    expect(db.vendors).toHaveLength(18)
    expectNoDuplicates(db)
  })

  it('saves immediately and reloads the same data', () => {
    storeRaw(buildV3Snapshot())
    const first = readDatabase()
    const raw = stored()
    expect(JSON.parse(raw ?? '{}').version).toBe(SCHEMA_VERSION)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    expect(readDatabase()).toEqual(first)
  })

  it('is idempotent: repeated upgrades add no vendors or events', () => {
    const v3 = buildV3Snapshot()
    const once = migrateDatabase(v3, NOW)
    expect(migrateDatabase(once, NOW)).toEqual(once)
    const again = migrateDatabase(structuredClone(v3), NOW)
    expect(again.vendors.map((vendor) => vendor.id)).toEqual(once.vendors.map((vendor) => vendor.id))
    expect(again.vendorEvents.map((event) => event.id)).toEqual(once.vendorEvents.map((event) => event.id))
    expectNoDuplicates(once)
  })

  it('doesn’t add a demo vendor whose name or email is already used', () => {
    const v3 = buildV3Snapshot()
    v3.vendors.push({ id: 'ven_user', name: 'Northstar Painting', categories: ['general'], contactName: 'X', phone: '(555) 555-0999', email: 'x@x.example', active: true })
    const v4 = migrateDatabase(v3, NOW)
    expect(v4.vendors.filter((vendor) => vendor.name.startsWith('Northstar'))).toHaveLength(1)
    expect(v4.vendors.find((vendor) => vendor.id === 'ven_user')).toBeDefined()
  })

  it('rolls back on failure: stored data stays untouched and nothing is saved', () => {
    const v3 = buildV3Snapshot()
    storeRaw(v3)
    const before = stored()
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated failure')
    }
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    readDatabase()
    expect(warn).toHaveBeenCalled()
    expect(isPersistenceSuspended()).toBe(true)
    // Saving is paused: a change is refused (no false success) and stored data stays untouched.
    expect(() =>
      updateDatabase((draft) => {
        draft.vendors[0] = { ...(draft.vendors[0] as DemoDatabase['vendors'][number]), name: 'Changed' }
      }),
    ).toThrow(StorageError)
    expect(readDatabase().vendors[0]?.name).not.toBe('Changed')
    expect(stored()).toBe(before)
    warn.mockRestore()

    migrationHooks.beforeCommit = () => undefined
    storeRaw(JSON.parse(before ?? '{}'))
    expectV3Preserved(v3, readDatabase())
  })
})

describe('older versions → v4', () => {
  it('chains v2 → v3 → v4', () => {
    const v2 = buildV2()
    storeRaw(v2)
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    for (const key of ['properties', 'units', 'tenants', 'leases'] as const) expect(db[key]).toEqual(v2[key])
    expect(db.vendors).toHaveLength(18)
    expect(db.serviceRequests.length).toBeGreaterThanOrEqual(55)
    expectNoDuplicates(db)
  })

  it('chains v1 → v2 → v3 → v4', () => {
    const properties = structuredClone(seedProperties)
    const v1: DemoDatabaseV1 = { version: 1, properties, units: generateSeedUnits(properties), events: [] }
    storeRaw(v1)
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expect(db.units).toEqual(v1.units)
    expect(db.tenants.length).toBeGreaterThan(300)
    expect(db.vendors).toHaveLength(18)
    expectNoDuplicates(db)
  })
})
