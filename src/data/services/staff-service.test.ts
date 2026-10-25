import { defaultAccount } from '@/data/domain/account-rules'
import { deactivationBlock, emailOwner, roleChangeBlock, staffFieldProblems, staffProblems } from '@/data/domain/staff-rules'
import {
  createStaff,
  deleteStaff,
  getCurrentUser,
  getStaffDetail,
  getStaffList,
  isServiceError,
  readCurrentUser,
  setStaffActive,
  updateProfile,
  updateStaff,
} from '@/data/services'
import { countWorkspaceRecords, createBackup, inspectBackup, resetWorkspaceData, restoreBackup, serializeBackup } from '@/data/services/backup-service'
import { SELF_STAFF_ID } from '@/data/mock/staff-seed'
import { migrateDatabase, readDatabase, resetDemoData, serializeDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type StaffInput, type StaffMember } from '@/types'

/** Phase 10.4: the team directory, its rules and how it fits the account, backups and the v7 upgrade. */

beforeEach(() => resetDemoData())
afterEach(() => vi.restoreAllMocks())

const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )
const SAM: StaffInput = { name: 'Sam Rivera', email: 'sam.rivera@example.com', phone: '(512) 555-0100', jobTitle: 'Leasing Agent', role: 'leasing', propertyIds: ['prop_102', 'prop_101'] }
const member = (id: string) => readDatabase().staff.find((entry) => entry.id === id) as StaffMember

describe('sample team', () => {
  it('starts with you as the Owner (from your profile) and a fictional team, all flagged demo', async () => {
    const db = readDatabase()
    expect(db.staff).toHaveLength(9)
    expect(db.staff.every((entry) => entry.demo)).toBe(true)
    const self = member(SELF_STAFF_ID)
    expect(self).toMatchObject({ userId: 'usr_1001', name: 'Alex Morgan', email: 'alex.morgan@example.com', jobTitle: 'Portfolio Manager', role: 'owner', active: true })
    expect(db.staff.filter((entry) => !entry.active).map((entry) => entry.name)).toEqual(['Marcus Reed'])
    expect(staffProblems(db.staff, db.staffEvents, db.account.profile.id)).toEqual([])
    const list = await getStaffList()
    expect(list.filter((item) => item.isSelf).map((item) => item.member.id)).toEqual([SELF_STAFF_ID])
    expect(stored()).toBeNull()
  })

  it('is deterministic: the same team on any day, from a fresh install or an upgrade', () => {
    const fresh = structuredClone(readDatabase())
    const v6 = structuredClone(fresh) as unknown as Record<string, unknown>
    for (const key of ['account', 'staff', 'staffEvents', 'notifications', 'notificationsCheckedAt']) delete v6[key]
    v6.version = 6
    const upgraded = migrateDatabase(v6 as unknown as DemoDatabase, new Date('2027-03-01T08:00:00'))
    expect(upgraded.staff).toEqual(fresh.staff)
    expect(upgraded.staffEvents).toEqual(fresh.staffEvents)
  })

  it('gives v7 data saved before the team existed the sample team, built from the saved profile', async () => {
    await updateProfile({ name: 'Riya Kapoor', email: 'riya@example.com', phone: '', jobTitle: 'Founder', avatar: null })
    const db = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    delete db.staff
    delete db.staffEvents
    delete db.notifications
    delete db.notificationsCheckedAt
    const raw = serializeDatabase(db as unknown as DemoDatabase)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    expect(member(SELF_STAFF_ID)).toMatchObject({ name: 'Riya Kapoor', email: 'riya@example.com', jobTitle: 'Founder' })
    expect(readDatabase().account.profile.name).toBe('Riya Kapoor')
    expect(stored()).not.toBe(raw)
  })
})

describe('rules', () => {
  it('validates fields with messages about the person, and only known properties', () => {
    expect(staffFieldProblems({ ...SAM, name: '' }).map((problem) => problem.message)).toEqual(['Enter the person’s name.'])
    expect(staffFieldProblems({ ...SAM, role: 'boss' as never })[0]?.field).toBe('role')
    expect(staffFieldProblems(SAM, new Set(['prop_101']))[0]?.field).toBe('propertyIds')
  })

  it('treats email addresses as the same regardless of case and spaces', () => {
    const staff = readDatabase().staff
    expect(emailOwner(staff, '  MARIA.Chen@Example.com ')?.name).toBe('Maria Chen')
    expect(emailOwner(staff, 'maria.chen@example.com', 'stf_1003')).toBeUndefined()
  })

  it('never lets you deactivate yourself or change your own role, and keeps one active Owner or Admin', () => {
    const staff = structuredClone(readDatabase().staff)
    const self = staff.find((entry) => entry.userId !== null) as StaffMember
    const jordan = staff.find((entry) => entry.id === 'stf_1002') as StaffMember
    expect(deactivationBlock(staff, self)).toMatch(/your own account/)
    expect(roleChangeBlock(staff, self, 'admin')).toMatch(/your own role/)
    expect(deactivationBlock(staff, jordan)).toBeNull()
    // Only Jordan can manage the team: they can't be deactivated or demoted.
    self.role = 'leasing'
    expect(deactivationBlock(staff, jordan)).toMatch(/only active Owner or Admin/)
    expect(roleChangeBlock(staff, jordan, 'accounting')).toMatch(/only active Owner or Admin/)
    expect(roleChangeBlock(staff, jordan, 'owner')).toBeNull()
  })
})

describe('writes', () => {
  it('adds a member with assignments in property order, history and a non-demo flag', async () => {
    const created = await createStaff(SAM)
    expect(created).toMatchObject({ name: 'Sam Rivera', role: 'leasing', active: true, demo: false, userId: null, propertyIds: ['prop_101', 'prop_102'] })
    const detail = await getStaffDetail(created.id)
    expect(detail?.events.map((event) => event.kind)).toEqual(['created'])
    expect(detail?.properties.map((property) => property.id)).toEqual(['prop_101', 'prop_102'])
    expect(countWorkspaceRecords(readDatabase()).user.staff).toBe(1)
    expect(countWorkspaceRecords(readDatabase()).sample.staff).toBe(9)
  })

  it('refuses a duplicate email (any case), including your own, saving nothing', async () => {
    for (const email of ['MARIA.CHEN@example.com', ' alex.morgan@example.com ']) {
      const error = await failure(createStaff({ ...SAM, email }))
      expect(isServiceError(error) && error.field, email).toBe('email')
    }
    expect(stored()).toBeNull()
  })

  it('refuses invalid input and unknown properties with the field to fix', async () => {
    for (const [change, field] of [
      [{ name: ' ' }, 'name'],
      [{ email: 'sam@' }, 'email'],
      [{ phone: 'n/a' }, 'phone'],
      [{ jobTitle: '' }, 'jobTitle'],
      [{ role: 'boss' }, 'role'],
      [{ propertyIds: ['prop_999'] }, 'propertyIds'],
    ] as const) {
      const error = await failure(createStaff({ ...SAM, ...change } as StaffInput))
      expect(isServiceError(error) && error.field, field).toBe(field)
    }
    expect(stored()).toBeNull()
  })

  it('edits a member and records what changed, keeping the old name in earlier entries', async () => {
    await updateStaff('stf_1007', { ...SAM, name: 'Ethan W. Wright', email: 'ethan.wright@example.com', role: 'property-manager', propertyIds: ['prop_101'] })
    const detail = await getStaffDetail('stf_1007')
    expect(detail?.member).toMatchObject({ name: 'Ethan W. Wright', role: 'property-manager', propertyIds: ['prop_101'] })
    expect(detail?.events.map((event) => event.kind).sort()).toEqual(['properties-changed', 'role-changed', 'updated'])
    expect(detail?.events.find((event) => event.kind === 'role-changed')?.description).toBe('Leasing agent → Property manager.')
  })

  it('doesn’t write when nothing changed', async () => {
    const current = member('stf_1004')
    await updateStaff('stf_1004', { name: current.name, email: current.email, phone: current.phone, jobTitle: current.jobTitle, role: current.role, propertyIds: current.propertyIds })
    expect(stored()).toBeNull()
  })

  it('keeps your staff record and your profile the same, whichever one you edit', async () => {
    await updateStaff(SELF_STAFF_ID, { name: 'Alex M. Morgan', email: 'alex@example.com', phone: '(512) 555-0101', jobTitle: 'Managing Director', role: 'owner', propertyIds: ['prop_101'] })
    expect(readDatabase().account.profile).toMatchObject({ name: 'Alex M. Morgan', email: 'alex@example.com', phone: '(512) 555-0101', jobTitle: 'Managing Director' })
    expect(readCurrentUser()?.name).toBe('Alex M. Morgan')
    await updateProfile({ name: 'Alex Morgan', email: 'alex.morgan@example.com', phone: '', jobTitle: 'Portfolio Manager', avatar: null })
    expect(member(SELF_STAFF_ID)).toMatchObject({ name: 'Alex Morgan', email: 'alex.morgan@example.com', phone: '', jobTitle: 'Portfolio Manager', propertyIds: ['prop_101'] })
    expect((await getCurrentUser()).name).toBe('Alex Morgan')
  })

  it('refuses a profile email already used by a team member', async () => {
    const error = await failure(updateProfile({ name: 'Alex Morgan', email: 'Jordan.Patel@example.com', phone: '', jobTitle: 'Portfolio Manager', avatar: null }))
    expect(isServiceError(error) && error.field).toBe('email')
    expect(readDatabase().account).toEqual(defaultAccount())
  })

  it('refuses changing your own role', async () => {
    const self = member(SELF_STAFF_ID)
    const error = await failure(updateStaff(SELF_STAFF_ID, { ...self, role: 'admin' }))
    expect(isServiceError(error) && error.field).toBe('role')
    expect(stored()).toBeNull()
  })

  it('deactivates and reactivates with history; never yourself; never the last active Owner or Admin', async () => {
    await setStaffActive('stf_1003', false, 'Moved abroad')
    expect(member('stf_1003')).toMatchObject({ active: false })
    expect(member('stf_1003').deactivatedAt).not.toBeNull()
    await setStaffActive('stf_1003', true)
    const detail = await getStaffDetail('stf_1003')
    expect(detail?.events.map((event) => event.title)).toEqual(['Reactivated', 'Deactivated'])
    expect(detail?.events[1]?.description).toBe('Moved abroad')
    expect(member('stf_1003').deactivatedAt).toBeNull()

    expect(await failure(setStaffActive(SELF_STAFF_ID, false))).toBeInstanceOf(Error)
    expect(await failure(deleteStaff(SELF_STAFF_ID))).toBeInstanceOf(Error)
    expect(member(SELF_STAFF_ID).active).toBe(true)
  })

  it('protects the last active Owner or Admin in stored data where you aren’t one', async () => {
    const db = structuredClone(readDatabase())
    const self = db.staff.find((entry) => entry.userId !== null) as StaffMember
    self.role = 'leasing'
    await restoreBackup(serializeBackup({ ...createBackup(), data: serializeDatabase(db) }))
    expect((await failure(setStaffActive('stf_1002', false))) as Error).toHaveProperty('message', expect.stringMatching(/only active Owner or Admin/))
    expect((await failure(updateStaff('stf_1002', { ...member('stf_1002'), role: 'accounting' }))) as Error).toHaveProperty('message', expect.stringMatching(/only active Owner or Admin/))
    expect((await failure(deleteStaff('stf_1002'))) as Error).toHaveProperty('message', expect.stringMatching(/only active Owner or Admin/))
    await createStaff({ ...SAM, role: 'admin' })
    await setStaffActive('stf_1002', false)
    expect(member('stf_1002').active).toBe(false)
  })

  it('deletes a member and their history', async () => {
    const created = await createStaff(SAM)
    await deleteStaff(created.id)
    expect(readDatabase().staff.some((entry) => entry.id === created.id)).toBe(false)
    expect(readDatabase().staffEvents.some((event) => event.staffId === created.id)).toBe(false)
    expect(await getStaffDetail(created.id)).toBeNull()
  })

  it('changes nothing when the browser refuses the save', async () => {
    readDatabase()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(await failure(createStaff(SAM))).toBeInstanceOf(Error)
    expect(await failure(setStaffActive('stf_1003', false))).toBeInstanceOf(Error)
    vi.restoreAllMocks()
    expect(readDatabase().staff).toHaveLength(9)
    expect(member('stf_1003').active).toBe(true)
    expect(stored()).toBeNull()
  })
})

describe('backup, restore and reset', () => {
  it('backs up and restores the team exactly; reset brings back the sample team', async () => {
    const created = await createStaff(SAM)
    await setStaffActive('stf_1004', false)
    const team = structuredClone({ staff: readDatabase().staff, events: readDatabase().staffEvents })
    const text = serializeBackup(createBackup())
    expect(inspectBackup(text).counts?.user.staff).toBe(1)
    await resetWorkspaceData()
    expect(readDatabase().staff.some((entry) => entry.id === created.id)).toBe(false)
    expect(member('stf_1004').active).toBe(true)
    await restoreBackup(text)
    expect(readDatabase().staff).toEqual(team.staff)
    expect(readDatabase().staffEvents).toEqual(team.events)
  })

  it('refuses a backup with damaged staff data, changing nothing', async () => {
    await createStaff(SAM)
    const before = stored()
    for (const damage of [
      (db: DemoDatabase) => (db.staff[1] = { ...(db.staff[1] as StaffMember), email: (db.staff[2] as StaffMember).email }),
      (db: DemoDatabase) => (db.staff = db.staff.filter((entry) => entry.userId === null)),
      (db: DemoDatabase) => ((db.staff[3] as StaffMember).role = 'boss' as never),
    ]) {
      const db = structuredClone(readDatabase())
      damage(db)
      const inspection = inspectBackup(serializeBackup({ ...createBackup(), data: serializeDatabase(db) }))
      expect(inspection.restorable).toBe(false)
      expect(inspection.problems[0]).toMatch(/staff data is invalid/)
    }
    expect(stored()).toBe(before)
  })

  it('opens stored data with damaged staff as a read-only session, leaving it untouched', async () => {
    await createStaff(SAM)
    const db = structuredClone(readDatabase())
    ;(db.staff[2] as StaffMember).email = (db.staff[3] as StaffMember).email
    const raw = serializeDatabase(db)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readDatabase().staff).toHaveLength(9)
    expect(await failure(createStaff({ ...SAM, email: 'other@example.com' }))).toBeInstanceOf(Error)
    expect(stored()).toBe(raw)
  })
})
