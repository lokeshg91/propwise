import { type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'
import { useFormat } from '@/hooks/use-format'
import { symbolPadding } from '@/lib/symbol-padding'

/** Number input with the workspace currency symbol as a prefix (whole-currency amounts). */
export function CurrencyInput(props: ComponentProps<typeof Input>) {
  const { symbol } = useFormat()
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground" aria-hidden="true">
        {symbol}
      </span>
      <Input {...props} type="number" inputMode="decimal" min={0} step="any" className={symbolPadding(symbol, 'pl-7')} />
    </div>
  )
}
