import { properties as seedProperties } from '@/data/mock/properties'
import { applyDemoAttentionStates, buildTenancyRecords } from '@/data/mock/tenancy-seed'
import { generateSeedUnits } from '@/data/mock/units'
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import { type Lease, type Property, type PropertyEvent, type Tenant, type TenantEvent, type Unit } from '@/types'

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
}

/** Phase 4 storage shape (no tenants or leases). */
export interface DemoDatabaseV1 {
  version: 1
  properties: Property[]
  units: Unit[]
  events: PropertyEvent[]
}

export const SCHEMA_VERSION = 2

let cache: DemoDatabase | null = null

function createSeed(): DemoDatabase {
  const properties = structuredClone(seedProperties)
  const units = generateSeedUnits(properties)
  const { tenants, leases } = buildTenancyRecords(properties, units)
  applyDemoAttentionStates(units, leases)
  return { version: SCHEMA_VERSION, properties, units, events: [], tenants, leases, tenantEvents: [] }
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null

function isV1(value: unknown): value is DemoDatabaseV1 {
  return (
    isObject(value) &&
    value.version === 1 &&
    Array.isArray(value.properties) &&
    Array.isArray(value.units) &&
    Array.isArray(value.events)
  )
}

function isV2(value: unknown): value is DemoDatabase {
  return (
    isObject(value) &&
    value.version === SCHEMA_VERSION &&
    ['properties', 'units', 'events', 'tenants', 'leases', 'tenantEvents'].every((key) => Array.isArray(value[key]))
  )
}

/**
 * Upgrades Phase 4 (v1) data to v2. Properties, units and history are kept
 * as-is; every occupied unit gets a tenant and active lease built from its
 * stored tenant name, lease end and rent. Record ids derive from their source
 * unit, so the migration is idempotent: re-running it adds nothing.
 */
export function migrateDatabase(data: DemoDatabaseV1 | DemoDatabase): DemoDatabase {
  const base: DemoDatabase = isV2(data)
    ? structuredClone(data)
    : {
        ...structuredClone(data),
        version: SCHEMA_VERSION,
        tenants: [],
        leases: [],
        tenantEvents: [],
      }
  if (isV2(data)) return base

  const added = buildTenancyRecords(base.properties, base.units, { tenants: base.tenants, leases: base.leases })
  base.tenants.push(...added.tenants)
  base.leases.push(...added.leases)
  return base
}

function load(): DemoDatabase {
  const raw = readStorage(STORAGE_KEYS.demoData)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (isV2(parsed)) return parsed
      if (isV1(parsed)) {
        const migrated = migrateDatabase(parsed)
        // Persist straight away so a refresh doesn't migrate again.
        writeStorage(STORAGE_KEYS.demoData, JSON.stringify(migrated))
        return migrated
      }
    } catch {
      // Corrupt data falls back to the seed below.
    }
  }
  return createSeed()
}

export function readDatabase(): DemoDatabase {
  cache ??= load()
  return cache
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
  writeStorage(STORAGE_KEYS.demoData, JSON.stringify(draft))
  return result
}

/** Discards local changes and restores the original sample data. */
export function resetDemoData(): void {
  cache = null
  removeStorage(STORAGE_KEYS.demoData)
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
