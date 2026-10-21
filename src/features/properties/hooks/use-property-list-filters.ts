import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { DEFAULT_LIST_FILTERS, parseListFilters, type PropertyListFilters } from '@/features/properties/lib/property-list'

/** Listing filters stored in the URL so they survive navigation and refresh. */
export function usePropertyListFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseListFilters(params), [params])

  const setFilters = useCallback(
    (changes: Partial<PropertyListFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === DEFAULT_LIST_FILTERS[key as keyof PropertyListFilters]) next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => setFilters(DEFAULT_LIST_FILTERS), [setFilters])
  const hasFilters = filters.q !== '' || filters.type !== 'all' || filters.status !== 'all'

  return { filters, setFilters, clearFilters, hasFilters }
}
