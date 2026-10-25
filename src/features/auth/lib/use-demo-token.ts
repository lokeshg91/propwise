import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { isDemoToken, type DemoTokenKind } from '@/features/auth/lib/demo-tokens'

export type DemoTokenStatus = 'missing' | 'valid' | 'invalid'

/**
 * Reads the demo link's token, then removes it from the address bar, so the
 * link works only once: a refresh or Back no longer carries it. The token is
 * kept in component state only, never in storage.
 */
export function useDemoToken(kind: DemoTokenKind, path: string): DemoTokenStatus {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const evaluate = (value: string | null): DemoTokenStatus => (value === null ? 'missing' : isDemoToken(value, kind) ? 'valid' : 'invalid')
  const [seen, setSeen] = useState(() => ({ token, status: evaluate(token) }))
  // A new link opened while this page is showing (for example "open a new link"): evaluate it.
  if (token !== null && token !== seen.token) setSeen({ token, status: evaluate(token) })

  useEffect(() => {
    if (token === null) return
    const rest = new URLSearchParams(params)
    rest.delete('token')
    const query = rest.toString()
    void navigate(query ? `${path}?${query}` : path, { replace: true })
  }, [token, params, navigate, path])

  return token !== null && token !== seen.token ? evaluate(token) : seen.status
}
