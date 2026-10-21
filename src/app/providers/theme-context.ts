import { createContext } from 'react'

import { type ResolvedTheme, type Theme } from '@/lib/theme'

export interface ThemeContextValue {
  /** The user's preference: light, dark or system. */
  theme: Theme
  /** The theme actually applied after resolving `system`. */
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
