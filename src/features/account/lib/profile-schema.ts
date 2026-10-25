import { z } from 'zod'

import { profileFieldProblems } from '@/data/domain/account-rules'
import { type AccountProfile } from '@/types'

/** Profile form. Uses the same rules the account service checks again on save. */
export const profileSchema = z
  .object({
    name: z.string(),
    email: z.string(),
    phone: z.string(),
    jobTitle: z.string(),
    avatar: z.string().nullable(),
  })
  .superRefine((values, context) => {
    for (const problem of profileFieldProblems(values)) context.addIssue({ code: 'custom', path: [problem.field], message: problem.message })
  })

export type ProfileValues = z.infer<typeof profileSchema>

export const toProfileValues = (profile: AccountProfile): ProfileValues => ({
  name: profile.name,
  email: profile.email,
  phone: profile.phone,
  jobTitle: profile.jobTitle,
  avatar: profile.avatar,
})
