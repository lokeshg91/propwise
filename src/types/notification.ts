export type NotificationCategory = 'maintenance' | 'payment' | 'lease' | 'tenant' | 'system'

export interface AppNotification {
  id: string
  category: NotificationCategory
  title: string
  message: string
  /** ISO 8601 timestamp. */
  createdAt: string
  read: boolean
}
