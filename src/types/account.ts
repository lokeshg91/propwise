import { type NotificationCategory } from './notification'

/** The signed-in user's own profile (Phase 10.3). One per workspace. */
export interface AccountProfile {
  id: string
  name: string
  email: string
  /** Empty when not given. */
  phone: string
  /** Shown under the name in the header, e.g. "Portfolio Manager". */
  jobTitle: string
  /** A small photo as a data URL (JPEG, at most 256 × 256 px), or null to show initials. */
  avatar: string | null
  /** Last saved change, or null while it is the original sample profile. */
  updatedAt: string | null
}

/** In-app notifications per category: true means the category creates notifications. */
export type NotificationPreferences = Record<NotificationCategory, boolean>

export interface Account {
  profile: AccountProfile
  notificationPreferences: NotificationPreferences
  /** Last saved change to the preferences, or null while they are the defaults. */
  preferencesUpdatedAt: string | null
}
