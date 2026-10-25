/**
 * DEMO ONLY: replace with tokens issued and verified by your auth provider.
 *
 * Propwise has no server, so the "link from the email" on the check-email page
 * carries a made-up token. It is created in memory when you press the demo
 * button, checked only for its shape, never saved anywhere, and removed from
 * the address bar as soon as the page has read it.
 */

export type DemoTokenKind = 'reset' | 'verify'

const PATTERN = /^demo-(reset|verify)-[0-9a-f]{16}$/

export function createDemoToken(kind: DemoTokenKind): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return `demo-${kind}-${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** True when `token` has the demo shape for this kind of link. Nothing else is checked: there is nothing to check against. */
export function isDemoToken(token: unknown, kind: DemoTokenKind): token is string {
  if (typeof token !== 'string') return false
  const match = PATTERN.exec(token)
  return match !== null && match[1] === kind
}

/** The demo link a real email would contain, e.g. `/reset-password?token=demo-reset-…`. */
export function demoLinkFor(kind: DemoTokenKind, next?: string): string {
  const path = kind === 'reset' ? '/reset-password' : '/verify-email'
  const params = new URLSearchParams({ token: createDemoToken(kind) })
  if (next) params.set('next', next)
  return `${path}?${params.toString()}`
}
