import { type ReactNode, useSyncExternalStore } from 'react'

import { FormatContext } from '@/app/providers/format-context'
import { readFormatters, subscribeSettings } from '@/data/services/settings-service'
import { createFormatters, DEFAULT_FORMAT } from '@/lib/formatters'

/**
 * Provides the workspace currency and region to every page. It follows the
 * store directly, so a saved settings change shows everywhere at once
 * without reloading.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const formatters = useSyncExternalStore(subscribeSettings, readFormatters, readFormatters)
  return <FormatContext value={formatters}>{children}</FormatContext>
}

/**
 * Fixed USD / en-US formatting for a subtree. The Dashboard is rendered
 * inside it: its sample data and appearance never follow the settings.
 */
export function FixedFormatProvider({ children }: { children: ReactNode }) {
  return <FormatContext value={createFormatters(DEFAULT_FORMAT)}>{children}</FormatContext>
}
