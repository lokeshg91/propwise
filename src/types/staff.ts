/**
 * Team members (Phase 10.4). The signed-in user is one of them: the record
 * with `userId` set. Roles are fixed demo roles; access isn't enforced in
 * this demo.
 */

export const STAFF_ROLES = ['owner', 'admin', 'property-manager', 'maintenance', 'leasing', 'accounting'] as const
export type StaffRole = (typeof STAFF_ROLES)[number]

export interface StaffMember {
  /** Stable id: fixed for the sample team ("stf_1001"), generated for members added in the app. */
  id: string
  /** Set on the signed-in user's own record: the account it belongs to. Their name, email, phone and job title follow the profile. */
  userId: string | null
  name: string
  email: string
  /** Empty when not given. */
  phone: string
  jobTitle: string
  role: StaffRole
  /** Properties the member is assigned to, in property order. */
  propertyIds: string[]
  /** Inactive members keep their history. */
  active: boolean
  /** When the member last became inactive; null while active. */
  deactivatedAt: string | null
  /** True for the fictional sample team. */
  demo: boolean
  createdAt: string
  updatedAt: string
}

/** Fields set when adding or editing a member. */
export interface StaffInput {
  name: string
  email: string
  phone: string
  jobTitle: string
  role: StaffRole
  propertyIds: string[]
}

export const STAFF_EVENT_KINDS = ['created', 'updated', 'role-changed', 'properties-changed', 'deactivated', 'reactivated'] as const
export type StaffEventKind = (typeof STAFF_EVENT_KINDS)[number]

/** Append-only history. `staffName` keeps the name the member had when the event happened. */
export interface StaffEvent {
  id: string
  staffId: string
  kind: StaffEventKind
  staffName: string
  title: string
  description: string
  createdAt: string
}
