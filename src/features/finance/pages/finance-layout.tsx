import { Outlet, useLoaderData } from 'react-router'

import { MoneyProvider } from '@/features/finance/components/money-provider'
import { type financeLayoutLoader } from '@/features/finance/finance.loaders'

/** Provides the Finance currency to every Finance page. */
export function FinanceLayout() {
  const { settings } = useLoaderData<typeof financeLayoutLoader>()
  return (
    <MoneyProvider settings={settings}>
      <Outlet />
    </MoneyProvider>
  )
}
