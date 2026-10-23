import { useContext } from 'react'

import { FormatContext } from '@/app/providers/format-context'
import { type Formatters } from '@/lib/formatters'

/** Formatters for the workspace currency and region. The Dashboard always gets the fixed defaults. */
export function useFormat(): Formatters {
  return useContext(FormatContext)
}
