import { type AccountProfile, type StaffEvent, type StaffMember } from '@/types'

/**
 * The fictional sample team (Phase 10.4). Ids, dates and assignments are
 * fixed, so a fresh install and an upgrade produce the same team on any day.
 * Member #1 is the signed-in user, built from their profile.
 */

export const SELF_STAFF_ID = 'stf_1001'

const SAMPLE: Array<Omit<StaffMember, 'userId' | 'demo' | 'updatedAt' | 'deactivatedAt'> & { deactivatedAt?: string }> = [
  { id: 'stf_1002', name: 'Jordan Patel', email: 'jordan.patel@example.com', phone: '(512) 555-0142', jobTitle: 'Operations Director', role: 'admin', propertyIds: [], active: true, createdAt: '2025-02-03T09:00:00.000Z' },
  { id: 'stf_1003', name: 'Maria Chen', email: 'maria.chen@example.com', phone: '(512) 555-0163', jobTitle: 'Senior Property Manager', role: 'property-manager', propertyIds: ['prop_101', 'prop_102', 'prop_103', 'prop_104'], active: true, createdAt: '2025-03-10T09:00:00.000Z' },
  { id: 'stf_1004', name: 'Daniel Brooks', email: 'daniel.brooks@example.com', phone: '(512) 555-0178', jobTitle: 'Property Manager', role: 'property-manager', propertyIds: ['prop_105', 'prop_106', 'prop_107'], active: true, createdAt: '2025-04-14T09:00:00.000Z' },
  { id: 'stf_1005', name: 'Nadia Okafor', email: 'nadia.okafor@example.com', phone: '(512) 555-0185', jobTitle: 'Commercial Portfolio Manager', role: 'property-manager', propertyIds: ['prop_201', 'prop_202', 'prop_203', 'prop_204', 'prop_205'], active: true, createdAt: '2025-05-05T09:00:00.000Z' },
  { id: 'stf_1006', name: 'Sofia Alvarez', email: 'sofia.alvarez@example.com', phone: '(512) 555-0191', jobTitle: 'Maintenance Coordinator', role: 'maintenance', propertyIds: ['prop_101', 'prop_102', 'prop_103', 'prop_104', 'prop_105', 'prop_106', 'prop_107'], active: true, createdAt: '2025-06-02T09:00:00.000Z' },
  { id: 'stf_1007', name: 'Ethan Wright', email: 'ethan.wright@example.com', phone: '(512) 555-0127', jobTitle: 'Leasing Agent', role: 'leasing', propertyIds: ['prop_101', 'prop_103', 'prop_105'], active: true, createdAt: '2025-07-21T09:00:00.000Z' },
  { id: 'stf_1008', name: 'Hannah Lee', email: 'hannah.lee@example.com', phone: '', jobTitle: 'Accountant', role: 'accounting', propertyIds: [], active: true, createdAt: '2025-08-11T09:00:00.000Z' },
  { id: 'stf_1009', name: 'Marcus Reed', email: 'marcus.reed@example.com', phone: '(512) 555-0119', jobTitle: 'Maintenance Technician', role: 'maintenance', propertyIds: ['prop_201', 'prop_202'], active: false, createdAt: '2025-03-24T09:00:00.000Z', deactivatedAt: '2026-06-30T17:00:00.000Z' },
]

/** The signed-in user's own record. Owner, with no specific property assignments. */
export function selfStaffMember(profile: AccountProfile): StaffMember {
  return {
    id: SELF_STAFF_ID,
    userId: profile.id,
    name: profile.name,
    email: profile.email,
    phone: profile.phone,
    jobTitle: profile.jobTitle,
    role: 'owner',
    propertyIds: [],
    active: true,
    deactivatedAt: null,
    demo: true,
    createdAt: '2025-01-06T09:00:00.000Z',
    updatedAt: '2025-01-06T09:00:00.000Z',
  }
}

/**
 * The sample team. Assignments to properties that don't exist in this
 * workspace are left out; a sample member whose email is already taken
 * (only possible in edited data) is left out too.
 */
export function buildSampleStaff(profile: AccountProfile, propertyIds: ReadonlySet<string>): StaffMember[] {
  const self = selfStaffMember(profile)
  const taken = new Set([self.email.trim().toLowerCase()])
  const team: StaffMember[] = [self]
  for (const member of SAMPLE) {
    const key = member.email.toLowerCase()
    if (taken.has(key)) continue
    taken.add(key)
    team.push({
      ...member,
      userId: null,
      propertyIds: member.propertyIds.filter((id) => propertyIds.has(id)),
      deactivatedAt: member.deactivatedAt ?? null,
      demo: true,
      updatedAt: member.deactivatedAt ?? member.createdAt,
    })
  }
  return team
}

export const SAMPLE_STAFF_IDS: ReadonlySet<string> = new Set([SELF_STAFF_ID, ...SAMPLE.map((member) => member.id)])

/** History for the sample team: the one sample member who left. */
export function buildSampleStaffEvents(team: readonly StaffMember[]): StaffEvent[] {
  const marcus = team.find((member) => member.id === 'stf_1009' && !member.active)
  if (!marcus || marcus.deactivatedAt === null) return []
  return [
    {
      id: 'stv_stf_1009_deactivated',
      staffId: marcus.id,
      kind: 'deactivated',
      staffName: marcus.name,
      title: 'Deactivated',
      description: 'Left the team. Their history is kept.',
      createdAt: marcus.deactivatedAt,
    },
  ]
}
