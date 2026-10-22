import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

import { DEFAULT_VENDOR_FILTERS, parseVendorFilters, type VendorListFilters, vendorFilterParam } from '@/features/vendors/lib/vendor-list'

/** Listing filters stored in the URL so they survive navigation and refresh. */
export function useVendorListFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parseVendorFilters(params), [params])

  const setFilters = useCallback(
    (changes: Partial<VendorListFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const key of Object.keys(changes) as Array<keyof VendorListFilters>) {
            const value = vendorFilterParam(key, changes[key] as never)
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

  const clearFilters = useCallback(() => setFilters(DEFAULT_VENDOR_FILTERS), [setFilters])
  const hasFilters = (Object.keys(DEFAULT_VENDOR_FILTERS) as Array<keyof VendorListFilters>).some(
    (key) => filters[key] !== DEFAULT_VENDOR_FILTERS[key],
  )
  return { filters, setFilters, clearFilters, hasFilters }
}
