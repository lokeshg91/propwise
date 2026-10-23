import { Info } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { MIN_JOBS_FOR_RATES, type VendorPerformance } from '@/data/domain/vendor-rules'
import { basedOnLabel, formatOnTime, formatResolution, formatSpend, formatVariance } from '@/features/vendors/lib/vendor-meta'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

/**
 * Performance with the calculation basis next to each figure. A metric
 * without enough eligible jobs shows "Not enough data", never 0.
 */
export function VendorPerformanceCard({ performance }: { performance: VendorPerformance }) {
  const { amount, date: formatDate, percent } = useFormat()
  const items = [
    {
      label: 'On-time rate',
      value: formatOnTime(performance.onTimeRate, percent),
      basis: performance.onTimeRate,
      help: 'Completed by the request’s resolution target ÷ eligible completed jobs. Reopened requests are excluded.',
    },
    {
      label: 'Average resolution',
      value: formatResolution(performance.averageResolutionHours),
      basis: performance.averageResolutionHours,
      help: 'From assignment to completion.',
    },
    {
      label: 'Total spend',
      value: formatSpend(performance.totalSpend, amount),
      basis: performance.totalSpend,
      help: 'Final cost of completed jobs.',
    },
    {
      label: 'Cost vs estimate',
      value: formatVariance(performance.costVsEstimate),
      basis: performance.costVsEstimate,
      help: 'Only jobs with both an estimate and a final cost.',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <CardDescription>Based on work orders in Propwise</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:gap-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:gap-y-4 xl:grid-cols-1 2xl:grid-cols-2">
          {items.map((item) => {
            const missing = item.basis.value === null
            return (
              <div key={item.label} className="min-w-0">
                <dt className="text-caption text-muted-foreground">{item.label}</dt>
                <dd className={cn('mt-0.5 tabular-nums', missing ? 'text-body text-muted-foreground' : 'text-h3 text-foreground')}>{item.value}</dd>
                <dd className="text-caption text-muted-foreground" title={item.help}>
                  {basedOnLabel(item.basis.basedOn)}
                </dd>
              </div>
            )
          })}
          <div className="col-span-2 min-w-0 border-t border-border pt-3 xl:col-span-1 xl:border-0 xl:pt-0 2xl:col-span-2">
            <dt className="text-caption text-muted-foreground">Last job</dt>
            <dd className={cn('mt-0.5', performance.lastJob ? 'text-h3 text-foreground' : 'text-body text-muted-foreground')}>
              {performance.lastJob ? formatDate(performance.lastJob.completedAt.slice(0, 10)) : 'Not enough data'}
            </dd>
            <dd className="text-caption text-muted-foreground">
              {performance.lastJob ? (
                <Link to={`/maintenance/${performance.lastJob.requestId}`} className="text-primary underline-offset-4 hover:underline">
                  {performance.lastJob.requestId}
                </Link>
              ) : (
                'No completed jobs yet'
              )}
            </dd>
          </div>
        </dl>
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          Rates and averages need at least {MIN_JOBS_FOR_RATES} eligible jobs. On-time compares completion with the request’s resolution target; cost vs estimate uses only jobs with both values.
        </p>
      </CardContent>
    </Card>
  )
}
