import { readStorage, STORAGE_KEYS } from '@/lib/storage'

export const THEMES = ['light', 'dark', 'system'] as const

export type Theme = (typeof THEMES)[number]
export type ResolvedTheme = Exclude<Theme, 'system'>

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}

export function readStoredTheme(): Theme {
  const stored = readStorage(STORAGE_KEYS.theme)
  return isTheme(stored) ? stored : 'system'
}

export function getSystemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
}

export function subscribeToSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia(DARK_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function resolveTheme(theme: Theme, systemTheme: ResolvedTheme): ResolvedTheme {
  return theme === 'system' ? systemTheme : theme
}

/**
 * Applies the resolved theme to `<html>`. Transitions are suspended for one
 * frame so surfaces switch together instead of animating individually.
 *
 * The same logic runs before first paint in the inline script in
 * `index.html` to prevent a flash of the wrong theme.
 */
export function applyTheme(theme: ResolvedTheme): void {
  const root = document.documentElement
  root.classList.add('theme-switching')
  root.classList.toggle('dark', theme === 'dark')
  root.style.colorScheme = theme

  window.requestAnimationFrame(() => {
    root.classList.remove('theme-switching')
  })
}
