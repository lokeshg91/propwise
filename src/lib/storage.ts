/**
 * Safe wrappers around `localStorage`. Access can throw in private browsing
 * modes or when storage is disabled, so every call is guarded.
 */
export function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Returns false when the browser refused the write (storage full or disabled). */
export function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // Nothing to remove when storage is unavailable.
  }
}

/** Namespaced keys for every value Propwise keeps in the browser. */
export const STORAGE_KEYS = {
  theme: 'propwise-theme',
  sidebarCollapsed: 'propwise-sidebar-collapsed',
  demoData: 'propwise-demo-data',
  /** Demo sign-in state: absent = signed in (the default); set only after Sign out. */
  session: 'propwise-session',
} as const
