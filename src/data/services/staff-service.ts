import {
  deactivationBlock,
  emailOwner,
  isStaffRole,
  ROLE_LABELS,
  roleChangeBlock,
  staffFieldProblems,
} from '@/data/domain/staff-rules'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { createId, readDatabase, updateDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { type Property, type StaffEvent, type StaffEventKind, type StaffInput, type StaffMember } from '@/types'

/**
 * Staff (Phase 10.4): the team directory, with fixed demo roles and property
 * assignments. The signed-in user is a member too: their record's name,
 * email, phone and job title always match their profile, and editing either
 * one updates both. Every change is one transaction with a history entry; a
 * failed save changes nothing. Roles aren't enforced in this demo.
 */

export type StaffProperty = Pick<Property, 'id' | 'name' | 'type'>

export interface StaffListItem {
  member: StaffMember
  /** The signed-in user's own record. */
  isSelf: boolean
  /** Your profile photo on your own record; null otherwise. */
  photo: string | null
  properties: StaffProperty[]
}

export interface StaffDetail extends StaffListItem {
  /** Newest first. */
  events: StaffEvent[]
  /** Why the member can't be deactivated or deleted, or null. */
  deactivateBlock: string | null
  /** Why the member's role can't be changed at all (your own record), or null. */
  roleLocked: string | null
}

/* ------------------------------------------------------------------ reads */

const propertyMap = (db: DemoDatabase) => new Map(db.properties.map((property) => [property.id, { id: property.id, name: property.name, type: property.type }]))

function itemOf(db: DemoDatabase, member: StaffMember, properties = propertyMap(db)): StaffListItem {
  const isSelf = member.userId === db.account.profile.id
  return {
    member,
    isSelf,
    photo: isSelf ? db.account.profile.avatar : null,
    properties: member.propertyIds.flatMap((id) => {
      const property = properties.get(id)
      return property ? [property] : []
    }),
  }
}

export function getStaffList(): Promise<StaffListItem[]> {
  const db = readDatabase()
  const properties = propertyMap(db)
  return simulateLatency([...db.staff].sort((a, b) => a.name.localeCompare(b.name)).map((member) => itemOf(db, member, properties)))
}

export function getStaffDetail(id: string): Promise<StaffDetail | null> {
  const db = readDatabase()
  const member = db.staff.find((entry) => entry.id === id)
  if (!member) return simulateLatency(null)
  const item = itemOf(db, member)
  return simulateLatency({
    ...item,
    events: db.staffEvents.filter((event) => event.staffId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)),
    deactivateBlock: deactivationBlock(db.staff, member),
    roleLocked: item.isSelf ? 'You can’t change your own role. Ask another Owner or Admin.' : null,
  })
}

/** Properties staff can be assigned to, by name. */
export function getStaffPropertyOptions(): Promise<StaffProperty[]> {
  const db = readDatabase()
  return simulateLatency([...db.properties].sort((a, b) => a.name.localeCompare(b.name)).map((property) => ({ id: property.id, name: property.name, type: property.type })))
}

/** The member already using an email address, so a form can say so before saving. */
export function findStaffByEmail(email: string, exceptId?: string): Promise<Pick<StaffMember, 'id' | 'name'> | null> {
  const owner = emailOwner(readDatabase().staff, email, exceptId)
  return simulateLatency(owner ? { id: owner.id, name: owner.name } : null)
}

/* ----------------------------------------------------------------- writes */

export function createStaff(input: StaffInput): Promise<StaffMember> {
  return run(() =>
    updateDatabase((db) => {
      const fields = validate(db, input)
      assertEmailFree(db, fields.email)
      const now = new Date().toISOString()
      let id = createId('stf')
      while (db.staff.some((member) => member.id === id)) id = createId('stf')
      const member: StaffMember = { id, userId: null, ...fields, active: true, deactivatedAt: null, demo: false, createdAt: now, updatedAt: now }
      db.staff.push(member)
      record(db, member, 'created', 'Added to the team', `Added as ${ROLE_LABELS[member.role]}${assignmentText(db, member.propertyIds)}.`, now)
      return member
    }),
  )
}

/**
 * Edits a member. Editing your own record also updates your profile (and so
 * the header); your own role can't change. Earlier history keeps the name it
 * was written with.
 */
export function updateStaff(id: string, input: StaffInput): Promise<StaffMember> {
  return run(() => {
    // Nothing to change: don't write (and don't add history).
    const current = readDatabase()
    const existing = findMember(current, id)
    const unchanged = validate(current, input)
    if ((['name', 'email', 'phone', 'jobTitle', 'role'] as const).every((key) => existing[key] === unchanged[key]) && existing.propertyIds.join() === unchanged.propertyIds.join()) return existing
    return updateDatabase((db) => {
      const member = findMember(db, id)
      const fields = validate(db, input)
      assertEmailFree(db, fields.email, id)
      const roleBlock = roleChangeBlock(db.staff, member, fields.role)
      if (roleBlock) throw new ServiceError('conflict', roleBlock, 'role')

      const changed = (['name', 'email', 'phone', 'jobTitle'] as const).filter((key) => member[key] !== fields[key])
      const roleChanged = member.role !== fields.role
      const added = fields.propertyIds.filter((propertyId) => !member.propertyIds.includes(propertyId))
      const removed = member.propertyIds.filter((propertyId) => !fields.propertyIds.includes(propertyId))
      if (changed.length === 0 && !roleChanged && added.length === 0 && removed.length === 0) return member

      const now = new Date().toISOString()
      const previous = { name: member.name, role: member.role }
      Object.assign(member, fields, { updatedAt: now } satisfies Partial<StaffMember>)
      if (changed.length > 0) {
        record(
          db,
          member,
          'updated',
          previous.name !== member.name ? `Renamed to ${member.name}` : 'Details updated',
          `${previous.name !== member.name ? `Renamed from ${previous.name}. ` : ''}Changed: ${changed.map((key) => FIELD_LABELS[key]).join(', ')}.`,
          now,
        )
      }
      if (roleChanged) record(db, member, 'role-changed', 'Role changed', `${ROLE_LABELS[previous.role]} → ${ROLE_LABELS[member.role]}.`, now)
      if (added.length > 0 || removed.length > 0) {
        const names = (ids: string[]) => ids.map((propertyId) => db.properties.find((property) => property.id === propertyId)?.name ?? propertyId).join(', ')
        record(db, member, 'properties-changed', 'Assignments changed', [added.length ? `Added: ${names(added)}.` : '', removed.length ? `Removed: ${names(removed)}.` : ''].filter(Boolean).join(' '), now)
      }
      if (member.userId !== null && member.userId === db.account.profile.id && changed.length > 0) {
        db.account = { ...db.account, profile: { ...db.account.profile, name: member.name, email: member.email, phone: member.phone, jobTitle: member.jobTitle, updatedAt: now } }
      }
      return member
    })
  })
}

/** Deactivates or reactivates a member. Not yourself, and never the last active Owner or Admin. */
export function setStaffActive(id: string, active: boolean, note = ''): Promise<StaffMember> {
  return run(() =>
    updateDatabase((db) => {
      const member = findMember(db, id)
      if (member.active === active) throw new ServiceError('conflict', active ? `${member.name} is already active.` : `${member.name} is already inactive.`, 'active')
      const now = new Date().toISOString()
      if (!active) {
        const block = deactivationBlock(db.staff, member)
        if (block) throw new ServiceError('conflict', block, 'active')
        Object.assign(member, { active: false, deactivatedAt: now, updatedAt: now } satisfies Partial<StaffMember>)
        record(db, member, 'deactivated', 'Deactivated', note.trim() || 'No longer active on the team. Their history is kept.', now)
      } else {
        Object.assign(member, { active: true, deactivatedAt: null, updatedAt: now } satisfies Partial<StaffMember>)
        record(db, member, 'reactivated', 'Reactivated', note.trim() || 'Active on the team again.', now)
      }
      return member
    }),
  )
}

/** Deletes a member and their history. Not yourself, and never the last active Owner or Admin. */
export function deleteStaff(id: string): Promise<{ id: string; name: string }> {
  return run(() =>
    updateDatabase((db) => {
      const member = findMember(db, id)
      const block = deactivationBlock(db.staff, member)
      if (block) throw new ServiceError('conflict', block)
      db.staff = db.staff.filter((entry) => entry.id !== id)
      db.staffEvents = db.staffEvents.filter((event) => event.staffId !== id)
      return { id, name: member.name }
    }),
  )
}

/**
 * Copies the profile onto the signed-in user's staff record inside a
 * transaction (used when the profile is saved on the Account page).
 */
export function syncSelf(db: DemoDatabase, self: StaffMember, now: string): void {
  const { profile } = db.account
  const changed = (['name', 'email', 'phone', 'jobTitle'] as const).filter((key) => self[key] !== profile[key])
  if (changed.length === 0) return
  const previous = self.name
  Object.assign(self, { name: profile.name, email: profile.email, phone: profile.phone, jobTitle: profile.jobTitle, updatedAt: now } satisfies Partial<StaffMember>)
  record(db, self, 'updated', previous !== self.name ? `Renamed to ${self.name}` : 'Details updated', `Changed on the Account page: ${changed.map((key) => FIELD_LABELS[key]).join(', ')}.`, now)
}

/* ---------------------------------------------------------------- helpers */

const FIELD_LABELS = { name: 'name', email: 'email', phone: 'phone', jobTitle: 'job title' } as const

function run<T>(mutation: () => T): Promise<T> {
  try {
    return simulateLatency(mutation(), 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

function findMember(db: DemoDatabase, id: string): StaffMember {
  const member = db.staff.find((entry) => entry.id === id)
  if (!member) throw new ServiceError('not-found', 'Staff member not found.')
  return member
}

/** Server-side checks; the form validates the same rules for instant feedback. Assignments keep property order. */
function validate(db: DemoDatabase, input: StaffInput): StaffInput {
  const fields: StaffInput = {
    name: input.name.trim().replace(/\s+/g, ' '),
    email: input.email.trim(),
    phone: input.phone.trim(),
    jobTitle: input.jobTitle.trim().replace(/\s+/g, ' '),
    role: input.role,
    propertyIds: Array.isArray(input.propertyIds) ? input.propertyIds : [],
  }
  const known = new Set(db.properties.map((property) => property.id))
  const [problem] = staffFieldProblems({ ...fields, propertyIds: input.propertyIds }, known)
  if (problem) throw new ServiceError('invalid', problem.message, problem.field)
  if (!isStaffRole(fields.role)) throw new ServiceError('invalid', 'Choose a role.', 'role')
  const chosen = new Set(fields.propertyIds)
  return { ...fields, propertyIds: db.properties.filter((property) => chosen.has(property.id)).map((property) => property.id) }
}

function assertEmailFree(db: DemoDatabase, email: string, exceptId?: string) {
  const owner = emailOwner(db.staff, email, exceptId)
  if (owner) throw new ServiceError('conflict', `${owner.name} already uses this email address.`, 'email')
}

function assignmentText(db: DemoDatabase, ids: string[]): string {
  if (ids.length === 0) return ''
  if (ids.length <= 2) return ` for ${ids.map((id) => db.properties.find((property) => property.id === id)?.name ?? id).join(' and ')}`
  return ` for ${ids.length} properties`
}

let eventCounter = 0
/** Appends to the member's history with their name at that moment. */
function record(db: DemoDatabase, member: StaffMember, kind: StaffEventKind, title: string, description: string, now: string) {
  eventCounter += 1
  db.staffEvents.push({ id: `stv_${member.id}_${Date.now().toString(36)}${eventCounter}`, staffId: member.id, kind, staffName: member.name, title, description, createdAt: now })
}
