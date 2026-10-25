import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { createProperty, recordPayment } from '@/data/services'
import {
  backupFileName,
  BACKUP_FORMAT,
  countWorkspaceRecords,
  createBackup,
  getWorkspaceSummary,
  inspectBackup,
  prepareBackupDownload,
  RECORD_TYPES,
  serializeBackup,
  totalOf,
  type WorkspaceBackup,
} from '@/data/services/backup-service'
import {
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
import { APP_VERSION } from '@/lib/app-version'
import { STORAGE_KEYS } from '@/lib/storage'
import packageJson from '../../../package.json'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
  window.localStorage.removeItem(STORAGE_KEYS.theme)
  window.localStorage.removeItem(STORAGE_KEYS.sidebarCollapsed)
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  storageHooks.limitChars = STORAGE_LIMIT_CHARS
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)

/** Some user work: a property and a payment. */
async function addUserWork() {
  await createProperty({
    name: 'Backup Test Plaza',
    type: 'residential',
    status: 'stable',
    street: '1 Test Street',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    totalUnits: 4,
    description: '',
    yearBuilt: null,
    areaSqft: null,
  })
  const db = readDatabase()
  const payments = paymentsByCharge(db.payments)
  const charge = db.charges.find(
    (entry) => entry.category === 'rent' && entry.dueDate <= TODAY && !entry.voidedAt && chargeState(entry, payments.get(entry.id), TODAY, 5).balanceCents > 2500,
  ) as DemoDatabase['charges'][number]
  await recordPayment(charge.id, { amountCents: 2500, receivedOn: TODAY, method: 'cash' })
}

describe('backup export', () => {
  it('copies the stored data exactly, with separate app and saved-data versions', async () => {
    await addUserWork()
    window.localStorage.setItem(STORAGE_KEYS.theme, 'dark')
    const backup = createBackup(NOW)
    expect(backup).toMatchObject({
      app: 'propwise',
      kind: 'workspace-backup',
      format: BACKUP_FORMAT,
      exportedAt: NOW.toISOString(),
      appVersion: packageJson.version,
      savedDataVersion: SCHEMA_VERSION,
      source: 'saved',
      preferences: { theme: 'dark', sidebarCollapsed: null },
    })
    expect(backup.appVersion).toBe(APP_VERSION)
    expect(backup.data).toBe(stored())
  })

  it('exports the sample workspace when nothing has been saved yet', () => {
    expect(stored()).toBeNull()
    const backup = createBackup(NOW)
    expect(backup.source).toBe('sample')
    expect(parseStoredDatabase(backup.data)).toEqual(readDatabase())
    expect(stored()).toBeNull() // exporting never writes
  })

  it('records the saved-data version of older data as it is (e.g. 5) and still copies it', () => {
    const v5 = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    delete v5.appSettings
    delete v5.settingsEvents
    delete v5.account
    delete v5.staff
    delete v5.staffEvents
    delete v5.notifications
    delete v5.notificationsCheckedAt
    const finance = v5.finance as Record<string, unknown>
    delete finance.rules
    Object.assign(finance, { graceDays: 5, lateFee: { residentialCents: 5000, commercialPercent: 5 } })
    v5.version = 5
    resetDemoData()
    const raw = serializeDatabase(v5 as unknown as DemoDatabase)
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    const backup = createBackup(NOW)
    expect(backup.savedDataVersion).toBe(5)
    expect(backup.data).toBe(raw)
  })

  it('backs up data that couldn’t be upgraded, unchanged, while the session is read-only', () => {
    window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify({ version: 4, properties: 'broken' }))
    const raw = stored()
    readDatabase()
    const backup = createBackup(NOW)
    expect(backup.data).toBe(raw)
    expect(backup.savedDataVersion).toBeNull()
  })

  it('names the file by local date and time and produces pretty JSON', () => {
    const { fileName, contents, backup } = prepareBackupDownload(new Date('2026-03-05T09:07:00'))
    expect(fileName).toBe('propwise-backup-2026-03-05-0907.json')
    expect(backupFileName(backup)).toBe(fileName)
    expect(contents).toBe(serializeBackup(backup))
    expect(contents.endsWith('\n')).toBe(true)
    expect(JSON.parse(contents)).toEqual(backup)
  })
})

describe('backup inspection (independent of the download)', () => {
  it('round-trips: a fresh backup is restorable with the same counts and settings', async () => {
    await addUserWork()
    const db = readDatabase()
    const text = serializeBackup(createBackup(NOW))
    const raw = stored()
    const result = inspectBackup(text)
    expect(result).toMatchObject({
      restorable: true,
      problems: [],
      appVersion: APP_VERSION,
      savedDataVersion: SCHEMA_VERSION,
      needsUpgrade: false,
      counts: countWorkspaceRecords(db),
      settings: { currency: 'USD', locale: 'en-US', ruleVersions: 1 },
    })
    expect(result.restoredChars).toBe((raw ?? '').length + STORAGE_KEYS.demoData.length)
    // Inspection never touches the workspace.
    expect(stored()).toBe(raw)
    expect(readDatabase()).toBe(db)
  })

  it('accepts an older saved-data version and reports that it will be upgraded', () => {
    const v4 = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance', 'appSettings', 'settingsEvents']) delete v4[key]
    v4.version = 4
    v4.sequences = { request: readDatabase().sequences.request }
    const backup: WorkspaceBackup = { ...createBackup(NOW), data: JSON.stringify(v4), savedDataVersion: 4 }
    const result = inspectBackup(serializeBackup(backup))
    expect(result).toMatchObject({ restorable: true, savedDataVersion: 4, needsUpgrade: true })
    expect(result.counts && totalOf(result.counts.user)).toBe(0)
  })

  const base = () => createBackup(NOW)
  const problemFor = (text: string) => {
    const before = stored()
    const result = inspectBackup(text)
    expect(stored()).toBe(before)
    expect(result.restorable).toBe(false)
    expect(result.counts).toBeNull()
    return result.problems
  }

  it('explains why a file can’t be restored', () => {
    expect(problemFor('not json')).toEqual([expect.stringMatching(/isn’t valid JSON/)])
    expect(problemFor(JSON.stringify({ hello: 'world' }))).toEqual([expect.stringMatching(/isn’t a Propwise backup/)])
    expect(problemFor(JSON.stringify([1, 2]))).toEqual([expect.stringMatching(/isn’t a Propwise backup/)])
    expect(problemFor(JSON.stringify({ ...base(), app: 'other' }))).toEqual([expect.stringMatching(/isn’t a Propwise backup/)])
    expect(problemFor(JSON.stringify({ ...base(), format: BACKUP_FORMAT + 1 }))).toEqual([expect.stringMatching(/newer version of Propwise/)])
    expect(problemFor(JSON.stringify({ ...base(), data: 42 }))).toEqual([expect.stringMatching(/incomplete or damaged/)])
    expect(problemFor(JSON.stringify({ ...base(), data: '{broken' }))).toEqual([expect.stringMatching(/unreadable/)])
    expect(problemFor(JSON.stringify({ ...base(), data: JSON.stringify({ version: SCHEMA_VERSION + 1 }) }))).toEqual([expect.stringMatching(/newer version/)])
    expect(problemFor(JSON.stringify({ ...base(), data: JSON.stringify({ version: 3, nothing: true }) }))).toEqual([expect.stringMatching(/format Propwise knows/)])
  })

  it('rejects data that fails the Finance integrity check', () => {
    const db = structuredClone(readDatabase())
    const payment = db.payments[0] as DemoDatabase['payments'][number]
    payment.chargeId = 'chg_missing'
    expect(problemFor(JSON.stringify({ ...base(), data: serializeDatabase(db) }))).toEqual([expect.stringMatching(/integrity check/)])
  })

  it('rejects data whose upgrade fails', () => {
    const db = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    const finance = db.finance as Record<string, unknown>
    delete finance.rules
    Object.assign(finance, { graceDays: -1, lateFee: { residentialCents: 5000, commercialPercent: 5 } })
    delete db.appSettings
    delete db.settingsEvents
    delete db.account
    delete db.staff
    delete db.staffEvents
    delete db.notifications
    delete db.notificationsCheckedAt
    db.version = 5
    expect(problemFor(JSON.stringify({ ...base(), savedDataVersion: 5, data: serializeDatabase(db as unknown as DemoDatabase) }))).toEqual([expect.stringMatching(/couldn’t be upgraded/)])
  })

  it('rejects a backup too large for this browser’s storage', () => {
    const text = serializeBackup(base())
    storageHooks.limitChars = 1000
    expect(problemFor(text)).toEqual([expect.stringMatching(/too large/)])
  })
})

describe('sample vs user-created counts', () => {
  it('counts the sample workspace as sample only', async () => {
    const summary = await getWorkspaceSummary()
    expect(summary.counts && totalOf(summary.counts.user)).toBe(0)
    expect(summary.counts?.sample.properties).toBe(readDatabase().properties.length)
    expect(summary.suspended).toBe(false)
    for (const type of RECORD_TYPES) expect((summary.counts?.sample[type] ?? -1) + (summary.counts?.user[type] ?? -1)).toBeGreaterThanOrEqual(0)
  })

  it('counts records created in the app as user records; edited sample records stay sample', async () => {
    const before = countWorkspaceRecords(readDatabase())
    await addUserWork()
    const after = countWorkspaceRecords(readDatabase())
    expect(after.user.payments).toBe(before.user.payments + 1)
    expect(after.user.properties).toBe(before.user.properties + 1)
    expect(after.sample.properties).toBe(before.sample.properties)
    // Every record is counted exactly once.
    const db = readDatabase()
    expect(after.sample.charges + after.user.charges).toBe(db.charges.length)
    expect(after.sample.workOrders + after.user.workOrders).toBe(db.workOrders.length)
    expect(after.sample.maintenanceRequests + after.user.maintenanceRequests).toBe(db.serviceRequests.length)
  })
})
