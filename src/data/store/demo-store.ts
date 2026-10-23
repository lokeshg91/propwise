import { buildMaintenanceRecords, FIRST_APP_REQUEST_NUMBER, requestNumber } from '@/data/mock/maintenance-seed'
import { properties as seedProperties } from '@/data/mock/properties'
import { applyDemoAttentionStates, buildTenancyRecords } from '@/data/mock/tenancy-seed'
import { generateSeedUnits } from '@/data/mock/units'
import { todayIso } from '@/data/domain/dates'
import { assertFinanceIntegrity, assertSameFinanceOutcomes } from '@/data/store/finance-integrity'
import { decodeDatabase, encodeDatabase, isEncodedDatabase } from '@/data/store/storage-codec'
import { reconcileFinance } from '@/data/store/finance-reconcile'
import { addFinance, upgradeToV6 } from '@/data/store/finance-upgrade'
import { upgradeVendors } from '@/data/store/vendor-upgrade'
import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'
import {
  type AppSettings,
  type Charge,
  type Expense,
  type FinanceDemoScope,
  type FinanceEvent,
  type FinanceSettings,
  type FinanceSettingsV5,
  type Lease,
  type Payment,
  type RecurringCharge,
  type SettingsEvent,
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
  /** Workspace preferences (Phase 9). */
  appSettings: AppSettings
  /** Changes made in Settings, oldest first (Phase 9). */
  settingsEvents: SettingsEvent[]
  /** Next numbers for requests ("MR-<n>") and finance references ("INC-", "PAY-", "EXP-"). */
  sequences: { request: number; income: number; payment: number; expense: number }
}

/** Phase 8 (v0.8) storage shape: one inline rule, no workspace settings. */
export interface DemoDatabaseV5 extends Omit<DemoDatabase, 'version' | 'finance' | 'appSettings' | 'settingsEvents'> {
  version: 5
  finance: FinanceSettingsV5
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

export const SCHEMA_VERSION = 6

let cache: DemoDatabase | null = null
/**
 * Set when stored data couldn't be upgraded. The app then runs on sample data
 * without saving, so the stored data stays untouched for the next attempt.
 */
let persistenceSuspended = false

/** Fresh install: the sample data run through the same v4 → current step that upgrades stored data. */
function createSeed(now: Date = new Date()): DemoDatabase {
  const v4 = buildSeedV4(now)
  return addFinance(v4, now, scopeOf(v4))
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

export const SAMPLE_COLLECTIONS = ['properties', 'units', 'tenants', 'leases', 'vendors', 'serviceRequests', 'workOrders'] as const
export type SampleCollection = (typeof SAMPLE_COLLECTIONS)[number]

let sampleIds: Record<SampleCollection, ReadonlySet<string>> | null = null

/**
 * Ids of the original sample records outside Finance (Finance records carry
 * a `demo` flag instead). They're fixed or derived from the sample units, so
 * they're the same on every install and every day.
 */
export function sampleRecordIds(): Record<SampleCollection, ReadonlySet<string>> {
  if (!sampleIds) {
    const seed = buildSeedV4(new Date())
    const ids = (records: ReadonlyArray<{ id: string }>) => new Set(records.map((record) => record.id))
    sampleIds = {
      properties: ids(seed.properties),
      units: ids(seed.units),
      tenants: ids(seed.tenants),
      leases: ids(seed.leases),
      vendors: ids(seed.vendors),
      serviceRequests: ids(seed.serviceRequests),
      workOrders: ids(seed.workOrders),
    }
  }
  return sampleIds
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

function isV5(value: unknown): value is DemoDatabaseV5 {
  return isObject(value) && value.version === 5 && hasArrays(value, V5_KEYS) && isObject(value.sequences) && isObject(value.finance)
}

function isV6(value: unknown): value is DemoDatabase {
  return (
    isObject(value) &&
    value.version === SCHEMA_VERSION &&
    hasArrays(value, [...V5_KEYS, 'settingsEvents']) &&
    isObject(value.sequences) &&
    isObject(value.finance) &&
    Array.isArray(value.finance.rules) &&
    isObject(value.appSettings)
  )
}

/** The saved-data version of parsed data, or null when it isn't Propwise data in a known format. */
export function savedDataVersion(value: unknown): number | null {
  if (isV6(value)) return 6
  if (isV5(value)) return 5
  if (isV4(value)) return 4
  if (isV3(value)) return 3
  if (isV2(value)) return 2
  if (isV1(value)) return 1
  return null
}

/** True for data saved by a newer Propwise than this one. */
export const isNewerVersion = (value: unknown): boolean => isObject(value) && typeof value.version === 'number' && value.version > SCHEMA_VERSION

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
 * - v5 → v6: the inline grace days and late fee become the first rule
 *   version, and workspace settings and the settings history are added.
 *   Every record is copied unchanged, and every charge must keep the same
 *   status, balance, lateness and late-fee outcome.
 *
 * Record ids are fixed or derived from their source, so running the migration
 * again adds nothing. It works on a copy and returns a new object; the caller
 * saves it only if every step succeeds.
 */
export function migrateDatabase(
  data: DemoDatabaseV1 | DemoDatabaseV2 | DemoDatabaseV3 | DemoDatabaseV4 | DemoDatabaseV5 | DemoDatabase,
  now: Date = new Date(),
): DemoDatabase {
  // Already current: nothing to add.
  if (isV6(data)) return structuredClone(data)

  let current: DemoDatabase
  if (isV5(data)) {
    // v5 → v6 reshapes settings only. Every charge must keep exactly the same
    // status, balance, lateness and late-fee outcome under the new rule model.
    const v5 = structuredClone(data)
    current = upgradeToV6(v5)
    assertSameFinanceOutcomes(v5, current, todayIso(now))
  } else {
    const v4 = isV4(data) ? structuredClone(data) : upgradeToV4(toV3(data, now), now)
    current = addFinance(v4, now, canonicalScope(v4, now))
  }
  assertFinanceIntegrity(current)
  migrationHooks.beforeCommit(current)
  return current
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
  if (isV6(parsed)) {
    usedChars = charsFor(raw)
    // Post rent for a new month. Derived only, so if saving fails the same records are posted again next time.
    if (reconcileNow(parsed).changed) trySave(parsed)
    return parsed
  }
  if (!isV1(parsed) && !isV2(parsed) && !isV3(parsed) && !isV4(parsed) && !isV5(parsed)) return fresh()

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
  if (!cache) {
    cache = load()
    notifyDataSoon()
  }
  return cache
}

/** The loaded database, or null before anything has read it (never triggers a load). */
export function peekDatabase(): DemoDatabase | null {
  return cache
}

const dataListeners = new Set<() => void>()

/** Notifies after the data is loaded, after every committed change and after a reset (settings follow the store). */
export function subscribeDatabase(listener: () => void): () => void {
  dataListeners.add(listener)
  return () => dataListeners.delete(listener)
}

function notifyData() {
  for (const listener of dataListeners) listener()
}

// Loads can happen while React renders; tell listeners once that work is done.
const notifyDataSoon = () => queueMicrotask(notifyData)

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
  notifyData()
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
  notifyData()
}

/**
 * Replaces the whole workspace (restore from backup, Phase 9). `next` must
 * already be a current, integrity-checked database. Finance is reconciled on
 * a copy, the copy is saved, and only then does it replace the data in
 * memory. If saving fails the stored data and the session stay exactly as
 * they were (StorageError). Works in a read-only session too: replacing the
 * data is the way out of it, and the user downloads a backup first.
 * Device preferences (theme, sidebar) are separate keys and aren't touched.
 */
export function replaceWorkspace(next: DemoDatabase): void {
  const draft = structuredClone(next)
  reconcileNow(draft)
  assertFinanceIntegrity(draft)
  migrationHooks.beforeCommit(draft)
  save(draft)
  cache = draft
  persistenceSuspended = false
  notify()
  notifyData()
}

/**
 * Full workspace reset (Phase 9): deletes every record in this browser,
 * including ones the user created, and saves a fresh sample workspace in
 * one write. Success means the new workspace is saved. If saving fails,
 * nothing changes (StorageError). Device preferences aren't touched.
 */
export function resetWorkspace(now: Date = new Date()): void {
  replaceWorkspace(createSeed(now))
}

export function createId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
