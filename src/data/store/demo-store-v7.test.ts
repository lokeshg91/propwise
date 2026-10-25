import { accountProblems, defaultAccount } from '@/data/domain/account-rules'
import { createProperty, getCurrentUser, recordPayment, updateProfile } from '@/data/services'
import {
  getStorageStatus,
  isPersistenceSuspended,
  isStorageError,
  migrateDatabase,
  migrationHooks,
  parseStoredDatabase,
  readDatabase,
  resetDemoData,
  savedDataVersion,
  SCHEMA_VERSION,
  serializeDatabase,
  type DemoDatabase,
  type DemoDatabaseV6,
} from '@/data/store/demo-store'
import { assertCarriedOver } from '@/data/store/account-upgrade'
import { checkFinanceIntegrity } from '@/data/store/finance-integrity'
import { STORAGE_KEYS } from '@/lib/storage'

/**
 * Phase 10.3: the v6 → v7 upgrade. v6 is what v0.9.0 saves; v7 adds the
 * signed-in user's account (profile and notification preferences). The
 * upgrade is additive: every v6 field is kept byte for byte, and the
 * account starts as the sample profile the header has always shown.
 */

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  migrationHooks.beforeCommit = () => undefined
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)

/** v0.9.0's shape of a workspace: no account. */
function toV6(db: DemoDatabase): DemoDatabaseV6 {
  const copy = structuredClone(db) as unknown as Record<string, unknown>
  delete copy.account
  delete copy.staff
  delete copy.staffEvents
  delete copy.notifications
  delete copy.notificationsCheckedAt
  copy.version = 6
  return copy as unknown as DemoDatabaseV6
}

const storeV6 = (v6: DemoDatabaseV6) => window.localStorage.setItem(STORAGE_KEYS.demoData, serializeDatabase(v6 as unknown as DemoDatabase))

/** A v6 workspace with work the user did in the app. */
async function userV6(): Promise<DemoDatabaseV6> {
  await createProperty({
    name: 'Upgrade Test House',
    type: 'residential',
    status: 'stable',
    street: '1 Test Way',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    totalUnits: 2,
    description: '',
    yearBuilt: null,
    areaSqft: null,
  })
  const db = readDatabase()
  const paid = new Set(db.payments.map((payment) => payment.chargeId))
  const charge = db.charges.find((entry) => entry.dueDate <= TODAY && !entry.voidedAt && !paid.has(entry.id) && entry.amountCents > 1234) as DemoDatabase['charges'][number]
  await recordPayment(charge.id, { amountCents: 1234, receivedOn: TODAY, method: 'cash' })
  const v6 = toV6(readDatabase())
  expect(v6.properties.some((property) => property.name === 'Upgrade Test House')).toBe(true)
  resetDemoData()
  return v6
}

describe('fresh installation (v7)', () => {
  it('starts with the sample profile the header has always shown, and saves nothing until a change', async () => {
    const db = readDatabase()
    expect(db.version).toBe(SCHEMA_VERSION)
    expect(SCHEMA_VERSION).toBe(7)
    expect(db.account).toEqual(defaultAccount())
    expect(db.account.profile).toMatchObject({ id: 'usr_1001', name: 'Alex Morgan', email: 'alex.morgan@example.com', jobTitle: 'Portfolio Manager', avatar: null })
    expect(Object.values(db.account.notificationPreferences).every(Boolean)).toBe(true)
    expect(accountProblems(db.account)).toEqual([])
    expect(await getCurrentUser()).toEqual({ id: 'usr_1001', name: 'Alex Morgan', email: 'alex.morgan@example.com', role: 'Portfolio Manager' })
    expect(stored()).toBeNull()
  })

  it('never stores a password or token field', () => {
    const text = JSON.stringify(readDatabase().account).toLowerCase()
    expect(text).not.toMatch(/password|token|secret/)
  })
})

describe('v6 → v7 upgrade', () => {
  it('keeps every v6 field byte for byte and only adds the account', async () => {
    const v6 = await userV6()
    const v7 = migrateDatabase(structuredClone(v6), NOW)
    expect(v7.version).toBe(7)
    for (const key of Object.keys(v6) as Array<keyof DemoDatabaseV6>) {
      if (key === 'version') continue
      expect(JSON.stringify(v7[key]), key).toBe(JSON.stringify(v6[key]))
    }
    expect(Object.keys(v7).sort()).toEqual([...Object.keys(v6), 'account', 'staff', 'staffEvents', 'notifications', 'notificationsCheckedAt'].sort())
    expect(v7.account).toEqual(defaultAccount())
    expect(checkFinanceIntegrity(v7)).toEqual([])
  })

  it('saves once in column format when stored v6 data is loaded, and reloads without upgrading again', async () => {
    storeV6(await userV6())
    const first = readDatabase()
    const raw = stored() ?? ''
    expect(JSON.parse(raw)).toMatchObject({ version: 7, encoding: 'columns-1' })
    expect(savedDataVersion(parseStoredDatabase(raw))).toBe(7)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(readDatabase()).toEqual(first)
    expect(stored()).toBe(raw)
  })

  it('is idempotent and deterministic', async () => {
    const v6 = await userV6()
    const once = migrateDatabase(structuredClone(v6), NOW)
    expect(migrateDatabase(structuredClone(once), NOW)).toEqual(once)
    // Only the time notifications start from follows the moment of the upgrade.
    const later = migrateDatabase(structuredClone(v6), new Date('2027-02-28T09:00:00'))
    expect({ ...later, notificationsCheckedAt: once.notificationsCheckedAt }).toEqual(once)
    expect(later.notificationsCheckedAt).toBe(new Date('2027-02-28T09:00:00').toISOString())
  })

  it('rolls back on failure: stored v6 data untouched and the session read-only with the sample profile', async () => {
    storeV6(await userV6())
    const before = stored()
    migrationHooks.beforeCommit = () => {
      throw new Error('simulated failure')
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readDatabase().account).toEqual(defaultAccount())
    expect(stored()).toBe(before)
    expect(isPersistenceSuspended()).toBe(true)
    expect(getStorageStatus().mode).toBe('suspended')
    const error = await updateProfile({ name: 'Sam Lee', email: 'sam@example.com', phone: '', jobTitle: 'Owner', avatar: null }).then(
      () => null,
      (reason: unknown) => reason,
    )
    expect(isStorageError(error) && error.code).toBe('suspended')
    expect(stored()).toBe(before)

    migrationHooks.beforeCommit = () => undefined
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, before ?? '')
    expect(readDatabase().version).toBe(7)
    expect(isPersistenceSuspended()).toBe(false)
  })

  it('refuses an upgrade that would change existing data', () => {
    const v6 = toV6(readDatabase())
    const changed = { ...structuredClone(v6), properties: [] }
    expect(() => assertCarriedOver(v6 as unknown as Record<string, unknown>, changed as unknown as Record<string, unknown>)).toThrow(/properties/)
  })

  it('chains v1 → v7 and v5 → v7 with the sample profile', () => {
    const db = readDatabase()
    const v1 = { version: 1, properties: structuredClone(db.properties), units: structuredClone(db.units), events: [] }
    const fromV1 = migrateDatabase(v1 as Parameters<typeof migrateDatabase>[0], NOW)
    expect(fromV1.version).toBe(7)
    expect(fromV1.account).toEqual(defaultAccount())
    expect(checkFinanceIntegrity(fromV1)).toEqual([])

    const v5 = structuredClone(db) as unknown as Record<string, unknown>
    const finance = v5.finance as Record<string, unknown>
    const rule = db.finance.rules[0]
    delete finance.rules
    Object.assign(finance, { graceDays: rule?.graceDays, lateFee: rule?.lateFee })
    delete v5.appSettings
    delete v5.settingsEvents
    delete v5.account
    delete v5.staff
    delete v5.staffEvents
    delete v5.notifications
    delete v5.notificationsCheckedAt
    v5.version = 5
    const fromV5 = migrateDatabase(v5 as unknown as Parameters<typeof migrateDatabase>[0], NOW)
    expect(fromV5.version).toBe(7)
    expect(fromV5.account).toEqual(defaultAccount())
  })
})

describe('current (v7) data', () => {
  it('keeps a saved profile across reloads', async () => {
    await updateProfile({ name: 'Sam Lee', email: 'sam.lee@example.com', phone: '+1 512 555 0134', jobTitle: 'Owner', avatar: null })
    const raw = stored() ?? ''
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(readDatabase().account.profile).toMatchObject({ name: 'Sam Lee', email: 'sam.lee@example.com', phone: '+1 512 555 0134', jobTitle: 'Owner' })
  })

  it('refuses current data with an invalid account when it is checked (backups), without changing it', () => {
    const db = structuredClone(readDatabase())
    db.account.profile.avatar = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4='
    expect(() => migrateDatabase(structuredClone(db), NOW)).toThrow(/account profile is invalid/)
    const noAccount = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    delete noAccount.account
    delete noAccount.staff
    delete noAccount.staffEvents
    delete noAccount.notifications
    delete noAccount.notificationsCheckedAt
    expect(savedDataVersion(noAccount)).toBe(7)
    expect(() => migrateDatabase(noAccount as unknown as DemoDatabase, NOW)).toThrow(/account profile is invalid/)
  })

  it('loads saved data with a damaged profile using defaults for the unreadable fields; records and storage stay as they are', async () => {
    await updateProfile({ name: 'Sam Lee', email: 'sam.lee@example.com', phone: '', jobTitle: 'Owner', avatar: null })
    const db = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    const account = db.account as { profile: Record<string, unknown>; notificationPreferences: unknown }
    account.profile.email = 'not an email'
    account.profile.avatar = 'javascript:alert(1)'
    account.notificationPreferences = 'all'
    const raw = serializeDatabase(db as unknown as DemoDatabase)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const loaded = readDatabase()
    expect(loaded.account.profile).toMatchObject({ name: 'Sam Lee', jobTitle: 'Owner', email: 'alex.morgan@example.com', avatar: null })
    expect(Object.values(loaded.account.notificationPreferences).every(Boolean)).toBe(true)
    expect(loaded.properties).toEqual((db as unknown as DemoDatabase).properties)
    expect(stored()).toBe(raw)
    expect(isPersistenceSuspended()).toBe(false)
  })
})
