import { type ReactNode, useMemo } from 'react'

import { type FinanceSettings } from '@/types'
import { MoneyContext } from '@/features/finance/lib/money-context'

/** Provides the Finance currency to Finance views shown outside the Finance section (tenant and property tabs). */
export function MoneyProvider({ settings, children }: { settings: Pick<FinanceSettings, 'currency' | 'locale'>; children: ReactNode }) {
  const money = useMemo(() => ({ currency: settings.currency, locale: settings.locale }), [settings.currency, settings.locale])
  return <MoneyContext value={money}>{children}</MoneyContext>
}
