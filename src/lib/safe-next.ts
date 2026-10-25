/**
 * The page to return to after signing in (`?next=`). Only a path inside this
 * app is accepted; anything else — another site, a scheme, an encoded or
 * malformed value, an auth page — falls back to the Dashboard.
 */

export const DEFAULT_NEXT = '/dashboard'

/** Auth pages: returning to one after signing in would loop. */
export const AUTH_PATHS = ['/login', '/signup', '/forgot-password', '/check-email', '/reset-password', '/verify-email'] as const

const MAX_LENGTH = 2048
const BASE = 'https://propwise.invalid'
// Control characters (including tab, CR, LF, NUL and DEL) or a backslash: browsers treat these unpredictably in URLs.
// eslint-disable-next-line no-control-regex
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\\]/
// A scheme before the first slash, e.g. "javascript:", "https:", "data:".
const SCHEME = /^[a-z][a-z0-9+.-]*:/i

/** Every decoding stage of `value` (at most 3 rounds), or null when malformed or still encoded after 3 rounds. */
function decodingStages(value: string): string[] | null {
  const stages = [value]
  let current = value
  for (let round = 0; round < 3; round += 1) {
    let decoded: string
    try {
      decoded = decodeURIComponent(current)
    } catch {
      return null
    }
    if (decoded === current) return stages
    stages.push(decoded)
    current = decoded
  }
  // Still changing after three rounds: deliberately deep encoding.
  try {
    return decodeURIComponent(current) === current ? stages : null
  } catch {
    return null
  }
}

const isSafeStage = (stage: string) =>
  !UNSAFE_CHARS.test(stage) && !SCHEME.test(stage.trimStart()) && stage.startsWith('/') && !stage.startsWith('//')

export function safeNext(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) return DEFAULT_NEXT
  if (raw !== raw.trim()) return DEFAULT_NEXT
  const stages = decodingStages(raw)
  if (!stages || !stages.every(isSafeStage)) return DEFAULT_NEXT

  let url: URL
  try {
    url = new URL(raw, BASE)
  } catch {
    return DEFAULT_NEXT
  }
  if (url.origin !== BASE) return DEFAULT_NEXT
  const path = url.pathname
  if (!path.startsWith('/') || path.startsWith('//')) return DEFAULT_NEXT
  if (AUTH_PATHS.some((auth) => path === auth || path.startsWith(`${auth}/`))) return DEFAULT_NEXT
  return `${path}${url.search}${url.hash}`
}

/** `/login?next=…` for a protected page, keeping its path, query and hash. */
export function loginPathFor(next: string): string {
  const safe = safeNext(next)
  return safe === DEFAULT_NEXT ? '/login' : `/login?next=${encodeURIComponent(safe)}`
}
