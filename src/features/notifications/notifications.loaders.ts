import { getNotifications } from '@/data/services'

/** The whole inbox, newest first. */
export async function notificationsLoader() {
  return { notifications: await getNotifications() }
}
