import { readStorage, removeStorage, STORAGE_KEYS, writeStorage } from '@/lib/storage'

/**
 * Demo session (Phase 10.2). DEMO ONLY: Propwise has no accounts or server, so
 * "signed in" is a flag in this browser, not authentication.
 *
 * - No stored value means signed in, so a fresh browser, deep links and
 *   existing demos open the app as before.
 * - Sign out stores `{ status: 'signed-out', at }`; sign in removes it.
 * - Nothing else is stored: no name, email, password or token.
 */

export interface SignedOutRecord {
  status: 'signed-out'
  at: string
}

const EVENT = 'propwise:session'

export function isSignedIn(): boolean {
  const raw = readStorage(STORAGE_KEYS.session)
  if (raw === null) return true
  try {
    const value = JSON.parse(raw) as Partial<SignedOutRecord> | null
    return !(value && value.status === 'signed-out')
  } catch {
    return true
  }
}

const notify = () => window.dispatchEvent(new Event(EVENT))

// True when the current sign-out was made in this tab (the user chose Sign out here), so the app
// goes to plain sign-in instead of offering to return to the page; other tabs keep their page.
let signedOutHere = false

export const signedOutInThisTab = () => signedOutHere

/** Clears the signed-out flag. Returns false when the browser refused the change. */
export function signIn(): boolean {
  signedOutHere = false
  removeStorage(STORAGE_KEYS.session)
  const ok = readStorage(STORAGE_KEYS.session) === null
  notify()
  return ok
}

/** Stores the signed-out flag. Returns false (and stays signed in) when the browser refused the write. */
export function signOut(now: Date = new Date()): boolean {
  const record: SignedOutRecord = { status: 'signed-out', at: now.toISOString() }
  const ok = writeStorage(STORAGE_KEYS.session, JSON.stringify(record))
  signedOutHere = ok
  notify()
  return ok
}

/** Calls `onChange` when the session changes in this tab or another one. */
export function subscribeSession(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEYS.session) return
    signedOutHere = false
    onChange()
  }
  window.addEventListener(EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}
