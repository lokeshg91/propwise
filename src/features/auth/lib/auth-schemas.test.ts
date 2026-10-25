import { forgotPasswordSchema, loginSchema, PASSWORD_RULES, resetPasswordSchema, signupSchema } from '@/features/auth/lib/auth-schemas'

/** Phase 10.2: validation rules and their boundaries. */

const signup = (overrides: Record<string, unknown> = {}) =>
  signupSchema.safeParse({ name: 'Alex', email: 'a@example.com', password: 'abcdefg1', confirmPassword: 'abcdefg1', acceptTerms: true, ...overrides })
const messages = (result: { success: boolean; error?: { issues: Array<{ message: string }> } }) => (result.success ? [] : (result.error?.issues ?? []).map((issue) => issue.message))

describe('auth schemas', () => {
  it('login: valid email and any non-empty password; trims the email', () => {
    expect(loginSchema.parse({ email: '  a@example.com ', password: 'x' }).email).toBe('a@example.com')
    expect(messages(loginSchema.safeParse({ email: '', password: '' }))).toEqual(['Enter your email address.', 'Enter your password.'])
    expect(messages(loginSchema.safeParse({ email: 'a@', password: 'x' }))[0]).toMatch(/valid email/)
  })

  it('email length limit is 254 characters', () => {
    const at254 = `${'a'.repeat(242)}@example.com`
    expect(at254).toHaveLength(254)
    expect(forgotPasswordSchema.safeParse({ email: at254 }).success).toBe(true)
    expect(messages(forgotPasswordSchema.safeParse({ email: `a${at254}` }))[0]).toMatch(/at most 254/)
  })

  it.each([
    ['abcdefg1', true],
    ['abcdef1', false], // 7 characters
    [`${'a'.repeat(127)}1`, true], // 128
    [`${'a'.repeat(128)}1`, false], // 129
    ['abcdefgh', false], // no number
    ['12345678', false], // no letter
    ['éèàüöäß1', true], // letters beyond ASCII
  ])('new password %s → %s', (password, ok) => {
    expect(signup({ password, confirmPassword: password }).success).toBe(ok)
    expect(resetPasswordSchema.safeParse({ password, confirmPassword: password }).success).toBe(ok)
    expect(PASSWORD_RULES.every((rule) => rule.test(password))).toBe(ok)
  })

  it('sign-up: name required and at most 80 characters; passwords must match; terms must be accepted', () => {
    expect(signup().success).toBe(true)
    expect(messages(signup({ name: '   ' }))).toContain('Enter your name.')
    expect(signup({ name: 'a'.repeat(80) }).success).toBe(true)
    expect(messages(signup({ name: 'a'.repeat(81) }))).toContain('Use at most 80 characters.')
    expect(messages(signup({ confirmPassword: 'abcdefg2' }))).toContain('The passwords don’t match.')
    expect(messages(signup({ acceptTerms: false }))).toContain('Accept the Terms of service and Privacy policy to continue.')
  })

  it('reset: confirm required and must match', () => {
    expect(messages(resetPasswordSchema.safeParse({ password: 'abcdefg1', confirmPassword: '' }))).toContain('Confirm your new password.')
    expect(messages(resetPasswordSchema.safeParse({ password: 'abcdefg1', confirmPassword: 'abcdefg2' }))).toContain('The passwords don’t match.')
  })
})
