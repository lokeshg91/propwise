import { type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { useFormat } from '@/hooks/use-format'
import { symbolPadding } from '@/lib/symbol-padding'
import { cn } from '@/lib/utils'

/** Amount input with the workspace currency symbol; the value stays a plain string until parsed. */
export function MoneyInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { symbol } = useFormat()
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-body text-muted-foreground" aria-hidden="true">
        {symbol}
      </span>
      <Input {...props} type="text" inputMode="decimal" autoComplete="off" className={cn(symbolPadding(symbol, 'pl-8'), 'tabular-nums', className)} />
    </div>
  )
}
