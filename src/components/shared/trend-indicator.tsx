import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react'

import { cn } from '@/lib/utils'

interface TrendIndicatorProps {
  /** Signed change; its sign decides the direction. */
  change: number
  /** Pre-formatted change text, e.g. "+4.7%". */
  label: string
  /** Comparison context, e.g. "vs last month". */
  context?: string
  /** Set when a decrease is the good outcome (e.g. vacancies). */
  inverse?: boolean
  className?: string
}

/** Up/down change indicator. Direction is shown by icon and sign, not colour alone. */
export function TrendIndicator({ change, label, context, inverse = false, className }: TrendIndicatorProps) {
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const positive = direction === 'flat' ? null : (direction === 'up') !== inverse
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : ArrowRight

  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption', className)}>
      <span
        className={cn(
          'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-semibold tabular-nums',
          positive === true && 'bg-success/10 text-success dark:bg-success/15',
          positive === false && 'bg-danger/10 text-danger dark:bg-danger/15',
          positive === null && 'bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        <span className="sr-only">{direction === 'up' ? 'Up' : direction === 'down' ? 'Down' : 'No change'}</span>
        {label}
      </span>
      {context ? <span className="text-muted-foreground">{context}</span> : null}
    </p>
  )
}
