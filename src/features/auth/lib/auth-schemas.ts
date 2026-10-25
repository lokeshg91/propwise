import { z } from 'zod'

/**
 * Validation for the demo sign-in, sign-up and password forms (Phase 10.2).
 * Values are checked in the browser and then discarded: nothing typed into
 * these forms is stored or sent.
 */

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 128
const EMAIL_MAX = 254
const NAME_MAX = 80

/** The password rules, also shown as a live checklist under the field. */
export const PASSWORD_RULES = [
  { id: 'length', label: `${PASSWORD_MIN}–${PASSWORD_MAX} characters`, test: (value: string) => value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX },
  { id: 'letter', label: 'At least one letter', test: (value: string) => /\p{L}/u.test(value) },
  { id: 'number', label: 'At least one number', test: (value: string) => /\d/.test(value) },
] as const

const email = z
  .string()
  .trim()
  .min(1, 'Enter your email address.')
  .max(EMAIL_MAX, `Use an email address of at most ${EMAIL_MAX} characters.`)
  .pipe(z.email('Enter a valid email address, like name@example.com.'))

const newPassword = z
  .string()
  .min(1, 'Enter a password.')
  .refine((value) => value.length >= PASSWORD_MIN, `Use at least ${PASSWORD_MIN} characters.`)
  .refine((value) => value.length <= PASSWORD_MAX, `Use at most ${PASSWORD_MAX} characters.`)
  .refine((value) => /\p{L}/u.test(value) && /\d/.test(value), 'Include at least one letter and one number.')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
})

export const signupSchema = z
  .object({
    name: z.string().trim().min(1, 'Enter your name.').max(NAME_MAX, `Use at most ${NAME_MAX} characters.`),
    email,
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
    acceptTerms: z.boolean().refine((value) => value, 'Accept the Terms of service and Privacy policy to continue.'),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'The passwords don’t match.' })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'The passwords don’t match.' })

/** Account page (Phase 10.3). DEMO ONLY: the current password isn't checked and nothing is stored. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    password: newPassword,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .refine((values) => values.password === values.confirmPassword, { path: ['confirmPassword'], message: 'The passwords don’t match.' })
  .refine((values) => values.password !== values.currentPassword, { path: ['password'], message: 'Choose a password that’s different from your current one.' })

export type LoginValues = z.infer<typeof loginSchema>
export type SignupValues = z.infer<typeof signupSchema>
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>
