import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import {
  DEFAULT_REQUEST_FILTERS,
  filterParam,
  parseRequestFilters,
  type RequestListFilters,
} from '@/features/maintenance/lib/request-list'

/** Listing filters stored in the URL so they survive navigation and refresh. */
export function useRequestListFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseRequestFilters(params), [params])

  const setFilters = useCallback(
    (changes: Partial<RequestListFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const key of Object.keys(changes) as Array<keyof RequestListFilters>) {
            const value = filterParam(key, changes[key] as never)
            if (value === null) next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => setFilters(DEFAULT_REQUEST_FILTERS), [setFilters])
  const hasFilters = (Object.keys(DEFAULT_REQUEST_FILTERS) as Array<keyof RequestListFilters>).some(
    (key) => filters[key] !== DEFAULT_REQUEST_FILTERS[key],
  )

  return { filters, setFilters, clearFilters, hasFilters }
}
