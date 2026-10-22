import { buildMaintenanceRecords, FIRST_APP_REQUEST_NUMBER, requestNumber } from '@/data/mock/maintenance-seed'
import { properties as seedProperties } from '@/data/mock/properties'
import { applyDemoAttentionStates, buildTenancyRecords } from '@/data/mock/tenancy-seed'
import { generateSeedUnits } from '@/data/mock/units'
import { todayIso } from '@/data/domain/dates'
import { assertFinanceIntegrity } from '@/data/store/finance-integrity'
import { decodeDatabase, encodeDatabase, isEncodedDatabase } from '@/data/store/storage-codec'
import { reconcileFinance } from '@/data/store/finance-reconcile'
import { upgradeToV5 } from '@/data/store/finance-upgrade'
import { upgradeVendors } from '@/data/store/vendor-upgrade'
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import {
  type Charge,
  type Expense,
  type FinanceDemoScope,
  type FinanceEvent,
  type FinanceSettings,
  type Lease,
  type Payment,
  type RecurringCharge,
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
  charges: Charge[]
  payments: Payment[]
  expenses: Expense[]
  recurringCharges: RecurringCharge[]
  financeEvents: FinanceEvent[]
  finance: FinanceSettings
  /** Next numbers for requests ("MR-<n>") and finance references ("INC-", "PAY-", "EXP-"). */
  sequences: { request: number; income: number; payment: number; expense: number }
}

/** Phase 7 storage shape (no finance). */
export interface DemoDatabaseV4 extends Omit<DemoDatabaseV3, 'version' | 'vendors'> {
  version: 4
  vendors: Vendor[]
  vendorEvents: VendorEvent[]
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

export const SCHEMA_VERSION = 5

let cache: DemoDatabase | null = null
/**
 * Set when stored data couldn't be upgraded. The app then runs on sample data
 * without saving, so the stored data stays untouched for the next attempt.
 */
let persistenceSuspended = false

/** Fresh install: the sample data run through the same v4 and v5 steps that upgrade stored data. */
function createSeed(now: Date = new Date()): DemoDatabase {
  const v4 = buildSeedV4(now)
  return upgradeToV5(v4, now, scopeOf(v4))
}

/** Everything in a fresh v4 seed is sample data. */
function scopeOf(v4: DemoDatabaseV4): FinanceDemoScope {
  return {
    leaseIds: v4.leases.map((lease) => lease.id),
    propertyIds: v4.properties.map((property) => property.id),
    workOrderIds: v4.workOrders.filter((order) => order.status === 'completed' && order.actualCost !== null).map((order) => order.id),
  }
}

/**
 * Which records of upgraded data are the original samples: they match a
 * freshly built seed. Leases, properties and work orders the user created
 * (or completed) in the app are left out, so they never get fictional
 * finance history.
 */
function canonicalScope(v4: DemoDatabaseV4, now: Date): FinanceDemoScope {
  const sample = buildSeedV4(now)
  const seed = scopeOf(sample)
  const seedOrders = new Map(sample.workOrders.map((order) => [order.id, order]))
  const leaseIds = new Set(seed.leaseIds)
  const propertyIds = new Set(seed.propertyIds)
  return {
    leaseIds: v4.leases.filter((lease) => leaseIds.has(lease.id)).map((lease) => lease.id),
    propertyIds: v4.properties.filter((property) => propertyIds.has(property.id)).map((property) => property.id),
    workOrderIds: v4.workOrders
      .filter((order) => {
        const sample = seedOrders.get(order.id)
        return (
          order.status === 'completed' &&
          sample?.status === 'completed' &&
          sample.vendorId === order.vendorId &&
          sample.actualCost === order.actualCost &&
          order.actualCost !== null
        )
      })
      .map((order) => order.id),
  }
}

function buildSeedV4(now: Date): DemoDatabaseV4 {
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
const V5_KEYS = [...V4_KEYS, 'charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents']

function isV1(value: unknown): value is DemoDatabaseV1 {
  return isObject(value) && value.version === 1 && hasArrays(value, V1_KEYS)
}

function isV2(value: unknown): value is DemoDatabaseV2 {
  return isObject(value) && value.version === 2 && hasArrays(value, V2_KEYS)
}

function isV3(value: unknown): value is DemoDatabaseV3 {
  return isObject(value) && value.version === 3 && hasArrays(value, V3_KEYS) && isObject(value.sequences)
}

function isV4(value: unknown): value is DemoDatabaseV4 {
  return isObject(value) && value.version === 4 && hasArrays(value, V4_KEYS) && isObject(value.sequences)
}

function isV5(value: unknown): value is DemoDatabase {
  return isObject(value) && value.version === SCHEMA_VERSION && hasArrays(value, V5_KEYS) && isObject(value.sequences) && isObject(value.finance)
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
 * - v4 → v5: Finance (charges, payments, bills, schedules, history, settings).
 *   Every v4 collection is carried over unchanged; fictional history is only
 *   added for the original sample records. The result must pass the finance
 *   integrity check before it can be saved.
 *
 * Record ids are fixed or derived from their source, so running the migration
 * again adds nothing. It works on a copy and returns a new object; the caller
 * saves it only if every step succeeds.
 */
export function migrateDatabase(
  data: DemoDatabaseV1 | DemoDatabaseV2 | DemoDatabaseV3 | DemoDatabaseV4 | DemoDatabase,
  now: Date = new Date(),
): DemoDatabase {
  // Already current: nothing to add.
  if (isV5(data)) return structuredClone(data)

  const v4 = isV4(data) ? structuredClone(data) : upgradeToV4(toV3(data, now), now)
  const v5 = upgradeToV5(v4, now, canonicalScope(v4, now))
  assertFinanceIntegrity(v5)
  migrationHooks.beforeCommit(v5)
  return v5
}

function toV3(data: DemoDatabaseV1 | DemoDatabaseV2 | DemoDatabaseV3, now: Date): DemoDatabaseV3 {
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
  return v3
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
function upgradeToV4(v3: DemoDatabaseV3, now: Date): DemoDatabaseV4 {
  const { vendors, events } = upgradeVendors(v3.vendors, [], v3.workOrders, now)
  return { ...v3, version: 4, vendors, vendorEvents: events }
}

/* ---------------------------------------------------------------- storage */

/**
 * localStorage holds about 5 million characters per site in current
 * browsers. Propwise warns well before that and refuses a save that would
 * come close, so a save can never fail half-way or silently.
 */
export const STORAGE_LIMIT_CHARS = 5_000_000
export const STORAGE_THRESHOLDS = { warning: 0.6, critical: 0.8, refuse: 0.95 } as const

export type StorageLevel = 'ok' | 'warning' | 'critical'

export interface StorageStatus {
  /** `suspended`: saved data couldn't be upgraded, so this session is read-only. */
  mode: 'saving' | 'suspended'
  usedChars: number
  limitChars: number
  /** Share of the limit in use, 0–1. */
  usage: number
  level: StorageLevel
  /** The last save that failed, cleared by the next successful one. */
  lastError: { code: StorageErrorCode; message: string; at: string } | null
}

export type StorageErrorCode = 'suspended' | 'over-budget' | 'write-failed'

/** A change that couldn't be saved. The previous saved data is kept and nothing in the session changes. */
export class StorageError extends Error {
  readonly code: StorageErrorCode
  constructor(code: StorageErrorCode, message: string) {
    super(message)
    this.name = 'StorageError'
    this.code = code
  }
}

export const isStorageError = (error: unknown): error is StorageError => error instanceof StorageError

const STORAGE_MESSAGES: Record<StorageErrorCode, string> = {
  suspended: 'Changes can’t be saved in this session because your saved data couldn’t be upgraded. Reload the page to try again.',
  'over-budget': 'This change wasn’t saved: browser storage for Propwise is almost full.',
  'write-failed': 'This change wasn’t saved: the browser refused to store it (storage may be full or disabled).',
}

/** Test hook: lets tests shrink the storage limit. */
export const storageHooks: { limitChars: number } = { limitChars: STORAGE_LIMIT_CHARS }

/** Characters the saved data uses; -1 until measured. */
let usedChars = -1
let lastError: StorageStatus['lastError'] = null
const listeners = new Set<() => void>()

export function levelFor(usage: number): StorageLevel {
  if (usage >= STORAGE_THRESHOLDS.critical) return 'critical'
  if (usage >= STORAGE_THRESHOLDS.warning) return 'warning'
  return 'ok'
}

let snapshot: StorageStatus | null = null

export function getStorageStatus(): StorageStatus {
  const db = readDatabase()
  if (usedChars < 0) usedChars = charsFor(serializeDatabase(db))
  const usage = usedChars / storageHooks.limitChars
  const mode = persistenceSuspended ? 'suspended' : 'saving'
  const level = levelFor(usage)
  // Same object while nothing changed, so React's useSyncExternalStore can use it directly.
  if (
    snapshot &&
    snapshot.mode === mode &&
    snapshot.usedChars === usedChars &&
    snapshot.limitChars === storageHooks.limitChars &&
    snapshot.lastError === lastError
  ) {
    return snapshot
  }
  snapshot = { mode, usedChars, limitChars: storageHooks.limitChars, usage, level, lastError }
  return snapshot
}

/** Notifies when the storage status changes (used by the app shell banner). */
export function subscribeStorageStatus(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const notify = () => {
  for (const listener of listeners) listener()
}

const charsFor = (serialized: string) => serialized.length + STORAGE_KEYS.demoData.length

/** Serializes and saves; throws StorageError without touching stored data when that isn't possible. */
export function serializeDatabase(db: DemoDatabase): string {
  return JSON.stringify(encodeDatabase(db as unknown as DemoDatabase & Record<string, unknown>))
}

/** Parses stored text in any save format (v1–v4 plain JSON, v5 column-encoded). */
export function parseStoredDatabase(raw: string): unknown {
  const parsed: unknown = JSON.parse(raw)
  return isEncodedDatabase(parsed) ? decodeDatabase(parsed) : parsed
}

function save(db: DemoDatabase): void {
  const serialized = serializeDatabase(db)
  const chars = charsFor(serialized)
  if (chars > storageHooks.limitChars * STORAGE_THRESHOLDS.refuse) fail('over-budget')
  if (!writeStorage(STORAGE_KEYS.demoData, serialized)) fail('write-failed')
  usedChars = chars
  if (lastError) lastError = null
  notify()
}

function fail(code: StorageErrorCode): never {
  lastError = { code, message: STORAGE_MESSAGES[code], at: new Date().toISOString() }
  notify()
  throw new StorageError(code, STORAGE_MESSAGES[code])
}

/* ------------------------------------------------------------------- load */

const reconcileNow = (db: DemoDatabase) => reconcileFinance(db, { today: todayIso(), now: new Date().toISOString() })

function load(): DemoDatabase {
  const raw = readStorage(STORAGE_KEYS.demoData)
  if (!raw) return fresh()

  let parsed: unknown
  try {
    parsed = parseStoredDatabase(raw)
  } catch {
    return fresh() // Unreadable data can't be recovered; start fresh.
  }
  if (isV5(parsed)) {
    usedChars = charsFor(raw)
    // Post rent for a new month. Derived only, so if saving fails the same records are posted again next time.
    if (reconcileNow(parsed).changed) trySave(parsed)
    return parsed
  }
  if (!isV1(parsed) && !isV2(parsed) && !isV3(parsed) && !isV4(parsed)) return fresh()

  try {
    const migrated = migrateDatabase(parsed)
    reconcileNow(migrated)
    // Persist straight away so a refresh doesn't migrate again. A migration that can't be saved is a failed migration.
    save(migrated)
    return migrated
  } catch (error) {
    // Roll back: leave the stored data exactly as it was and don't overwrite
    // it this session. The upgrade is retried on the next load.
    persistenceSuspended = true
    lastError = null
    console.warn('Propwise: could not upgrade saved demo data; using sample data for this session without saving.', error)
    const seed = createSeed()
    reconcileNow(seed)
    return seed
  }
}

function fresh(): DemoDatabase {
  const seed = createSeed()
  reconcileNow(seed)
  usedChars = -1
  return seed
}

function trySave(db: DemoDatabase) {
  try {
    save(db)
  } catch {
    // Reported through getStorageStatus(); the data is re-derived on the next load.
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
 * Runs `mutate` as a transaction: changes are applied to a copy, Finance is
 * reconciled on that copy, and the copy only replaces the database (in
 * memory and storage) once it has been saved. If `mutate` throws or the save
 * fails, nothing changes: related records never get out of sync, and the app
 * never shows a change that wasn't stored.
 */
export function updateDatabase<T>(mutate: (db: DemoDatabase) => T): T {
  const current = readDatabase()
  if (persistenceSuspended) fail('suspended')
  const draft = structuredClone(current)
  const result = mutate(draft)
  reconcileNow(draft)
  save(draft)
  cache = draft
  return result
}

/** Discards local changes and restores the original sample data. */
export function resetDemoData(): void {
  cache = null
  persistenceSuspended = false
  usedChars = -1
  lastError = null
  removeStorage(STORAGE_KEYS.demoData)
  notify()
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
