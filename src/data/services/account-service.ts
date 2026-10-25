import {
  isAvatarDataUrl,
  NOTIFICATION_CATEGORIES,
  profileFieldProblems,
} from '@/data/domain/account-rules'
import { emailOwner } from '@/data/domain/staff-rules'
import { syncSelf } from '@/data/services/staff-service'
import { peekDatabase, readDatabase, subscribeDatabase, updateDatabase } from '@/data/store/demo-store'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { type Account, type AccountProfile, type NotificationPreferences, type User } from '@/types'

/**
 * The signed-in user's account (Phase 10.3): profile and in-app notification
 * preferences, saved in the workspace data. Every change is one transaction:
 * a failed save changes nothing. Passwords are never stored or checked here;
 * the password form on the Account page is a demo.
 */

export interface ProfileInput {
  name: string
  email: string
  phone: string
  jobTitle: string
  /** A resized photo as a data URL, or null for initials. */
  avatar: string | null
}

/** How the app shell shows the profile: the job title appears under the name. */
export function toUser(profile: AccountProfile): User {
  return { id: profile.id, name: profile.name, email: profile.email, role: profile.jobTitle, ...(profile.avatar ? { avatarUrl: profile.avatar } : {}) }
}

export function getAccount(): Promise<Account> {
  return simulateLatency(readDatabase().account)
}

/** The user the header shows. Loads the workspace data if nothing has yet. */
export function getCurrentUser(): Promise<User> {
  return simulateLatency(toUser(readDatabase().account.profile))
}

let lastProfile: AccountProfile | null = null
let lastUser: User | null = null

/**
 * The current user for the app shell, synchronously. Null before the
 * workspace data is loaded (the shell then keeps the user its loader read).
 * Returns the same object while the profile is unchanged.
 */
export function readCurrentUser(): User | null {
  const profile = peekDatabase()?.account.profile ?? null
  if (profile === null) return null
  if (profile !== lastProfile) {
    lastProfile = profile
    lastUser = toUser(profile)
  }
  return lastUser
}

export const subscribeAccount = subscribeDatabase

const sameProfile = (a: AccountProfile, b: Omit<AccountProfile, 'id' | 'updatedAt'>) =>
  a.name === b.name && a.email === b.email && a.phone === b.phone && a.jobTitle === b.jobTitle && a.avatar === b.avatar

/** Saves the profile. Validated again here; resolves with the saved account only once it is stored. */
export function updateProfile(input: ProfileInput): Promise<Account> {
  try {
    const next = { name: input.name.trim(), email: input.email.trim(), phone: input.phone.trim(), jobTitle: input.jobTitle.trim(), avatar: input.avatar }
    const [problem] = profileFieldProblems(next)
    if (problem) throw new ServiceError('invalid', problem.message, problem.field)
    if (next.avatar !== null && !isAvatarDataUrl(next.avatar)) throw new ServiceError('invalid', 'This photo can’t be used. Choose a JPEG, PNG or WebP image.', 'avatar')
    const current = readDatabase().account
    if (sameProfile(current.profile, next)) return simulateLatency(current)
    const now = new Date().toISOString()
    const account = updateDatabase((db) => {
      const self = db.staff.find((member) => member.userId === db.account.profile.id)
      const taken = emailOwner(db.staff, next.email, self?.id)
      if (taken) throw new ServiceError('conflict', `${taken.name} on your team already uses this email address.`, 'email')
      db.account = { ...db.account, profile: { ...db.account.profile, ...next, updatedAt: now } }
      // Your staff record shows the same name, email, phone and job title.
      if (self) syncSelf(db, self, now)
      return db.account
    })
    return simulateLatency(account, 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

/** Saves which categories create in-app notifications. */
export function updateNotificationPreferences(preferences: NotificationPreferences): Promise<Account> {
  try {
    if (NOTIFICATION_CATEGORIES.some((category) => typeof preferences[category] !== 'boolean')) {
      throw new ServiceError('invalid', 'Choose on or off for every notification type.')
    }
    const next = Object.fromEntries(NOTIFICATION_CATEGORIES.map((category) => [category, preferences[category]])) as NotificationPreferences
    const current = readDatabase().account
    if (NOTIFICATION_CATEGORIES.every((category) => current.notificationPreferences[category] === next[category])) return simulateLatency(current)
    const now = new Date().toISOString()
    const account = updateDatabase((db) => {
      db.account = { ...db.account, notificationPreferences: next, preferencesUpdatedAt: now }
      return db.account
    })
    return simulateLatency(account, 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

export { ACCOUNT_LIMITS, AVATAR_MAX_CHARS, AVATAR_MAX_PIXELS, NOTIFICATION_CATEGORIES } from '@/data/domain/account-rules'
