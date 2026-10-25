import { createDemoToken, demoLinkFor, isDemoToken } from '@/features/auth/lib/demo-tokens'

/** Phase 10.2: demo email-link tokens are made-up, shape-checked and never stored. */

describe('demo tokens', () => {
  it('have a clearly non-production shape and are unique', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => createDemoToken('reset')))
    expect(tokens.size).toBe(50)
    for (const token of tokens) expect(token).toMatch(/^demo-reset-[0-9a-f]{16}$/)
    expect(createDemoToken('verify')).toMatch(/^demo-verify-[0-9a-f]{16}$/)
  })

  it('are accepted only for their own kind and shape', () => {
    const reset = createDemoToken('reset')
    expect(isDemoToken(reset, 'reset')).toBe(true)
    expect(isDemoToken(reset, 'verify')).toBe(false)
    for (const bad of [null, undefined, '', 'demo-reset-', 'demo-reset-0123456789abcdeg', 'demo-reset-0123456789ABCDEF', 'reset-0123456789abcdef', `${reset}x`, ` ${reset}`, 'eyJhbGciOiJIUzI1NiJ9.e30.x'])
      expect(isDemoToken(bad, 'reset')).toBe(false)
  })

  it('build the demo link with the token and the next page', () => {
    const link = new URL(demoLinkFor('verify', '/finance'), 'https://propwise.invalid')
    expect(link.pathname).toBe('/verify-email')
    expect(isDemoToken(link.searchParams.get('token'), 'verify')).toBe(true)
    expect(link.searchParams.get('next')).toBe('/finance')
    expect(new URL(demoLinkFor('reset'), 'https://propwise.invalid').pathname).toBe('/reset-password')
  })

  it('are never written to browser storage', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem')
    createDemoToken('reset')
    demoLinkFor('verify', '/x')
    expect(local).not.toHaveBeenCalled()
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
    local.mockRestore()
  })
})
