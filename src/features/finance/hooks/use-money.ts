import { useCallback, useContext } from 'react'

import { MoneyContext } from '@/features/finance/lib/money-context'
import { formatMoney } from '@/lib/format'

/** Formats cents in the Finance currency, e.g. `money(125050)` → "$1,250.50". */
export function useMoney() {
  const format = useContext(MoneyContext)
  return useCallback((cents: number, options?: { compact?: boolean; whole?: boolean }) => formatMoney(cents, format, options), [format])
}
