import {
  getStorageStatus,
  isNewerVersion,
  isPersistenceSuspended,
  migrateDatabase,
  parseStoredDatabase,
  readDatabase,
  replaceWorkspace,
  resetWorkspace,
  sampleRecordIds,
  savedDataVersion,
  SCHEMA_VERSION,
  serializeDatabase,
  STORAGE_THRESHOLDS,
  storageHooks,
  type DemoDatabase,
  type StorageStatus,
} from '@/data/store/demo-store'
import { SAMPLE_STAFF_IDS } from '@/data/mock/staff-seed'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { simulateLatency } from '@/data/services/simulate-latency'
import { APP_VERSION } from '@/lib/app-version'
import { readStorage, STORAGE_KEYS } from '@/lib/storage'

/**
 * Workspace backups (Phase 9). A backup is a JSON file the user downloads
 * and keeps: it holds the saved data exactly as stored, so nothing is lost
 * even when that data couldn't be upgraded. Nothing here writes to storage.
 *
 * A downloaded file isn't proof that it can be restored: `inspectBackup`
 * checks a file on its own (format, version, a dry-run upgrade, the Finance
 * integrity check and the storage budget) without touching the workspace.
 */

export const BACKUP_APP = 'propwise'
export const BACKUP_KIND = 'workspace-backup'
export const BACKUP_FORMAT = 1

export interface WorkspaceBackup {
  app: typeof BACKUP_APP
  kind: typeof BACKUP_KIND
  format: typeof BACKUP_FORMAT
  exportedAt: string
  /** Propwise version that made the backup. */
  appVersion: string
  /** Saved-data version of `data` (null if it couldn't be read). */
  savedDataVersion: number | null
  /** `saved`: the stored data as-is. `sample`: nothing was saved yet, so the current sample workspace. */
  source: 'saved' | 'sample'
  /** The saved data text, exactly as stored in this browser. */
  data: string
  /** Device preferences when the backup was made. For reference: restoring keeps this browser's current theme and sidebar. */
  preferences: { theme: string | null; sidebarCollapsed: string | null }
}

/* ---------------------------------------------------------------- counts */

export const RECORD_TYPES = ['properties', 'units', 'tenants', 'leases', 'vendors', 'maintenanceRequests', 'workOrders', 'charges', 'payments', 'bills', 'recurringCharges', 'staff'] as const
export type RecordType = (typeof RECORD_TYPES)[number]
export type RecordCounts = Record<RecordType, number>

export const RECORD_TYPE_LABELS: Record<RecordType, string> = {
  properties: 'Properties',
  units: 'Units',
  tenants: 'Tenants',
  leases: 'Leases',
  vendors: 'Vendors',
  maintenanceRequests: 'Maintenance requests',
  workOrders: 'Work orders',
  charges: 'Charges',
  payments: 'Payments',
  bills: 'Bills',
  recurringCharges: 'Recurring charges',
  staff: 'Staff members',
}

export interface WorkspaceCounts {
  /** The original sample records (including any you edited). */
  sample: RecordCounts
  /** Records you created in the app. */
  user: RecordCounts
}

const emptyCounts = (): RecordCounts => Object.fromEntries(RECORD_TYPES.map((type) => [type, 0])) as RecordCounts

/**
 * Sample vs user-created records. Outside Finance a record is a sample when
 * its id is one of the fixed sample ids (staff too); Finance records carry a
 * `demo` flag.
 * Activity history isn't counted. A sample record you edited still counts as
 * a sample record.
 */
export function countWorkspaceRecords(db: DemoDatabase): WorkspaceCounts {
  const ids = sampleRecordIds()
  const counts: WorkspaceCounts = { sample: emptyCounts(), user: emptyCounts() }
  const add = (type: RecordType, sample: boolean) => {
    counts[sample ? 'sample' : 'user'][type] += 1
  }
  for (const record of db.properties) add('properties', ids.properties.has(record.id))
  for (const record of db.units) add('units', ids.units.has(record.id))
  for (const record of db.tenants) add('tenants', ids.tenants.has(record.id))
  for (const record of db.leases) add('leases', ids.leases.has(record.id))
  for (const record of db.vendors) add('vendors', ids.vendors.has(record.id))
  for (const record of db.serviceRequests) add('maintenanceRequests', ids.serviceRequests.has(record.id))
  for (const record of db.workOrders) add('workOrders', ids.workOrders.has(record.id))
  for (const record of db.charges) add('charges', record.demo === true)
  for (const record of db.payments) add('payments', record.demo === true)
  for (const record of db.expenses) add('bills', record.demo === true)
  for (const record of db.recurringCharges) add('recurringCharges', record.demo === true)
  // The sample team has fixed ids; your own record counts as a sample record (it always exists).
  for (const record of db.staff) add('staff', SAMPLE_STAFF_IDS.has(record.id))
  return counts
}

export const totalOf = (counts: RecordCounts) => RECORD_TYPES.reduce((total, type) => total + counts[type], 0)

export interface WorkspaceSummary {
  /** Null in a read-only session: the saved data couldn't be upgraded, so its records can't be counted. */
  counts: WorkspaceCounts | null
  storage: StorageStatus
  /** The stored data couldn't be upgraded; the session shows sample data and saves nothing. */
  suspended: boolean
}

/** Counts for the current workspace (for the reset and restore dialogs). */
export function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  const suspended = isPersistenceSuspended()
  return simulateLatency({ counts: suspended ? null : countWorkspaceRecords(readDatabase()), storage: getStorageStatus(), suspended })
}

/* ----------------------------------------------------------------- export */

/**
 * The backup of this browser's workspace. When data is saved, it's copied
 * exactly as stored, even if it couldn't be upgraded. When nothing has been
 * saved yet, the current sample workspace is exported instead.
 */
export function createBackup(now: Date = new Date()): WorkspaceBackup {
  const stored = readStorage(STORAGE_KEYS.demoData)
  let data: string
  let source: WorkspaceBackup['source']
  if (stored !== null) {
    data = stored
    source = 'saved'
  } else {
    data = serializeDatabase(readDatabase())
    source = 'sample'
  }
  let version: number | null
  try {
    version = savedDataVersion(parseStoredDatabase(data))
  } catch {
    version = null
  }
  return {
    app: BACKUP_APP,
    kind: BACKUP_KIND,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    appVersion: APP_VERSION,
    savedDataVersion: version,
    source,
    data,
    preferences: { theme: readStorage(STORAGE_KEYS.theme), sidebarCollapsed: readStorage(STORAGE_KEYS.sidebarCollapsed) },
  }
}

export const serializeBackup = (backup: WorkspaceBackup): string => `${JSON.stringify(backup, null, 2)}\n`

/** "propwise-backup-2026-10-22-0940.json" (local time). */
export function backupFileName(backup: Pick<WorkspaceBackup, 'exportedAt'>): string {
  const date = new Date(backup.exportedAt)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `propwise-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}.json`
}

/** The file to download: name and contents. The user keeps the file; nothing is uploaded. */
export function prepareBackupDownload(now: Date = new Date()): { fileName: string; contents: string; backup: WorkspaceBackup } {
  const backup = createBackup(now)
  return { fileName: backupFileName(backup), contents: serializeBackup(backup), backup }
}

/* ------------------------------------------------------------- inspection */

export interface BackupInspection {
  /** True when the backup can be restored: every check passed. */
  restorable: boolean
  /** Why it can't be restored (empty when it can). */
  problems: string[]
  /** Worth knowing, but restoring is still possible (e.g. made with a newer app version). */
  warnings: string[]
  source: WorkspaceBackup['source'] | null
  exportedAt: string | null
  appVersion: string | null
  savedDataVersion: number | null
  /** The data is older than this version and would be upgraded on restore. */
  needsUpgrade: boolean
  /** Size of the file, in characters. */
  fileChars: number
  /** Size the restored data would take in storage, in characters (after an upgrade). */
  restoredChars: number | null
  counts: WorkspaceCounts | null
  settings: { currency: string; locale: string; ruleVersions: number } | null
  preferences: WorkspaceBackup['preferences'] | null
}

/**
 * Checks a backup file without changing anything: the file format, the
 * saved-data version, a dry-run of the normal upgrade on a copy, the Finance
 * integrity check and whether the result fits the storage budget.
 */
export function inspectBackup(text: string): BackupInspection {
  const result: BackupInspection = {
    restorable: false,
    problems: [],
    warnings: [],
    source: null,
    exportedAt: null,
    appVersion: null,
    savedDataVersion: null,
    needsUpgrade: false,
    fileChars: text.length,
    restoredChars: null,
    counts: null,
    settings: null,
    preferences: null,
  }
  const stop = (problem: string) => {
    result.problems.push(problem)
    return result
  }

  let envelope: unknown
  try {
    envelope = JSON.parse(text)
  } catch {
    return stop('This file isn’t a Propwise backup: it isn’t valid JSON.')
  }
  if (!isRecord(envelope) || envelope.app !== BACKUP_APP || envelope.kind !== BACKUP_KIND) return stop('This file isn’t a Propwise backup.')
  if (typeof envelope.format !== 'number' || envelope.format > BACKUP_FORMAT) return stop('This backup was made with a newer version of Propwise.')
  if (envelope.format !== BACKUP_FORMAT || typeof envelope.data !== 'string') return stop('This backup is incomplete or damaged.')
  if (typeof envelope.exportedAt !== 'string' || Number.isNaN(Date.parse(envelope.exportedAt))) return stop('This backup is incomplete or damaged: it has no valid export date.')
  if (typeof envelope.appVersion !== 'string' || !SEMVER.test(envelope.appVersion)) return stop('This backup is incomplete or damaged: it doesn’t say which Propwise version made it.')
  result.exportedAt = envelope.exportedAt
  result.appVersion = envelope.appVersion
  result.source = envelope.source === 'sample' ? 'sample' : 'saved'
  if (compareVersions(envelope.appVersion, APP_VERSION) > 0) {
    result.warnings.push(`Made with Propwise ${envelope.appVersion}, newer than this version (${APP_VERSION}). Its saved data format is supported.`)
  }
  if (isRecord(envelope.preferences)) {
    const { theme, sidebarCollapsed } = envelope.preferences
    result.preferences = { theme: typeof theme === 'string' ? theme : null, sidebarCollapsed: typeof sidebarCollapsed === 'string' ? sidebarCollapsed : null }
  }

  let parsed: unknown
  try {
    parsed = parseStoredDatabase(envelope.data)
  } catch {
    return stop('The saved data in this backup is unreadable.')
  }
  const version = savedDataVersion(parsed)
  if (version === null) return stop(isNewerVersion(parsed) ? 'This backup holds data from a newer version of Propwise.' : 'The saved data in this backup isn’t in a format Propwise knows.')
  result.savedDataVersion = version
  if (typeof envelope.savedDataVersion === 'number' && envelope.savedDataVersion !== version) return stop('This backup is incomplete or damaged: its saved-data version doesn’t match the data.')
  result.needsUpgrade = version < SCHEMA_VERSION

  const restored = upgradeForRestore(parsed, stop)
  if (!restored) return result
  const issues = checkFinanceIntegrity(restored)
  if (issues.length > 0) return stop(`The saved data fails the Finance integrity check (${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}, first: ${issues[0]}).`)

  result.restoredChars = serializeDatabase(restored).length + STORAGE_KEYS.demoData.length
  if (result.restoredChars > storageHooks.limitChars * STORAGE_THRESHOLDS.refuse) return stop('This backup is too large to restore in this browser’s storage.')
  result.counts = countWorkspaceRecords(restored)
  result.settings = { currency: restored.finance.currency, locale: restored.finance.locale, ruleVersions: restored.finance.rules.length }
  result.restorable = true
  return result
}

function upgradeForRestore(parsed: unknown, stop: (problem: string) => unknown): DemoDatabase | null {
  try {
    return migrateDatabase(parsed as Parameters<typeof migrateDatabase>[0])
  } catch (error) {
    stop(`The saved data couldn’t be upgraded: ${error instanceof Error ? (error.message.split('\n')[0] ?? '') : String(error)}`)
    return null
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/

/** Compares "major.minor.patch" versions (pre-release tags ignored). */
export function compareVersions(a: string, b: string): number {
  const parts = (value: string) => value.split('-')[0]?.split('.').map(Number) ?? []
  const [x, y] = [parts(a), parts(b)]
  for (let index = 0; index < 3; index += 1) {
    const difference = (x[index] ?? 0) - (y[index] ?? 0)
    if (difference !== 0) return Math.sign(difference)
  }
  return 0
}

/* ------------------------------------------------------- restore and reset */

/** A restore or reset that was refused before anything changed. */
export class WorkspaceChangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceChangeError'
  }
}

export interface WorkspaceChangeResult {
  counts: WorkspaceCounts
  /** Saved-data version of the backup before it was upgraded (restore only). */
  restoredFromVersion: number | null
}

/**
 * Replaces the workspace with a backup. The file is checked again here, in
 * full, whatever an earlier inspection said: format, app and data versions,
 * the normal upgrade chain, the Finance integrity check and the storage
 * budget. The upgraded data then replaces the workspace in one save. If any
 * step fails, nothing changes and the promise rejects with the reason; it
 * only resolves once the restored workspace is saved.
 */
export function restoreBackup(text: string): Promise<WorkspaceChangeResult> {
  try {
    const inspection = inspectBackup(text)
    if (!inspection.restorable) throw new WorkspaceChangeError(inspection.problems[0] ?? 'This backup can’t be restored.')
    const envelope = JSON.parse(text) as WorkspaceBackup
    const restored = migrateDatabase(parseStoredDatabase(envelope.data) as Parameters<typeof migrateDatabase>[0])
    replaceWorkspace(restored)
    return simulateLatency({ counts: countWorkspaceRecords(readDatabase()), restoredFromVersion: inspection.savedDataVersion }, 300)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

/**
 * Full workspace reset: every record in this browser is deleted, including
 * the ones the user created, and the sample workspace is saved in their
 * place. Theme and sidebar preferences are kept. Resolves only once the new
 * workspace is saved; on failure nothing changes.
 */
export function resetWorkspaceData(): Promise<WorkspaceChangeResult> {
  try {
    resetWorkspace()
    return simulateLatency({ counts: countWorkspaceRecords(readDatabase()), restoredFromVersion: null }, 300)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}
