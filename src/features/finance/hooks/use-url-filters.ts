import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'

/** Filters kept in the URL so views survive navigation, refresh and sharing. */
export function useUrlFilters<T extends Record<string, string | boolean>>(defaults: T, parse: (params: URLSearchParams) => T) {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => parse(params), [params, parse])

  const setFilters = useCallback(
    (changes: Partial<T>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined) continue
            if (value === defaults[key]) next.delete(key)
            else next.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : value)
          }
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams, defaults],
  )

  const clearFilters = useCallback(() => setFilters(defaults), [setFilters, defaults])
  const hasFilters = (Object.keys(defaults) as Array<keyof T>).some((key) => filters[key] !== defaults[key])
  return { filters, setFilters, clearFilters, hasFilters }
}
