import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { createProperty, recordPayment, updateCurrency } from '@/data/services'
import {
  countWorkspaceRecords,
  createBackup,
  inspectBackup,
  resetWorkspaceData,
  restoreBackup,
  serializeBackup,
  totalOf,
  WorkspaceChangeError,
  type WorkspaceBackup,
} from '@/data/services/backup-service'
import {
  getStorageStatus,
  isPersistenceSuspended,
  isStorageError,
  migrationHooks,
  parseStoredDatabase,
  readDatabase,
  resetDemoData,
  SCHEMA_VERSION,
  serializeDatabase,
  STORAGE_LIMIT_CHARS,
  storageHooks,
  type DemoDatabase,
} from '@/data/store/demo-store'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { STORAGE_KEYS } from '@/lib/storage'

/**
 * Phase 9 Stage 2: restore from backup and full workspace reset. Both
 * replace the workspace in one save; any failure leaves it exactly as it was,
 * and success is only reported once the new data is saved.
 */

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
  window.localStorage.setItem(STORAGE_KEYS.theme, 'dark')
  window.localStorage.setItem(STORAGE_KEYS.sidebarCollapsed, 'true')
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  storageHooks.limitChars = STORAGE_LIMIT_CHARS
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

async function addUserWork() {
  await createProperty({
    name: 'Restore Test Plaza',
    type: 'residential',
    status: 'stable',
    street: '2 Test Street',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    totalUnits: 3,
    description: '',
    yearBuilt: null,
    areaSqft: null,
  })
  const db = readDatabase()
  const payments = paymentsByCharge(db.payments)
  const charge = db.charges.find((entry) => entry.category === 'rent' && entry.dueDate <= TODAY && !entry.voidedAt && chargeState(entry, payments.get(entry.id), TODAY, 5).balanceCents > 5000) as DemoDatabase['charges'][number]
  await recordPayment(charge.id, { amountCents: 4321, receivedOn: TODAY, method: 'cash' })
  await updateCurrency('EUR')
}

/** The workspace as it stands, for "unchanged" checks. */
const snapshot = () => ({ raw: stored(), db: structuredClone(readDatabase()), theme: window.localStorage.getItem(STORAGE_KEYS.theme), sidebar: window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) })
function expectUnchanged(before: ReturnType<typeof snapshot>) {
  expect(stored()).toBe(before.raw)
  expect(readDatabase()).toEqual(before.db)
  expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe(before.theme)
  expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe(before.sidebar)
}

/** v0.8.0's shape of the same data. */
function asV5(db: DemoDatabase): Record<string, unknown> {
  const copy = structuredClone(db) as unknown as Record<string, unknown>
  delete copy.appSettings
  delete copy.settingsEvents
  delete copy.account
  delete copy.staff
  delete copy.staffEvents
  delete copy.notifications
  delete copy.notificationsCheckedAt
  const finance = copy.finance as Record<string, unknown>
  const rule = db.finance.rules[0]
  delete finance.rules
  Object.assign(finance, { graceDays: rule?.graceDays, lateFee: rule?.lateFee })
  copy.version = 5
  return copy
}
const backupOf = (data: string, savedDataVersion: number | null, overrides: Partial<WorkspaceBackup> = {}) =>
  serializeBackup({ ...createBackup(NOW), data, savedDataVersion, ...overrides })


/** Saved v4 data whose upgrade fails on load: the session becomes read-only. */
function suspendSession() {
  const v4 = structuredClone(readDatabase()) as unknown as Record<string, unknown>
  for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance', 'appSettings', 'settingsEvents']) delete v4[key]
  v4.version = 4
  v4.sequences = { request: readDatabase().sequences.request }
  resetDemoData()
  window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(v4))
  migrationHooks.beforeCommit = () => {
    throw new Error('simulated upgrade failure')
  }
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  readDatabase()
  migrationHooks.beforeCommit = () => undefined
  expect(isPersistenceSuspended()).toBe(true)
}

describe('restore from backup', () => {
  it('brings back a v6 backup exactly and saves it', async () => {
    await addUserWork()
    const original = structuredClone(readDatabase())
    const text = serializeBackup(createBackup(NOW))
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, serializeDatabase(readDatabase()))
    const result = await restoreBackup(text)
    expect(result.restoredFromVersion).toBe(SCHEMA_VERSION)
    expect(readDatabase()).toEqual(original)
    expect(parseStoredDatabase(stored() ?? '')).toEqual(original)
    expect(result.counts).toEqual(countWorkspaceRecords(original))
    expect(readDatabase().finance.currency).toBe('EUR')
    // Device preferences stay as they are in this browser.
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe('true')
  })

  it('upgrades a v0.8.0 (v5) backup through the normal chain, keeping every record', async () => {
    await addUserWork()
    const original = structuredClone(readDatabase())
    const v5 = asV5(original)
    const text = backupOf(serializeDatabase(v5 as unknown as DemoDatabase), 5, { appVersion: '0.8.0' })
    resetDemoData()
    const result = await restoreBackup(text)
    expect(result.restoredFromVersion).toBe(5)
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    for (const key of ['properties', 'units', 'tenants', 'leases', 'vendors', 'serviceRequests', 'workOrders', 'charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents'] as const) {
      expect(db[key]).toEqual(original[key])
    }
    expect(db.finance.rules).toHaveLength(1)
    expect(checkFinanceIntegrity(db)).toEqual([])
  })

  it('upgrades a v0.7 (v4) backup', async () => {
    const v4 = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance', 'appSettings', 'settingsEvents']) delete v4[key]
    v4.version = 4
    v4.sequences = { request: readDatabase().sequences.request }
    await restoreBackup(backupOf(JSON.stringify(v4), 4, { appVersion: '0.7.0' }))
    expect(readDatabase().version).toBe(SCHEMA_VERSION)
    expect(readDatabase().charges.length).toBeGreaterThan(1000)
  })

  it('refuses an invalid file and leaves the workspace untouched', async () => {
    await addUserWork()
    const before = snapshot()
    const good = createBackup(NOW)
    for (const text of [
      'not json',
      JSON.stringify({ hello: 'world' }),
      JSON.stringify({ ...good, app: 'other' }),
      JSON.stringify({ ...good, format: 99 }),
      JSON.stringify({ ...good, appVersion: undefined }),
      JSON.stringify({ ...good, appVersion: 'latest' }),
      JSON.stringify({ ...good, exportedAt: 'yesterday' }),
      JSON.stringify({ ...good, savedDataVersion: 3 }),
      JSON.stringify({ ...good, data: '{broken' }),
      JSON.stringify({ ...good, data: JSON.stringify({ version: SCHEMA_VERSION + 1 }) }),
    ]) {
      const error = await failure(restoreBackup(text))
      expect(error).toBeInstanceOf(WorkspaceChangeError)
      expectUnchanged(before)
    }
  })

  it('refuses data that fails the Finance integrity check', async () => {
    await addUserWork()
    const before = snapshot()
    const db = structuredClone(readDatabase())
    ;(db.payments[0] as DemoDatabase['payments'][number]).chargeId = 'chg_missing'
    const error = await failure(restoreBackup(backupOf(serializeDatabase(db), SCHEMA_VERSION)))
    expect(error instanceof Error && error.message).toMatch(/integrity/)
    expectUnchanged(before)
  })

  it('refuses a backup too large for this browser', async () => {
    await addUserWork()
    const text = serializeBackup(createBackup(NOW))
    const before = snapshot()
    storageHooks.limitChars = 10_000
    expect(await failure(restoreBackup(text))).toBeInstanceOf(WorkspaceChangeError)
    expectUnchanged(before)
  })

  it('leaves the workspace unchanged when saving fails (storage refuses the write)', async () => {
    const text = serializeBackup(createBackup(NOW))
    await addUserWork()
    const before = snapshot()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const error = await failure(restoreBackup(text))
    expect(isStorageError(error) && error.code).toBe('write-failed')
    vi.restoreAllMocks()
    expectUnchanged(before)
    expect(getStorageStatus().lastError?.code).toBe('write-failed')
  })

  it('leaves the workspace unchanged when the final commit step fails', async () => {
    const text = serializeBackup(createBackup(NOW))
    await addUserWork()
    const before = snapshot()
    // v6 data isn't migrated, so the only commit step is the replacement itself.
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated failure while replacing')
    }
    expect(await failure(restoreBackup(text))).toBeInstanceOf(Error)
    expectUnchanged(before)
  })

  it('warns about, but accepts, a backup made by a newer app version with a supported format', () => {
    const text = backupOf(serializeDatabase(readDatabase()), SCHEMA_VERSION, { appVersion: '9.0.0' })
    const inspection = inspectBackup(text)
    expect(inspection.restorable).toBe(true)
    expect(inspection.warnings).toEqual([expect.stringMatching(/newer than this version/)])
  })

  it('is the way out of a read-only session', async () => {
    const good = serializeBackup({ ...createBackup(NOW), data: serializeDatabase(readDatabase()), savedDataVersion: SCHEMA_VERSION })
    suspendSession()
    const suspendedRaw = stored()
    await restoreBackup(good)
    expect(isPersistenceSuspended()).toBe(false)
    expect(stored()).not.toBe(suspendedRaw)
    expect(parseStoredDatabase(stored() ?? '')).toEqual(readDatabase())
  })
})

describe('full workspace reset', () => {
  it('deletes every record, saves the sample workspace and keeps device preferences', async () => {
    await addUserWork()
    expect(totalOf(countWorkspaceRecords(readDatabase()).user)).toBeGreaterThan(0)
    const result = await resetWorkspaceData()
    const db = readDatabase()
    expect(totalOf(result.counts.user)).toBe(0)
    expect(db.properties.some((property) => property.name === 'Restore Test Plaza')).toBe(false)
    expect(db.finance.currency).toBe('USD')
    expect(db.settingsEvents).toEqual([])
    expect(stored()).not.toBeNull()
    expect(parseStoredDatabase(stored() ?? '')).toEqual(db)
    expect(checkFinanceIntegrity(db)).toEqual([])
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
    expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe('true')
  })

  it('changes nothing when the reset can’t be saved', async () => {
    await addUserWork()
    const before = snapshot()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const error = await failure(resetWorkspaceData())
    expect(isStorageError(error) && error.code).toBe('write-failed')
    vi.restoreAllMocks()
    expectUnchanged(before)
  })

  it('changes nothing when the reset fails before saving', async () => {
    await addUserWork()
    const before = snapshot()
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated failure')
    }
    expect(await failure(resetWorkspaceData())).toBeInstanceOf(Error)
    expectUnchanged(before)
  })

  it('works in a read-only session, replacing data that couldn’t be upgraded', async () => {
    suspendSession()
    await resetWorkspaceData()
    expect(isPersistenceSuspended()).toBe(false)
    expect(savedVersion()).toBe(SCHEMA_VERSION)
  })
})

const savedVersion = () => (JSON.parse(stored() ?? '{}') as { version?: number }).version
