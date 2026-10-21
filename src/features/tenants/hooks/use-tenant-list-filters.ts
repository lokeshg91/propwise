import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { DEFAULT_TENANT_FILTERS, parseTenantFilters, type TenantListFilters } from '@/features/tenants/lib/tenant-list'

/** Listing filters stored in the URL so they survive navigation and refresh. */
export function useTenantListFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseTenantFilters(params), [params])

  const setFilters = useCallback(
    (changes: Partial<TenantListFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === DEFAULT_TENANT_FILTERS[key as keyof TenantListFilters]) next.delete(key)
            else next.set(key, value)
          }
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => setFilters(DEFAULT_TENANT_FILTERS), [setFilters])
  const hasFilters = filters.q !== '' || filters.status !== 'all' || filters.lease !== 'all'

  return { filters, setFilters, clearFilters, hasFilters }
}
