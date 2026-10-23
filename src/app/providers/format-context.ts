import { createContext } from 'react'

import { createFormatters, DEFAULT_FORMAT, type Formatters } from '@/lib/formatters'

/** Money, number and date formatters for the workspace currency and region (see `SettingsProvider`). */
export const FormatContext = createContext<Formatters>(createFormatters(DEFAULT_FORMAT))
