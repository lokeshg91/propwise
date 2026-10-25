import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { NOTIFICATION_LIMITS, notificationProblems } from '@/data/domain/notification-rules'
import { SAMPLE_NOTIFICATIONS } from '@/data/mock/notifications'
import {
  getNotifications,
  markAllNotificationsRead,
  readNotifications,
  recordPayment,
  setNotificationRead,
  updateNotificationPreferences,
} from '@/data/services'
import { createBackup, inspectBackup, resetWorkspaceData, restoreBackup, serializeBackup } from '@/data/services/backup-service'
import { isStorageError, readDatabase, resetDemoData, serializeDatabase, updateDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'

/** Phase 10.5: the saved inbox, event notifications, preferences, read state and storage. */

const T0 = new Date('2026-10-12T12:00:00')
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const at = (date: string) => vi.setSystemTime(new Date(`${date}T12:00:00`))
/** Notifications about payments (sample requests also become overdue as days pass, which these tests don't look at). */
const kinds = () => readDatabase().notifications.filter((item) => item.kind === 'payment-recorded').map((item) => item.kind)
/** Opens the saved data again, as a page load would. */
function reload() {
  const raw = stored()
  resetDemoData()
  if (raw !== null) window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
  return readDatabase()
}
const failure = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => error,
  )

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(T0)
  resetDemoData()
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

async function payOpenRent(cents = 1234) {
  const db = readDatabase()
  const payments = paymentsByCharge(db.payments)
  const today = '2026-10-12'
  const charge = db.charges.find((entry) => entry.category === 'rent' && entry.leaseId && !entry.voidedAt && entry.dueDate <= today && chargeState(entry, payments.get(entry.id), today, 5).balanceCents > cents) as DemoDatabase['charges'][number]
  const payment = await recordPayment(charge.id, { amountCents: cents, receivedOn: today, method: 'cash' })
  return { charge, payment }
}

describe('sample inbox', () => {
  it('a fresh workspace has exactly the five sample notifications, three unread, and saves nothing', async () => {
    const list = await getNotifications()
    expect(list.map((item) => item.id)).toEqual(['ntf_2001', 'ntf_2002', 'ntf_2003', 'ntf_2004', 'ntf_2005'])
    expect(list.filter((item) => !item.read)).toHaveLength(3)
    expect(list.map(({ title, message, category, read }) => ({ title, message, category, read }))).toEqual(SAMPLE_NOTIFICATIONS.map(({ title, message, category, read }) => ({ title, message, category, read })))
    expect(list.every((item) => item.link === null)).toBe(true)
    expect(readDatabase().notificationsCheckedAt).toBe(T0.toISOString())
    expect(readNotifications()).toBe(readNotifications())
    expect(stored()).toBeNull()
  })

  it('sample items keep their ages relative to page load, as before (12 min, 48 min, 5 h, 26 h, 3 days)', async () => {
    const list = await getNotifications()
    const minutes = list.map((item) => Math.round((Date.parse(list[0]?.createdAt ?? '') - Date.parse(item.createdAt)) / 60_000))
    expect(minutes).toEqual([0, 36, 288, 1548, 4308])
  })

  it('an upgraded v0.9 (v6) workspace gets the same sample inbox and nothing from its history', () => {
    const v6 = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    for (const key of ['account', 'staff', 'staffEvents', 'notifications', 'notificationsCheckedAt']) delete v6[key]
    v6.version = 6
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, serializeDatabase(v6 as unknown as DemoDatabase))
    at('2026-11-20')
    const db = readDatabase()
    expect(db.notifications.map((item) => item.id)).toEqual(SAMPLE_NOTIFICATIONS.map((item) => item.id))
    expect(db.notifications.filter((item) => !item.read)).toHaveLength(3)
    const raw = stored()
    expect(reload().notifications).toHaveLength(5)
    expect(stored()).toBe(raw)
  })

  it('v7 data saved before the inbox existed (Phase 10.3/10.4 builds) gets the sample inbox', () => {
    const db = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    delete db.notifications
    delete db.notificationsCheckedAt
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, serializeDatabase(db as unknown as DemoDatabase))
    expect(readDatabase().notifications).toHaveLength(5)
    expect(stored()).not.toBeNull()
  })
})

describe('write events', () => {
  it('a recorded payment creates one notification with a deterministic id and a link, never twice', async () => {
    const { charge, payment } = await payOpenRent()
    const item = readDatabase().notifications.find((entry) => entry.kind === 'payment-recorded')
    expect(item).toMatchObject({ id: `ntf_payment-recorded_${payment.id}`, category: 'payment', title: 'Payment recorded', read: false, link: `/finance/transactions/${charge.id}`, demo: false })
    expect(item?.message).toMatch(/paid \$12\.34 for /)
    await markAllNotificationsRead()
    expect(kinds()).toEqual(['payment-recorded'])
    at('2026-10-13')
    reload()
    expect(kinds()).toEqual(['payment-recorded'])
    expect(readDatabase().notifications.find((entry) => entry.kind === 'payment-recorded')?.read).toBe(true)
  })

  it('a new maintenance request and a new tenant are notified', () => {
    updateDatabase((db) => {
      const request = structuredClone(db.serviceRequests[0] as DemoDatabase['serviceRequests'][number])
      db.serviceRequests.push({ ...request, id: 'MR-9001', title: 'Broken window', status: 'open', createdAt: '2026-10-11T09:00:00.000Z', dueAt: '2026-11-30T09:00:00.000Z' })
      const tenant = structuredClone(db.tenants[0] as DemoDatabase['tenants'][number])
      db.tenants.push({ ...tenant, id: 'ten_qa_1', name: 'Quinn Avery', createdAt: '2026-10-11T09:00:00.000Z' })
    })
    const db = readDatabase()
    expect(db.notifications.find((item) => item.id === 'ntf_request-created_MR-9001')).toMatchObject({ category: 'maintenance', link: '/maintenance/MR-9001' })
    expect(db.notifications.find((item) => item.id === 'ntf_tenant-added_ten_qa_1')).toMatchObject({ category: 'tenant', link: '/tenants/ten_qa_1' })
    expect(db.notifications.find((item) => item.id === 'ntf_request-created_MR-9001')?.message).toMatch(/^Broken window at /)
  })

  it('respects the preferences: a category that is off isn’t notified, then or later', async () => {
    await updateNotificationPreferences({ maintenance: true, payment: false, lease: true, tenant: true, system: true })
    await payOpenRent()
    expect(kinds()).toEqual([])
    await updateNotificationPreferences({ maintenance: true, payment: true, lease: true, tenant: true, system: true })
    at('2026-10-14')
    reload()
    expect(kinds()).toEqual([])
    await payOpenRent(2000)
    expect(kinds()).toEqual(['payment-recorded'])
  })
})

describe('date events', () => {
  it('a lease entering its last 30 days is notified once, when the day comes', async () => {
    await markAllNotificationsRead() // saves the workspace: the inbox is checked from T0
    const lease = readDatabase().leases.find((entry) => entry.status === 'active' && entry.endDate >= '2026-11-20' && entry.endDate <= '2026-12-10') as DemoDatabase['leases'][number]
    expect(lease).toBeDefined()
    at('2026-10-19')
    reload()
    const early = readDatabase().notifications.filter((item) => item.kind === 'lease-expiring' && item.id.includes(lease.id))
    const trigger = new Date(`${lease.endDate}T12:00:00`)
    trigger.setDate(trigger.getDate() - 30)
    expect(early.length).toBe(trigger <= new Date('2026-10-19T12:00:00') ? 1 : 0)
    at('2026-11-15')
    reload()
    const items = readDatabase().notifications.filter((item) => item.id === `ntf_lease-expiring_${lease.id}_${lease.endDate}`)
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ category: 'lease', link: `/tenants/${lease.tenantId}`, read: false })
    reload()
    expect(readDatabase().notifications.filter((item) => item.id === `ntf_lease-expiring_${lease.id}_${lease.endDate}`)).toHaveLength(1)
  })

  it('a bill becoming overdue and a request passing its target are notified; nothing older than 30 days', () => {
    updateDatabase((db) => {
      const bill = structuredClone(db.expenses.find((entry) => !entry.voidedAt) as DemoDatabase['expenses'][number])
      db.expenses.push({ ...bill, id: 'exp_qa_1', reference: 'EXP-99001', dueDate: '2026-10-20', paidOn: undefined, paymentMethod: undefined, demo: undefined })
      const request = structuredClone(db.serviceRequests[0] as DemoDatabase['serviceRequests'][number])
      db.serviceRequests.push({ ...request, id: 'MR-9002', title: 'No heat', status: 'open', priority: 'urgent', createdAt: '2026-10-12T11:00:00.000Z', dueAt: '2026-10-13T11:00:00.000Z' })
      db.serviceRequests.push({ ...request, id: 'MR-9003', title: 'Old leak', status: 'open', priority: 'urgent', createdAt: '2026-10-12T11:00:00.000Z', dueAt: '2026-12-20T11:00:00.000Z' })
    })
    at('2026-10-22')
    reload()
    const ids = readDatabase().notifications.map((item) => item.id)
    expect(ids).toContain('ntf_bill-overdue_exp_qa_1_2026-10-20')
    expect(ids).toContain('ntf_request-overdue_MR-9002_2026-10-13')
    expect(ids).not.toContain('ntf_request-overdue_MR-9003_2026-12-20')
    // More than 30 days after the target: not notified any more.
    at('2027-02-10')
    reload()
    expect(readDatabase().notifications.map((item) => item.id)).not.toContain('ntf_request-overdue_MR-9003_2026-12-20')
  })
})

describe('read state and storage', () => {
  it('marks one read or unread, and all read, and keeps it after a reload', async () => {
    await setNotificationRead('ntf_2004', false)
    await setNotificationRead('ntf_2001', true)
    expect(reload().notifications.filter((item) => !item.read).map((item) => item.id).sort()).toEqual(['ntf_2002', 'ntf_2003', 'ntf_2004'])
    expect(await markAllNotificationsRead()).toBe(3)
    expect(reload().notifications.every((item) => item.read)).toBe(true)
    const raw = stored()
    expect(await markAllNotificationsRead()).toBe(0)
    expect(stored()).toBe(raw)
  })

  it('changes nothing when the browser refuses the save', async () => {
    readDatabase()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    expect(isStorageError(await failure(markAllNotificationsRead()))).toBe(true)
    vi.restoreAllMocks()
    expect(readDatabase().notifications.filter((item) => !item.read)).toHaveLength(3)
    expect(stored()).toBeNull()
  })

  it('keeps storage bounded: at most 200 event notifications plus the five samples', () => {
    updateDatabase((db) => {
      const payment = db.payments.find((entry) => !entry.voidedAt) as DemoDatabase['payments'][number]
      for (let index = 0; index < 260; index += 1) db.payments.push({ ...payment, id: `pay_qa_${index}`, demo: undefined, createdAt: new Date(T0.getTime() + index).toISOString() })
    })
    const db = readDatabase()
    expect(db.notifications.filter((item) => item.kind === 'sample')).toHaveLength(5)
    expect(db.notifications.filter((item) => item.kind !== 'sample')).toHaveLength(NOTIFICATION_LIMITS.maxStored)
    expect(db.notifications.some((item) => item.id === 'ntf_payment-recorded_pay_qa_259')).toBe(true)
    expect(db.notifications.some((item) => item.id === 'ntf_payment-recorded_pay_qa_0')).toBe(false)
    expect(new Set(db.notifications.map((item) => item.id)).size).toBe(db.notifications.length)
  })
})

describe('backup, restore and reset', () => {
  it('backs up and restores the inbox and read state; reset brings back the sample inbox', async () => {
    await payOpenRent()
    await setNotificationRead('ntf_2002', true)
    const inbox = structuredClone(readDatabase().notifications)
    const text = serializeBackup(createBackup())
    await resetWorkspaceData()
    expect(readDatabase().notifications.map((item) => item.id)).toEqual(SAMPLE_NOTIFICATIONS.map((item) => item.id))
    expect(readDatabase().notifications.filter((item) => !item.read)).toHaveLength(3)
    await restoreBackup(text)
    expect(readDatabase().notifications).toEqual(inbox)
  })

  it('refuses a backup with damaged notifications, and repairs damaged stored ones without writing', async () => {
    await payOpenRent()
    const db = structuredClone(readDatabase())
    ;(db.notifications[0] as DemoDatabase['notifications'][number]).link = 'https://evil.example.com'
    const inspection = inspectBackup(serializeBackup({ ...createBackup(), data: serializeDatabase(db) }))
    expect(inspection.restorable).toBe(false)
    expect(inspection.problems[0]).toMatch(/notifications are invalid/)
    expect(notificationProblems(db.notifications, db.notificationsCheckedAt)).toEqual(['notification 1 has an invalid link'])

    const raw = serializeDatabase(db)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, raw)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    expect(readDatabase().notifications.some((item) => item.link === 'https://evil.example.com')).toBe(false)
    expect(readDatabase().notifications.length).toBe(db.notifications.length - 1)
    expect(stored()).toBe(raw)
  })
})
