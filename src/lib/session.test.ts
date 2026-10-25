import { isSignedIn, signedOutInThisTab, signIn, signOut, subscribeSession } from '@/lib/session'
import { STORAGE_KEYS } from '@/lib/storage'

/** Phase 10.2: the demo session flag. */

afterEach(() => vi.restoreAllMocks())

describe('demo session', () => {
  it('is signed in by default (no stored value)', () => {
    expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    expect(isSignedIn()).toBe(true)
  })

  it('stores only the signed-out status and time on sign out, and removes it on sign in', () => {
    expect(signOut(new Date('2026-10-23T10:00:00.000Z'))).toBe(true)
    expect(isSignedIn()).toBe(false)
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.session) ?? '')).toEqual({ status: 'signed-out', at: '2026-10-23T10:00:00.000Z' })
    expect(signIn()).toBe(true)
    expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    expect(isSignedIn()).toBe(true)
  })

  it('treats an unreadable value as signed in (never locks the demo)', () => {
    window.localStorage.setItem(STORAGE_KEYS.session, 'not json')
    expect(isSignedIn()).toBe(true)
  })

  it('reports a refused write and stays signed in', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    expect(signOut()).toBe(false)
    expect(isSignedIn()).toBe(true)
  })

  it('notifies subscribers in this tab and on storage events from other tabs', () => {
    const onChange = vi.fn()
    const unsubscribe = subscribeSession(onChange)
    signOut()
    expect(onChange).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.session }))
    expect(onChange).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.theme }))
    expect(onChange).toHaveBeenCalledTimes(2)
    unsubscribe()
    signIn()
    expect(onChange).toHaveBeenCalledTimes(2)
  })

  it('remembers whether the sign-out happened in this tab (another tab’s sign-out arrives as a storage event)', () => {
    signOut()
    expect(signedOutInThisTab()).toBe(true)
    signIn()
    expect(signedOutInThisTab()).toBe(false)
    const unsubscribe = subscribeSession(() => undefined)
    signOut()
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.session }))
    expect(signedOutInThisTab()).toBe(false)
    unsubscribe()
  })

  it('never stores anything else under any key', () => {
    signOut()
    signIn()
    signOut()
    expect(Object.keys(window.localStorage)).toEqual([STORAGE_KEYS.session])
    expect(window.sessionStorage.length).toBe(0)
  })
})
