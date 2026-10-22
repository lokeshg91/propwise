import { buildMaintenanceRecords, FIRST_APP_REQUEST_NUMBER, requestNumber } from '@/data/mock/maintenance-seed'
import { properties as seedProperties } from '@/data/mock/properties'
import { applyDemoAttentionStates, buildTenancyRecords } from '@/data/mock/tenancy-seed'
import { generateSeedUnits } from '@/data/mock/units'
import { upgradeVendors } from '@/data/store/vendor-upgrade'
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import {
  type Lease,
  type MaintenanceEvent,
  type Property,
  type PropertyEvent,
  type ServiceRequest,
  type Tenant,
  type TenantEvent,
  type Unit,
  type Vendor,
  type VendorEvent,
  type VendorV3,
  type WorkOrder,
} from '@/types'

/**
 * Tiny in-browser database for the demo. Records created or edited in the
 * app are saved to localStorage so they survive a refresh. Only the data
 * services read or write it; swap the services for API calls to remove it.
 */
export interface DemoDatabase {
  version: typeof SCHEMA_VERSION
  properties: Property[]
  units: Unit[]
  events: PropertyEvent[]
  tenants: Tenant[]
  leases: Lease[]
  tenantEvents: TenantEvent[]
  vendors: Vendor[]
  vendorEvents: VendorEvent[]
  serviceRequests: ServiceRequest[]
  workOrders: WorkOrder[]
  maintenanceEvents: MaintenanceEvent[]
  /** Next number for requests created in the app ("MR-<n>"). */
  sequences: { request: number }
}

/** Phase 4 storage shape (no tenants or leases). */
export interface DemoDatabaseV1 {
  version: 1
  properties: Property[]
  units: Unit[]
  events: PropertyEvent[]
}

/** Phase 5 storage shape (no maintenance). */
export interface DemoDatabaseV2 extends Omit<DemoDatabaseV1, 'version'> {
  version: 2
  tenants: Tenant[]
  leases: Lease[]
  tenantEvents: TenantEvent[]
}

/** Phase 6 storage shape (maintenance, vendors without profile fields or history). */
export interface DemoDatabaseV3 extends Omit<DemoDatabaseV2, 'version'> {
  version: 3
  vendors: VendorV3[]
  serviceRequests: ServiceRequest[]
  workOrders: WorkOrder[]
  maintenanceEvents: MaintenanceEvent[]
  sequences: { request: number }
}

export const SCHEMA_VERSION = 4

let cache: DemoDatabase | null = null
/**
 * Set when stored data couldn't be upgraded. The app then runs on sample data
 * without saving, so the stored data stays untouched for the next attempt.
 */
let persistenceSuspended = false

/** Fresh install: the v3 seed run through the same v4 step that upgrades stored data. */
function createSeed(now: Date = new Date()): DemoDatabase {
  const properties = structuredClone(seedProperties)
  const units = generateSeedUnits(properties)
  const { tenants, leases } = buildTenancyRecords(properties, units)
  applyDemoAttentionStates(units, leases)
  const maintenance = buildMaintenanceRecords({ properties, units, tenants, leases }, {}, now)
  const v3: DemoDatabaseV3 = {
    version: 3,
    properties,
    units,
    events: [],
    tenants,
    leases,
    tenantEvents: [],
    vendors: maintenance.vendors,
    serviceRequests: maintenance.requests,
    workOrders: maintenance.workOrders,
    maintenanceEvents: maintenance.events,
    sequences: { request: nextRequestNumber(maintenance.requests) },
  }
  return upgradeToV4(v3, now)
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const hasArrays = (value: Record<string, unknown>, keys: string[]) => keys.every((key) => Array.isArray(value[key]))

const V1_KEYS = ['properties', 'units', 'events']
const V2_KEYS = [...V1_KEYS, 'tenants', 'leases', 'tenantEvents']
const V3_KEYS = [...V2_KEYS, 'vendors', 'serviceRequests', 'workOrders', 'maintenanceEvents']
const V4_KEYS = [...V3_KEYS, 'vendorEvents']

function isV1(value: unknown): value is DemoDatabaseV1 {
  return isObject(value) && value.version === 1 && hasArrays(value, V1_KEYS)
}

function isV2(value: unknown): value is DemoDatabaseV2 {
  return isObject(value) && value.version === 2 && hasArrays(value, V2_KEYS)
}

function isV3(value: unknown): value is DemoDatabaseV3 {
  return isObject(value) && value.version === 3 && hasArrays(value, V3_KEYS) && isObject(value.sequences)
}

function isV4(value: unknown): value is DemoDatabase {
  return isObject(value) && value.version === SCHEMA_VERSION && hasArrays(value, V4_KEYS) && isObject(value.sequences)
}

function nextRequestNumber(requests: ServiceRequest[], current = 0): number {
  return Math.max(current, FIRST_APP_REQUEST_NUMBER, ...requests.map((request) => requestNumber(request.id) + 1))
}

/** Test hook: lets tests simulate a failure inside the migration. */
export const migrationHooks: { beforeCommit: (db: DemoDatabase) => void } = { beforeCommit: () => undefined }

/**
 * Upgrades stored data to the current schema. Each step only adds records or
 * fills fields that don't exist yet; nothing stored is overwritten:
 *
 * - v1 → v2: every occupied unit gets a tenant and active lease built from its
 *   stored tenant name, lease end and rent.
 * - v2 → v3: vendors, the 17 original maintenance requests (same ids) and
 *   generated demo requests linked to existing units and tenants.
 * - v3 → v4: vendor profile fields (company, notes, dates), vendor history and
 *   three demo vendors. Maintenance records are untouched.
 *
 * Record ids are fixed or derived from their source, so running the migration
 * again adds nothing. It works on a copy and returns a new object; the caller
 * saves it only if every step succeeds.
 */
export function migrateDatabase(
  data: DemoDatabaseV1 | DemoDatabaseV2 | DemoDatabaseV3 | DemoDatabase,
  now: Date = new Date(),
): DemoDatabase {
  // Already current: nothing to add.
  if (isV4(data)) return structuredClone(data)

  let v3: DemoDatabaseV3
  if (isV3(data)) {
    v3 = structuredClone(data)
  } else {
    let v2: DemoDatabaseV2
    if (isV2(data)) {
      v2 = structuredClone(data)
    } else {
      const v1 = structuredClone(data as DemoDatabaseV1)
      const added = buildTenancyRecords(v1.properties, v1.units)
      v2 = { ...v1, version: 2, tenants: added.tenants, leases: added.leases, tenantEvents: [] }
    }
    v3 = {
      ...v2,
      version: 3,
      vendors: [],
      serviceRequests: [],
      workOrders: [],
      maintenanceEvents: [],
      sequences: { request: FIRST_APP_REQUEST_NUMBER },
    }
    addMaintenance(v3, now)
  }

  const v4 = upgradeToV4(v3, now)
  migrationHooks.beforeCommit(v4)
  return v4
}

function addMaintenance(db: DemoDatabaseV3, now: Date) {
  const added = buildMaintenanceRecords(
    db,
    { vendors: db.vendors, requests: db.serviceRequests, workOrders: db.workOrders, events: db.maintenanceEvents },
    now,
  )
  db.vendors.push(...added.vendors)
  db.serviceRequests.push(...added.requests)
  db.workOrders.push(...added.workOrders)
  db.maintenanceEvents.push(...added.events)
  db.sequences = { request: nextRequestNumber(db.serviceRequests, db.sequences.request) }
}

/** v3 → v4: adds vendor profiles and history; every other record is carried over as-is. */
function upgradeToV4(v3: DemoDatabaseV3, now: Date): DemoDatabase {
  const { vendors, events } = upgradeVendors(v3.vendors, [], v3.workOrders, now)
  return { ...v3, version: SCHEMA_VERSION, vendors, vendorEvents: events }
}

function load(): DemoDatabase {
  const raw = readStorage(STORAGE_KEYS.demoData)
  if (!raw) return createSeed()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return createSeed() // Unreadable data can't be recovered; start fresh.
  }
  if (isV4(parsed)) return parsed
  if (!isV1(parsed) && !isV2(parsed) && !isV3(parsed)) return createSeed()

  try {
    const migrated = migrateDatabase(parsed)
    // Persist straight away so a refresh doesn't migrate again.
    writeStorage(STORAGE_KEYS.demoData, JSON.stringify(migrated))
    return migrated
  } catch (error) {
    // Roll back: leave the stored data exactly as it was and don't overwrite
    // it this session. The upgrade is retried on the next load.
    persistenceSuspended = true
    console.warn('Propwise: could not upgrade saved demo data; using sample data for this session.', error)
    return createSeed()
  }
}

export function readDatabase(): DemoDatabase {
  cache ??= load()
  return cache
}

/** True when saving is paused because stored data couldn't be upgraded. */
export function isPersistenceSuspended(): boolean {
  return persistenceSuspended
}

/**
 * Runs `mutate` as a transaction: changes are applied to a copy, which only
 * replaces the database (in memory and storage) if `mutate` succeeds. A thrown
 * error leaves everything untouched, so related records never get out of sync.
 */
export function updateDatabase<T>(mutate: (db: DemoDatabase) => T): T {
  const draft = structuredClone(readDatabase())
  const result = mutate(draft)
  cache = draft
  if (!persistenceSuspended) writeStorage(STORAGE_KEYS.demoData, JSON.stringify(draft))
  return result
}

/** Discards local changes and restores the original sample data. */
export function resetDemoData(): void {
  cache = null
  persistenceSuspended = false
  removeStorage(STORAGE_KEYS.demoData)
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
