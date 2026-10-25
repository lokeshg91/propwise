import { ACCOUNT_LIMITS, profileFieldProblems } from '@/data/domain/account-rules'
import { STAFF_ROLES, type StaffInput, type StaffMember, type StaffRole } from '@/types'

/**
 * Staff rules (Phase 10.4): fixed demo roles, unique email addresses, and
 * the guards that keep the workspace with an active Owner or Admin. Access
 * isn't enforced in this demo: roles describe what each person would do.
 */

/** Same text limits as the profile (the signed-in user is a member too). */
export const STAFF_LIMITS = { ...ACCOUNT_LIMITS, properties: 50 } as const

export const ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  'property-manager': 'Property manager',
  maintenance: 'Maintenance coordinator',
  leasing: 'Leasing agent',
  accounting: 'Accountant',
}

export const ROLE_DESCRIPTIONS: Record<StaffRole, string> = {
  owner: 'Full access, including staff, settings and workspace data.',
  admin: 'Manages everything day to day, including staff and settings.',
  'property-manager': 'Runs assigned properties: units, tenants, leases and maintenance.',
  maintenance: 'Handles maintenance requests, work orders and vendors.',
  leasing: 'Works with tenants and leases; views properties.',
  accounting: 'Records income, payments and bills; runs reports.',
}

export const ACCESS_AREAS = ['properties', 'tenants', 'maintenance', 'finance', 'reports', 'staff', 'settings'] as const
export type AccessArea = (typeof ACCESS_AREAS)[number]
export type AccessLevel = 'manage' | 'view' | 'none'

export const ACCESS_AREA_LABELS: Record<AccessArea, string> = {
  properties: 'Properties and units',
  tenants: 'Tenants and leases',
  maintenance: 'Maintenance and vendors',
  finance: 'Finance',
  reports: 'Reports',
  staff: 'Staff',
  settings: 'Settings and data',
}

/** What each role would be allowed to do. Read-only reference; not enforced in this demo. */
export const ROLE_ACCESS: Record<StaffRole, Record<AccessArea, AccessLevel>> = {
  owner: { properties: 'manage', tenants: 'manage', maintenance: 'manage', finance: 'manage', reports: 'manage', staff: 'manage', settings: 'manage' },
  admin: { properties: 'manage', tenants: 'manage', maintenance: 'manage', finance: 'manage', reports: 'manage', staff: 'manage', settings: 'manage' },
  'property-manager': { properties: 'manage', tenants: 'manage', maintenance: 'manage', finance: 'view', reports: 'view', staff: 'view', settings: 'none' },
  maintenance: { properties: 'view', tenants: 'view', maintenance: 'manage', finance: 'none', reports: 'view', staff: 'view', settings: 'none' },
  leasing: { properties: 'view', tenants: 'manage', maintenance: 'view', finance: 'none', reports: 'view', staff: 'view', settings: 'none' },
  accounting: { properties: 'view', tenants: 'view', maintenance: 'view', finance: 'manage', reports: 'manage', staff: 'view', settings: 'none' },
}

export const isStaffRole = (value: unknown): value is StaffRole => (STAFF_ROLES as readonly unknown[]).includes(value)
/** Roles that can manage staff and settings: the workspace must always keep one active. */
export const isAdminRole = (role: StaffRole) => role === 'owner' || role === 'admin'
export const normalizeStaffEmail = (email: string) => email.trim().toLowerCase()

export type StaffField = keyof StaffInput

/** Field problems in form order; empty when the input is valid. `knownPropertyIds` limits assignments to existing properties. */
export function staffFieldProblems(input: StaffInput, knownPropertyIds?: ReadonlySet<string>): Array<{ field: StaffField; message: string }> {
  const problems: Array<{ field: StaffField; message: string }> = profileFieldProblems(input, 'other').map((problem) => ({ ...problem }))
  if (!isStaffRole(input.role)) problems.push({ field: 'role', message: 'Choose a role.' })
  if (!Array.isArray(input.propertyIds) || input.propertyIds.some((id) => typeof id !== 'string')) {
    problems.push({ field: 'propertyIds', message: 'Choose properties from the list.' })
  } else if (input.propertyIds.length > STAFF_LIMITS.properties) {
    problems.push({ field: 'propertyIds', message: `Assign at most ${STAFF_LIMITS.properties} properties.` })
  } else if (knownPropertyIds && input.propertyIds.some((id) => !knownPropertyIds.has(id))) {
    problems.push({ field: 'propertyIds', message: 'One of the chosen properties no longer exists. Choose again.' })
  }
  return problems
}

/** The member who already uses this email address (case and spaces ignored), if any. */
export function emailOwner(staff: readonly StaffMember[], email: string, exceptId?: string): StaffMember | undefined {
  const key = normalizeStaffEmail(email)
  return staff.find((member) => member.id !== exceptId && normalizeStaffEmail(member.email) === key)
}

const otherActiveAdmins = (staff: readonly StaffMember[], member: StaffMember) => staff.filter((other) => other.id !== member.id && other.active && isAdminRole(other.role)).length

/** Why this member can't be deactivated (or deleted), or null when they can. */
export function deactivationBlock(staff: readonly StaffMember[], member: StaffMember): string | null {
  if (member.userId !== null) return 'You can’t deactivate or delete your own account. Ask another Owner or Admin.'
  if (member.active && isAdminRole(member.role) && otherActiveAdmins(staff, member) === 0) {
    return `${member.name} is the only active Owner or Admin. Give another active member the Owner or Admin role first.`
  }
  return null
}

/** Why this member's role can't change to `role`, or null when it can. */
export function roleChangeBlock(staff: readonly StaffMember[], member: StaffMember, role: StaffRole): string | null {
  if (role === member.role) return null
  if (member.userId !== null) return 'You can’t change your own role. Ask another Owner or Admin.'
  if (member.active && isAdminRole(member.role) && !isAdminRole(role) && otherActiveAdmins(staff, member) === 0) {
    return `${member.name} is the only active Owner or Admin, so their role can’t change to a role without staff and settings access.`
  }
  return null
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isIso = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))

/**
 * Everything wrong with stored staff data (saved data or a backup): every
 * member valid, ids and email addresses unique, and exactly one record for
 * the signed-in user. Empty when it is valid.
 */
export function staffProblems(staff: unknown, events: unknown, userId: string): string[] {
  if (!Array.isArray(staff)) return ['the staff list is missing']
  if (!Array.isArray(events)) return ['the staff history is missing']
  const problems: string[] = []
  const ids = new Set<string>()
  const emails = new Set<string>()
  let self = 0
  staff.forEach((member: unknown, index) => {
    const label = `staff member ${index + 1}`
    if (!isObject(member) || typeof member.id !== 'string' || member.id.length === 0) {
      problems.push(`${label} has no id`)
      return
    }
    if (ids.has(member.id)) problems.push(`${label} repeats the id ${member.id}`)
    ids.add(member.id)
    const text = ['name', 'email', 'phone', 'jobTitle'] as const
    if (text.some((key) => typeof member[key] !== 'string')) {
      problems.push(`${label} is missing a contact field`)
      return
    }
    const input = member as unknown as StaffInput
    for (const problem of staffFieldProblems(input)) problems.push(`${label}: ${problem.field}: ${problem.message}`)
    const email = normalizeStaffEmail(input.email)
    if (emails.has(email)) problems.push(`${label} repeats an email address`)
    emails.add(email)
    if (typeof member.active !== 'boolean' || typeof member.demo !== 'boolean') problems.push(`${label} has an invalid status`)
    if (member.deactivatedAt !== null && !isIso(member.deactivatedAt)) problems.push(`${label} has an invalid deactivation time`)
    if (!isIso(member.createdAt) || !isIso(member.updatedAt)) problems.push(`${label} has invalid dates`)
    if (member.userId !== null && typeof member.userId !== 'string') problems.push(`${label} has an invalid account link`)
    if (member.userId === userId) self += 1
    else if (member.userId !== null) problems.push(`${label} is linked to another account`)
  })
  if (self !== 1) problems.push(self === 0 ? 'no staff record belongs to the signed-in user' : 'more than one staff record belongs to the signed-in user')
  for (const event of events as unknown[]) {
    if (!isObject(event) || typeof event.id !== 'string' || typeof event.staffId !== 'string' || typeof event.title !== 'string' || !isIso(event.createdAt)) {
      problems.push('a staff history entry is invalid')
      break
    }
  }
  return problems
}
