import { currentUser } from '@/data/mock/users'
import { type Account, type AccountProfile, type NotificationCategory, type NotificationPreferences } from '@/types'

/**
 * The signed-in user's profile and notification preferences (Phase 10.3).
 * Stored in the workspace data. Passwords are never stored: the password
 * form on the Account page is a demo.
 */

export const ACCOUNT_LIMITS = { name: 80, email: 254, phone: 30, jobTitle: 80 } as const

/** A resized photo (≤ 256 × 256 px JPEG) is normally 10–40 thousand characters; anything larger is refused. */
export const AVATAR_MAX_CHARS = 120_000
export const AVATAR_MAX_PIXELS = 256

export const NOTIFICATION_CATEGORIES: readonly NotificationCategory[] = ['maintenance', 'payment', 'lease', 'tenant', 'system']

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = { maintenance: true, payment: true, lease: true, tenant: true, system: true }

/** The sample profile every workspace starts with: the same user the header has always shown. */
export function defaultAccount(): Account {
  return {
    profile: {
      id: currentUser.id,
      name: currentUser.name,
      email: currentUser.email,
      phone: '',
      jobTitle: currentUser.role,
      avatar: null,
      updatedAt: null,
    },
    notificationPreferences: { ...DEFAULT_NOTIFICATION_PREFERENCES },
    preferencesUpdatedAt: null,
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_CHARS = /^[\d\s()+.-]+$/
const AVATAR = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/
const ISO = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

export const isAvatarDataUrl = (value: unknown): value is string => typeof value === 'string' && value.length <= AVATAR_MAX_CHARS && AVATAR.test(value)

const digitCount = (value: string) => value.replace(/\D/g, '').length

/**
 * Field-level problems with a person's editable fields, in form order. Empty
 * when they are valid. `who` words the messages for your own profile or for
 * another team member (Staff).
 */
export function profileFieldProblems(
  input: Pick<AccountProfile, 'name' | 'email' | 'phone' | 'jobTitle'>,
  who: 'self' | 'other' = 'self',
): Array<{ field: 'name' | 'email' | 'phone' | 'jobTitle'; message: string }> {
  const your = who === 'self' ? 'your' : 'the'
  const problems: Array<{ field: 'name' | 'email' | 'phone' | 'jobTitle'; message: string }> = []
  const name = input.name.trim()
  if (name.length < 2) problems.push({ field: 'name', message: who === 'self' ? 'Enter your name.' : 'Enter the person’s name.' })
  else if (name.length > ACCOUNT_LIMITS.name) problems.push({ field: 'name', message: `Use at most ${ACCOUNT_LIMITS.name} characters.` })
  else if (CONTROL.test(name)) problems.push({ field: 'name', message: `Remove line breaks and special characters from ${your} name.` })
  const email = input.email.trim()
  if (email.length === 0) problems.push({ field: 'email', message: who === 'self' ? 'Enter your email address.' : 'Enter an email address.' })
  else if (email.length > ACCOUNT_LIMITS.email) problems.push({ field: 'email', message: `Use an email address of at most ${ACCOUNT_LIMITS.email} characters.` })
  else if (!EMAIL.test(email)) problems.push({ field: 'email', message: 'Enter a valid email address, like name@example.com.' })
  const phone = input.phone.trim()
  if (phone.length > 0 && (phone.length > ACCOUNT_LIMITS.phone || !PHONE_CHARS.test(phone) || digitCount(phone) < 7 || digitCount(phone) > 15)) {
    problems.push({ field: 'phone', message: 'Enter a valid phone number, e.g. (512) 555-0134, or leave it blank.' })
  }
  const jobTitle = input.jobTitle.trim()
  if (jobTitle.length === 0) problems.push({ field: 'jobTitle', message: `Enter ${your} job title.` })
  else if (jobTitle.length > ACCOUNT_LIMITS.jobTitle) problems.push({ field: 'jobTitle', message: `Use at most ${ACCOUNT_LIMITS.jobTitle} characters.` })
  else if (CONTROL.test(jobTitle)) problems.push({ field: 'jobTitle', message: `Remove line breaks and special characters from ${your} job title.` })
  return problems
}

/** Everything wrong with stored account data (saved data or a backup). Empty when it is valid. */
export function accountProblems(value: unknown): string[] {
  if (!isObject(value)) return ['the account is missing']
  const problems: string[] = []
  const profile = value.profile
  if (!isObject(profile)) {
    problems.push('the profile is missing')
  } else {
    if (typeof profile.id !== 'string' || profile.id.length === 0) problems.push('the profile has no id')
    const text = ['name', 'email', 'phone', 'jobTitle'] as const
    if (text.some((key) => typeof profile[key] !== 'string')) {
      problems.push('a profile field is missing')
    } else {
      for (const problem of profileFieldProblems(profile as unknown as AccountProfile)) problems.push(`${problem.field}: ${problem.message}`)
    }
    if (profile.avatar !== null && !isAvatarDataUrl(profile.avatar)) problems.push('the profile photo isn’t a supported image')
    if (profile.updatedAt !== null && !ISO(profile.updatedAt)) problems.push('the profile has an invalid update time')
  }
  const preferences = value.notificationPreferences
  if (!isObject(preferences) || NOTIFICATION_CATEGORIES.some((category) => typeof preferences[category] !== 'boolean')) {
    problems.push('the notification preferences are incomplete')
  }
  if (value.preferencesUpdatedAt !== null && !ISO(value.preferencesUpdatedAt)) problems.push('the preferences have an invalid update time')
  return problems
}

/**
 * Keeps every valid part of stored account data and replaces the rest with
 * the defaults. Used when loading saved data, so a damaged profile can't
 * hide the workspace; backups are checked strictly instead.
 */
export function repairAccount(value: unknown): Account {
  const fallback = defaultAccount()
  if (!isObject(value)) return fallback
  const profile = isObject(value.profile) ? value.profile : {}
  const text = (key: 'name' | 'email' | 'phone' | 'jobTitle') => (typeof profile[key] === 'string' ? (profile[key] as string) : fallback.profile[key])
  const candidate = { name: text('name'), email: text('email'), phone: text('phone'), jobTitle: text('jobTitle') }
  const bad = new Set(profileFieldProblems(candidate).map((problem) => problem.field))
  const preferences = isObject(value.notificationPreferences) ? value.notificationPreferences : {}
  return {
    profile: {
      id: typeof profile.id === 'string' && profile.id.length > 0 ? profile.id : fallback.profile.id,
      name: bad.has('name') ? fallback.profile.name : candidate.name,
      email: bad.has('email') ? fallback.profile.email : candidate.email,
      phone: bad.has('phone') ? '' : candidate.phone,
      jobTitle: bad.has('jobTitle') ? fallback.profile.jobTitle : candidate.jobTitle,
      avatar: isAvatarDataUrl(profile.avatar) ? profile.avatar : null,
      updatedAt: ISO(profile.updatedAt) ? (profile.updatedAt as string) : null,
    },
    notificationPreferences: Object.fromEntries(
      NOTIFICATION_CATEGORIES.map((category) => [category, typeof preferences[category] === 'boolean' ? preferences[category] : true]),
    ) as NotificationPreferences,
    preferencesUpdatedAt: ISO(value.preferencesUpdatedAt) ? (value.preferencesUpdatedAt as string) : null,
  }
}
