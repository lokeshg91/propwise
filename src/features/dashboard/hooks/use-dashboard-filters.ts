import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { DEFAULT_FILTERS, parseFilters } from '@/features/dashboard/lib/dashboard-filters'
import { type DashboardFilters } from '@/types'

/** Dashboard filters stored in the URL (`?range=6m&type=commercial`), so views are shareable. */
export function useDashboardFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseFilters(params), [params])

  const setFilter = useCallback(
    <TKey extends keyof DashboardFilters>(key: TKey, value: DashboardFilters[TKey]) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          if (value === DEFAULT_FILTERS[key]) next.delete(key)
          else next.set(key, value)
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  return { filters, setFilter }
}
