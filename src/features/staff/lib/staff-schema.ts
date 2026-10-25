import { z } from 'zod'

import { staffFieldProblems } from '@/data/domain/staff-rules'
import { STAFF_ROLES, type StaffInput, type StaffMember } from '@/types'

/** Staff form. The staff service checks the same rules again on save. */
export const staffSchema = z
  .object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    jobTitle: z.string(),
    role: z.enum(STAFF_ROLES),
    propertyIds: z.array(z.string()),
  })
  .superRefine((values, context) => {
    for (const problem of staffFieldProblems(values)) context.addIssue({ code: 'custom', path: [problem.field], message: problem.message })
  })

export type StaffFormValues = z.infer<typeof staffSchema>

export const EMPTY_STAFF_VALUES: StaffFormValues = { name: '', email: '', phone: '', jobTitle: '', role: 'property-manager', propertyIds: [] }

export const toStaffFormValues = (member: StaffMember): StaffFormValues => ({
  name: member.name,
  email: member.email,
  phone: member.phone,
  jobTitle: member.jobTitle,
  role: member.role,
  propertyIds: [...member.propertyIds],
})

export const toStaffInput = (values: StaffFormValues): StaffInput => ({ ...values, propertyIds: [...values.propertyIds] })
