export type NotificationCategory = 'maintenance' | 'payment' | 'lease' | 'tenant' | 'system'

/** What created a notification: the five fixed sample items, or an event in the workspace (Phase 10.5). */
export const NOTIFICATION_KINDS = ['sample', 'payment-recorded', 'request-created', 'request-overdue', 'lease-expiring', 'bill-overdue', 'tenant-added'] as const
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]

/** A notification as the app shows it. */
export interface AppNotification {
  id: string
  category: NotificationCategory
  title: string
  message: string
  /** ISO 8601 timestamp. */
  createdAt: string
  read: boolean
  /** The related record, e.g. "/maintenance/MR-1042"; null when there is none. */
  link: string | null
}

/**
 * A notification as stored in the workspace data. Sample items keep their
 * age instead of a timestamp, so they always read as recent ("12 minutes
 * ago"), exactly as before Phase 10.5. Text is stored as it read when the
 * event happened.
 */
export interface StoredNotification {
  id: string
  kind: NotificationKind
  category: NotificationCategory
  title: string
  message: string
  /** Null for sample items (see `ageMinutes`). */
  createdAt: string | null
  /** Sample items only: minutes before the page loaded. */
  ageMinutes: number | null
  read: boolean
  link: string | null
  demo: boolean
}
