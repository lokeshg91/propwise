import { type CSSProperties, type ReactNode } from 'react'
import { Toaster } from 'sonner'

import { ThemeProvider } from '@/app/providers/theme-provider'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useTheme } from '@/hooks/use-theme'

const toasterStyle = {
  '--normal-bg': 'var(--popover)',
  '--normal-text': 'var(--popover-foreground)',
  '--normal-border': 'var(--border)',
  '--border-radius': 'var(--radius-lg)',
} as CSSProperties

function ThemedToaster() {
  const { resolvedTheme } = useTheme()
  return <Toaster theme={resolvedTheme} position="bottom-right" style={toasterStyle} />
}

interface AppProvidersProps {
  children: ReactNode
}

/** Global providers shared by every route. */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        {children}
        <ThemedToaster />
      </TooltipProvider>
    </ThemeProvider>
  )
}
