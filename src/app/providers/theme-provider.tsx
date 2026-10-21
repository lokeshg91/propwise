import { type ReactNode, useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'

import { ThemeContext, type ThemeContextValue } from '@/app/providers/theme-context'
import { STORAGE_KEYS, writeStorage } from '@/lib/storage'
import {
  applyTheme,
  getSystemTheme,
  isTheme,
  readStoredTheme,
  resolveTheme,
  subscribeToSystemTheme,
  type Theme,
} from '@/lib/theme'

interface ThemeProviderProps {
  children: ReactNode
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const systemTheme = useSyncExternalStore(subscribeToSystemTheme, getSystemTheme, () => 'light' as const)
  const resolvedTheme = resolveTheme(theme, systemTheme)

  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Keep multiple open tabs in sync.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEYS.theme) {
        setThemeState(isTheme(event.newValue) ? event.newValue : 'system')
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    writeStorage(STORAGE_KEYS.theme, next)
    setThemeState(next)
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme],
  )

  return <ThemeContext value={value}>{children}</ThemeContext>
}
