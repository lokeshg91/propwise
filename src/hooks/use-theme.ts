import { use } from 'react'

import { ThemeContext, type ThemeContextValue } from '@/app/providers/theme-context'

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within <ThemeProvider>')
  }
  return context
}
