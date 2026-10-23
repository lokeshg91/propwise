
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

/** Inline occupancy bar; amber below 88% to flag attention. */
export function OccupancyMeter({ rate, className }: { rate: number; className?: string }) {
  return (
    <span className={cn('h-1.5 overflow-hidden rounded-full bg-muted', className)} aria-hidden="true">
      <span
        className={cn('block h-full rounded-full', rate < 88 ? 'bg-chart-3' : 'bg-primary')}
        style={{ width: `${Math.min(100, rate)}%` }}
      />
    </span>
  )
}

export function OccupancyValue({ rate }: { rate: number }) {
  const { percent: formatPercent } = useFormat()
  return <span className="font-medium text-foreground tabular-nums">{formatPercent(rate)}</span>
}
