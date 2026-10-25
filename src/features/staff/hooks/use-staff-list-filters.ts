import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { DEFAULT_STAFF_FILTERS, parseStaffFilters, staffFilterParam, type StaffListFilters } from '@/features/staff/lib/staff-list'

/** Directory filters stored in the URL so they survive navigation and refresh. */
export function useStaffListFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseStaffFilters(params), [params])

  const setFilters = useCallback(
    (changes: Partial<StaffListFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const key of Object.keys(changes) as Array<keyof StaffListFilters>) {
            const value = staffFilterParam(key, changes[key] as never)
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

  const clearFilters = useCallback(() => setFilters(DEFAULT_STAFF_FILTERS), [setFilters])
  const hasFilters = (Object.keys(DEFAULT_STAFF_FILTERS) as Array<keyof StaffListFilters>).some((key) => filters[key] !== DEFAULT_STAFF_FILTERS[key])
  return { filters, setFilters, clearFilters, hasFilters }
}
