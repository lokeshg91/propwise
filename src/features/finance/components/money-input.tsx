import { type ComponentProps, useContext } from 'react'

import { Input } from '@/components/ui/input'
import { MoneyContext } from '@/features/finance/lib/money-context'
import { currencySymbol } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Amount input with the Finance currency symbol; the value stays a plain string until parsed. */
export function MoneyInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const format = useContext(MoneyContext)
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-muted-foreground" aria-hidden="true">
        {currencySymbol(format)}
      </span>
      <Input {...props} type="text" inputMode="decimal" autoComplete="off" className={cn('pl-8 tabular-nums', className)} />
    </div>
  )
}
