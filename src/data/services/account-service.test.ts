import { accountProblems, AVATAR_MAX_CHARS, defaultAccount, profileFieldProblems, repairAccount } from '@/data/domain/account-rules'
import {
  getAccount,
  getCurrentUser,
  isServiceError,
  readCurrentUser,
  updateNotificationPreferences,
  updateProfile,
  type ProfileInput,
} from '@/data/services'
import { createBackup, inspectBackup, resetWorkspaceData, restoreBackup, serializeBackup } from '@/data/services/backup-service'
import {
  getStorageStatus,
  isStorageError,
  peekDatabase,
  readDatabase,
  resetDemoData,
  serializeDatabase,
  STORAGE_LIMIT_CHARS,
  storageHooks,
  type DemoDatabase,
} from '@/data/store/demo-store'
import { signOut } from '@/lib/session'
import { STORAGE_KEYS } from '@/lib/storage'

/** Phase 10.3: the signed-in user's profile and notification preferences. */

const PHOTO = `data:image/jpeg;base64,${'A'.repeat(2000)}`
const SAM: ProfileInput = { name: '  Sam Lee ', email: ' sam.lee@example.com ', phone: '(512) 555-0134', jobTitle: 'Owner', avatar: PHOTO }

beforeEach(() => resetDemoData())
afterEach(() => {
  storageHooks.limitChars = STORAGE_LIMIT_CHARS
  vi.restoreAllMocks()
})

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

describe('account rules', () => {
  it('accepts the sample profile and reports field problems in form order', () => {
    expect(accountProblems(defaultAccount())).toEqual([])
    expect(profileFieldProblems({ name: ' ', email: 'nope', phone: '12', jobTitle: '' }).map((problem) => problem.field)).toEqual(['name', 'email', 'phone', 'jobTitle'])
    expect(profileFieldProblems({ name: 'Sam Lee', email: 'sam@example.com', phone: '', jobTitle: 'Owner' })).toEqual([])
    expect(profileFieldProblems({ name: 'Sam Lee', email: 'sam@example.com', phone: '+44 20 7946 0958', jobTitle: 'Owner' })).toEqual([])
    expect(profileFieldProblems({ name: 'x'.repeat(81), email: 'sam@example.com', phone: '', jobTitle: 'Owner' })[0]?.field).toBe('name')
    expect(profileFieldProblems({ name: 'Sam\nLee', email: 'sam@example.com', phone: '', jobTitle: 'Owner' })[0]?.field).toBe('name')
  })

  it('accepts only small JPEG, PNG or WebP photos as data URLs', () => {
    const withAvatar = (avatar: unknown) => ({ ...defaultAccount(), profile: { ...defaultAccount().profile, avatar } })
    expect(accountProblems(withAvatar(PHOTO))).toEqual([])
    expect(accountProblems(withAvatar('data:image/png;base64,iVBORw0KGgo='))).toEqual([])
    for (const bad of ['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'https://example.com/me.jpg', 'javascript:alert(1)', 'data:image/jpeg;base64,<script>', `data:image/jpeg;base64,${'A'.repeat(AVATAR_MAX_CHARS)}`, 42]) {
      expect(accountProblems(withAvatar(bad)), String(bad).slice(0, 40)).toEqual([expect.stringMatching(/photo/)])
    }
  })

  it('repairs only the unreadable parts of stored account data', () => {
    const damaged = { profile: { id: 'usr_1001', name: 'Sam Lee', email: 'bad', phone: 7, jobTitle: 'Owner', avatar: 'x', updatedAt: 'never' }, notificationPreferences: { maintenance: false, payment: 'yes' } }
    const repaired = repairAccount(damaged)
    expect(accountProblems(repaired)).toEqual([])
    expect(repaired.profile).toMatchObject({ name: 'Sam Lee', jobTitle: 'Owner', email: 'alex.morgan@example.com', phone: '', avatar: null, updatedAt: null })
    expect(repaired.notificationPreferences).toEqual({ maintenance: false, payment: true, lease: true, tenant: true, system: true })
    expect(repairAccount(null)).toEqual(defaultAccount())
  })
})

describe('profile', () => {
  it('saves trimmed values, shows them as the current user and keeps them after a reload', async () => {
    const saved = await updateProfile(SAM)
    expect(saved.profile).toMatchObject({ id: 'usr_1001', name: 'Sam Lee', email: 'sam.lee@example.com', phone: '(512) 555-0134', jobTitle: 'Owner', avatar: PHOTO })
    expect(saved.profile.updatedAt).not.toBeNull()
    expect(await getCurrentUser()).toEqual({ id: 'usr_1001', name: 'Sam Lee', email: 'sam.lee@example.com', role: 'Owner', avatarUrl: PHOTO })
    expect(readCurrentUser()).toBe(readCurrentUser())
    const raw = stored()
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    expect((await getAccount()).profile.name).toBe('Sam Lee')
  })

  it('doesn’t write anything when nothing changed', async () => {
    const before = stored()
    const { profile } = defaultAccount()
    await updateProfile({ name: profile.name, email: profile.email, phone: '', jobTitle: profile.jobTitle, avatar: null })
    expect(stored()).toBe(before)
  })

  it('rejects invalid values with the field to fix, saving nothing', async () => {
    const cases: Array<[Partial<ProfileInput>, string]> = [
      [{ name: '' }, 'name'],
      [{ email: 'sam@' }, 'email'],
      [{ phone: 'call me' }, 'phone'],
      [{ jobTitle: ' ' }, 'jobTitle'],
      [{ avatar: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, 'avatar'],
    ]
    for (const [change, field] of cases) {
      const error = await failure(updateProfile({ ...SAM, ...change }))
      expect(isServiceError(error) && error.field, field).toBe(field)
    }
    expect(stored()).toBeNull()
    expect(readDatabase().account).toEqual(defaultAccount())
  })

  it('changes nothing when the browser refuses the save', async () => {
    readDatabase()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const error = await failure(updateProfile(SAM))
    expect(isStorageError(error) && error.code).toBe('write-failed')
    vi.restoreAllMocks()
    expect(readDatabase().account).toEqual(defaultAccount())
    expect(readCurrentUser()?.name).toBe('Alex Morgan')
    expect(stored()).toBeNull()
  })

  it('refuses a photo that would take storage over the budget', async () => {
    readDatabase()
    storageHooks.limitChars = Math.ceil((serializeDatabase(readDatabase()).length + 1000) / 0.95)
    const error = await failure(updateProfile(SAM))
    expect(isStorageError(error) && error.code).toBe('over-budget')
    expect(readDatabase().account.profile.avatar).toBeNull()
  })

  it('removes a photo', async () => {
    await updateProfile(SAM)
    await updateProfile({ ...SAM, avatar: null })
    expect(readDatabase().account.profile.avatar).toBeNull()
    expect((await getCurrentUser()).avatarUrl).toBeUndefined()
  })

  it('keeps the default profile small, well under the storage warning level', async () => {
    readDatabase()
    await updateProfile(SAM)
    expect(getStorageStatus().level).toBe('ok')
    expect(JSON.stringify(readDatabase().account).length).toBeLessThan(5000)
  })
})

describe('notification preferences', () => {
  it('saves and reloads the categories that create notifications', async () => {
    const saved = await updateNotificationPreferences({ maintenance: false, payment: true, lease: false, tenant: true, system: true })
    expect(saved.notificationPreferences).toEqual({ maintenance: false, payment: true, lease: false, tenant: true, system: true })
    expect(saved.preferencesUpdatedAt).not.toBeNull()
    const raw = stored()
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw ?? '')
    expect(readDatabase().account.notificationPreferences.lease).toBe(false)
  })

  it('rejects incomplete preferences and writes nothing when unchanged', async () => {
    const error = await failure(updateNotificationPreferences({ maintenance: true } as never))
    expect(isServiceError(error)).toBe(true)
    await updateNotificationPreferences(defaultAccount().notificationPreferences)
    expect(stored()).toBeNull()
  })
})

describe('backup, restore and reset', () => {
  it('backs up and restores the profile, photo and preferences exactly', async () => {
    await updateProfile(SAM)
    await updateNotificationPreferences({ maintenance: false, payment: true, lease: true, tenant: true, system: false })
    const account = structuredClone(readDatabase().account)
    const text = serializeBackup(createBackup())
    expect(inspectBackup(text)).toMatchObject({ restorable: true, savedDataVersion: 7, needsUpgrade: false })
    await resetWorkspaceData()
    expect(readDatabase().account).toEqual(defaultAccount())
    await restoreBackup(text)
    expect(readDatabase().account).toEqual(account)
    expect(readCurrentUser()?.name).toBe('Sam Lee')
  })

  it('upgrades a v0.9.0 (v6) backup with the sample profile', async () => {
    const v6 = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    delete v6.account
    delete v6.staff
    delete v6.staffEvents
    delete v6.notifications
    delete v6.notificationsCheckedAt
    v6.version = 6
    const text = serializeBackup({ ...createBackup(), savedDataVersion: 6, appVersion: '0.9.0', data: serializeDatabase(v6 as unknown as DemoDatabase) })
    expect(inspectBackup(text)).toMatchObject({ restorable: true, savedDataVersion: 6, needsUpgrade: true })
    await updateProfile(SAM)
    await restoreBackup(text)
    expect(readDatabase().account).toEqual(defaultAccount())
  })

  it('refuses a backup whose account is damaged, changing nothing', async () => {
    await updateProfile(SAM)
    const before = stored()
    const db = structuredClone(readDatabase())
    db.account.profile.email = 'not-an-email'
    const text = serializeBackup({ ...createBackup(), data: serializeDatabase(db) })
    const inspection = inspectBackup(text)
    expect(inspection.restorable).toBe(false)
    expect(inspection.problems[0]).toMatch(/account profile is invalid/)
    expect(await failure(restoreBackup(text))).toBeInstanceOf(Error)
    expect(stored()).toBe(before)
  })

  it('reset restores the sample profile and keeps the signed-out state, theme and sidebar keys', async () => {
    await updateProfile(SAM)
    window.localStorage.setItem(STORAGE_KEYS.theme, 'dark')
    signOut()
    const session = window.localStorage.getItem(STORAGE_KEYS.session)
    await resetWorkspaceData()
    expect(readDatabase().account).toEqual(defaultAccount())
    expect(peekDatabase()?.account.profile.name).toBe('Alex Morgan')
    expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBe(session)
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
  })
})
