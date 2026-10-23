import { useCallback } from 'react'
import { useSearchParams } from 'react-router'

import { type ReportFilters } from '@/data/services'
import { rangeParams } from '@/features/reports/lib/report-filters'

/** Writes filter changes to the URL (the loader re-runs the report). */
export function useReportParams() {
  const [, setParams] = useSearchParams()
  const set = useCallback(
    (changes: Record<string, string | null>) =>
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === null || value === '' || value === 'all') next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { preventScrollReset: true },
      ),
    [setParams],
  )
  const setFilters = useCallback(
    (changes: Partial<ReportFilters>) =>
      set({
        ...(changes.range ? rangeParams(changes.range) : {}),
        ...(changes.propertyType !== undefined ? { type: changes.propertyType } : {}),
        ...(changes.propertyId !== undefined ? { property: changes.propertyId } : {}),
        ...(changes.source !== undefined ? { source: changes.source } : {}),
      }),
    [set],
  )
  return { set, setFilters }
}
