import { Skeleton } from '@/components/ui/skeleton'

/** Relative bar heights (percent) for the chart silhouette. */
const BAR_HEIGHTS = [42, 58, 50, 66, 54, 72, 61, 78, 69, 84, 74, 90] as const

export function BarChartPlaceholder() {
  return (
    <div className="flex h-64 flex-col gap-3" aria-hidden="true">
      <div className="relative flex flex-1 items-end gap-2 sm:gap-3">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
          {[0, 1, 2, 3].map((line) => (
            <div key={line} className="border-t border-dashed border-border" />
          ))}
        </div>
        {BAR_HEIGHTS.map((height, index) => (
          <Skeleton
            key={index}
            className="relative flex-1 rounded-t-md rounded-b-none"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-2">
        {BAR_HEIGHTS.map((_, index) => (
          <Skeleton key={index} className="h-2.5 flex-1" />
        ))}
      </div>
    </div>
  )
}

export function DonutChartPlaceholder() {
  return (
    <div className="flex flex-col items-center gap-6" aria-hidden="true">
      <div className="relative flex size-40 items-center justify-center">
        <Skeleton className="absolute inset-0 rounded-full" />
        <div className="size-24 rounded-full bg-card" />
      </div>
      <div className="w-full space-y-3">
        {['w-24', 'w-20', 'w-28'].map((width) => (
          <div key={width} className="flex items-center gap-3">
            <Skeleton className="size-2.5 rounded-full" />
            <Skeleton className={`h-3 ${width}`} />
            <Skeleton className="ml-auto h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
