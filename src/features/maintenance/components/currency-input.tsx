import { type ComponentProps } from 'react'

import { Input } from '@/components/ui/input'

/** Number input with a "$" prefix. */
export function CurrencyInput(props: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground" aria-hidden="true">
        $
      </span>
      <Input {...props} type="number" inputMode="decimal" min={0} step="any" className="pl-7" />
    </div>
  )
}
