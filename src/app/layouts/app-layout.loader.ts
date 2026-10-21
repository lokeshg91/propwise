import { getCurrentUser, getNotifications } from '@/data/services'

/** Loads data the application shell needs on every authenticated page. */
export async function appLayoutLoader() {
  const [user, notifications] = await Promise.all([getCurrentUser(), getNotifications()])
  return { user, notifications }
}

export type AppLayoutData = Awaited<ReturnType<typeof appLayoutLoader>>
