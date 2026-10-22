import { createContext } from 'react'

import { DEFAULT_CURRENCY, type MoneyFormat } from '@/lib/format'

/** Currency and locale from Finance settings, provided by the Finance layout. */
export const MoneyContext = createContext<MoneyFormat>(DEFAULT_CURRENCY)
