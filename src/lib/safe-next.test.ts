import { DEFAULT_NEXT, loginPathFor, safeNext } from '@/lib/safe-next'

/** Phase 10.2: the `?next=` redirect after signing in accepts only paths inside the app. */

const ACCEPTED: Array<[string, string]> = [
  ['/finance', '/finance'],
  ['/dashboard', '/dashboard'],
  ['/tenants/ten_u_unit_101_101?tab=lease', '/tenants/ten_u_unit_101_101?tab=lease'],
  ['/reports/income-expense?range=custom&from=2026-02-15&to=2026-05-10#x', '/reports/income-expense?range=custom&from=2026-02-15&to=2026-05-10#x'],
  ['/settings?tab=data', '/settings?tab=data'],
  ['/a%20b', '/a%20b'],
  ['/@evil.com', '/@evil.com'], // stays inside the app (a 404 page), never another host
  ['/finance/../settings', '/settings'],
  ['/./finance', '/finance'],
  ['/finance?next=//evil.com', '/finance?next=//evil.com'], // a query value is just data for that page
]

const REJECTED: Array<[string, unknown]> = [
  // External hosts.
  ['protocol-relative', '//evil.com'],
  ['triple slash', '///evil.com'],
  ['slash backslash', '/\\evil.com'],
  ['double backslash', '\\\\evil.com'],
  ['absolute https', 'https://evil.com'],
  ['upper-case scheme', 'HTTPS://evil.com'],
  ['scheme without slashes', 'http:evil.com'],
  ['protocol-relative with dots', '//evil.com/%2e%2e'],
  ['no leading slash', 'evil.com/path'],
  ['relative path', 'finance'],
  // Encoded.
  ['encoded double slash', '%2F%2Fevil.com'],
  ['slash + encoded slash', '/%2F%2Fevil.com'],
  ['slash + encoded slash (lower)', '/%2f/evil.com'],
  ['double-encoded slashes', '%252F%252Fevil.com'],
  ['slash + double-encoded slash', '/%252F/evil.com'],
  ['encoded backslash', '/%5Cevil.com'],
  ['encoded double backslash', '%5C%5Cevil.com'],
  ['encoded scheme colon', 'javascript%3Aalert(1)'],
  ['encoded scheme letter', '%6Aavascript:alert(1)'],
  ['deep encoding (4 rounds)', '%25252F%25252Fevil.com'],
  ['deep encoding (5 rounds)', '/%2525252F%2525252Fevil.com'],
  // Schemes.
  ['javascript', 'javascript:alert(1)'],
  ['javascript with leading space', ' JavaScript:alert(1)'],
  ['data', 'data:text/html,<script>alert(1)</script>'],
  ['vbscript', 'vbscript:msgbox(1)'],
  ['mixed-case javascript', 'JaVaScRiPt:alert(1)'],
  // Control characters and whitespace.
  ['tab inside', '/\t/evil.com'],
  ['encoded tab', '/%09/evil.com'],
  ['encoded CR LF', '/%0d%0aSet-Cookie:x'],
  ['encoded NUL', '/%00'],
  ['raw newline', '/finance\n'],
  ['DEL', '/fin\u007fance'],
  ['leading space', ' /finance'],
  ['trailing space', '/finance '],
  // Malformed.
  ['lone percent', '%'],
  ['bad escape', '/%zz'],
  ['truncated UTF-8', '/%E0%A4%A'],
  ['empty', ''],
  ['null', null],
  ['undefined', undefined],
  ['number', 42],
  ['object', { path: '/finance' }],
  ['too long', `/${'a'.repeat(2048)}`],
  // Loops.
  ['login', '/login'],
  ['login with next', '/login?next=/finance'],
  ['signup', '/signup'],
  ['forgot password', '/forgot-password'],
  ['check email', '/check-email'],
  ['reset password', '/reset-password?token=demo-reset-0123456789abcdef'],
  ['verify email', '/verify-email'],
  ['auth sub-path', '/login/extra'],
]

describe('safeNext', () => {
  it.each(ACCEPTED)('keeps %s', (input, expected) => {
    expect(safeNext(input)).toBe(expected)
  })

  it.each(REJECTED)('falls back to the Dashboard: %s', (_name, input) => {
    expect(safeNext(input)).toBe(DEFAULT_NEXT)
  })

  it('has more than 40 rejection cases', () => {
    expect(REJECTED.length).toBeGreaterThan(40)
  })

  it('always returns a same-app path', () => {
    for (const [, input] of [...REJECTED, ...ACCEPTED.map(([value]) => ['', value] as [string, unknown])]) {
      const result = safeNext(input)
      expect(result.startsWith('/')).toBe(true)
      expect(result.startsWith('//')).toBe(false)
      expect(new URL(result, 'https://propwise.invalid').origin).toBe('https://propwise.invalid')
    }
  })
})

describe('loginPathFor', () => {
  it('keeps the requested page, encoded, and drops unsafe or default ones', () => {
    expect(loginPathFor('/finance/transactions?range=custom&from=2026-09-01&to=2026-09-30')).toBe(
      `/login?next=${encodeURIComponent('/finance/transactions?range=custom&from=2026-09-01&to=2026-09-30')}`,
    )
    expect(loginPathFor('/dashboard')).toBe('/login')
    expect(loginPathFor('//evil.com')).toBe('/login')
  })
})
