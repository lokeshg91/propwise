import { useSearchParams } from 'react-router'

import { DEFAULT_NEXT, safeNext } from '@/lib/safe-next'

/** The safe `?next=` page for the auth flows, and a helper that builds auth links that carry it along. */
export function useNext() {
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const withNext = (path: string, extra: Record<string, string> = {}) => {
    const search = new URLSearchParams(extra)
    if (next !== DEFAULT_NEXT) search.set('next', next)
    const query = search.toString()
    return query ? `${path}?${query}` : path
  }
  return { next, withNext }
}
