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

export function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // Storage is unavailable; the preference simply won't persist.
  }
}

/** Namespaced keys for every value Propwise keeps in the browser. */
export const STORAGE_KEYS = {
  theme: 'propwise-theme',
  sidebarCollapsed: 'propwise-sidebar-collapsed',
} as const
