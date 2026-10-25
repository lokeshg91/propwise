import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { peekDatabase, readDatabase, subscribeDatabase, updateDatabase } from '@/data/store/demo-store'
import { type AppNotification, type StoredNotification } from '@/types'

/**
 * Notifications (Phase 10.5): one inbox, saved with the workspace, read by
 * the header menu, the sidebar badge and the Notifications page alike. Read
 * state is saved; a failed save changes nothing.
 */

/** Sample items are shown relative to page load, as they always were. */
const PAGE_LOADED_AT = Date.now()

export function toAppNotification(item: StoredNotification): AppNotification {
  return {
    id: item.id,
    category: item.category,
    title: item.title,
    message: item.message,
    createdAt: item.createdAt ?? new Date(PAGE_LOADED_AT - (item.ageMinutes ?? 0) * 60_000).toISOString(),
    read: item.read,
    link: item.link,
  }
}

const newestFirst = (items: StoredNotification[]) => items.map(toAppNotification).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))

export function getNotifications(): Promise<AppNotification[]> {
  return simulateLatency(newestFirst(readDatabase().notifications))
}

let lastSource: StoredNotification[] | null = null
let lastList: AppNotification[] | null = null

/**
 * The inbox for the app shell, synchronously and newest first. Null before
 * the workspace data is loaded. Returns the same array while nothing changed.
 */
export function readNotifications(): AppNotification[] | null {
  const source = peekDatabase()?.notifications ?? null
  if (source === null) return null
  if (source !== lastSource) {
    lastSource = source
    lastList = newestFirst(source)
  }
  return lastList
}

export const subscribeNotifications = subscribeDatabase

/** Marks one notification read or unread. Nothing is written when it already is. */
export function setNotificationRead(id: string, read: boolean): Promise<AppNotification> {
  try {
    const current = readDatabase().notifications.find((item) => item.id === id)
    if (!current) throw new ServiceError('not-found', 'This notification no longer exists.')
    if (current.read === read) return simulateLatency(toAppNotification(current))
    const updated = updateDatabase((db) => {
      const item = db.notifications.find((entry) => entry.id === id) as StoredNotification
      item.read = read
      return toAppNotification(item)
    })
    return simulateLatency(updated, 120)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

/** Marks every notification read. Resolves with how many changed (0 writes nothing). */
export function markAllNotificationsRead(): Promise<number> {
  try {
    const unread = readDatabase().notifications.filter((item) => !item.read).length
    if (unread === 0) return simulateLatency(0)
    updateDatabase((db) => {
      for (const item of db.notifications) item.read = true
    })
    return simulateLatency(unread, 120)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}
