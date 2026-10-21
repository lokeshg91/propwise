import { Cell, Pie, PieChart, Tooltip, type TooltipContentProps } from 'recharts'

import { CHART_COLORS } from '@/components/charts/chart-theme'
import { ChartTooltipCard } from '@/components/charts/chart-tooltip-card'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PROPERTY_TYPE_LABELS } from '@/features/dashboard/lib/dashboard-filters'
import { formatNumber, formatPercent } from '@/lib/format'
import { type OccupancyBreakdown } from '@/types'

interface Segment {
  key: 'occupied' | 'vacant' | 'maintenance'
  label: string
  value: number
  color: string
}

export function OccupancyCard({ breakdown }: { breakdown: OccupancyBreakdown }) {
  const { total } = breakdown
  const share = (value: number) => (total === 0 ? 0 : (value / total) * 100)
  const segments: Segment[] = [
    { key: 'occupied', label: 'Occupied', value: breakdown.occupied, color: CHART_COLORS.primary },
    { key: 'vacant', label: 'Vacant', value: breakdown.vacant, color: CHART_COLORS.neutral },
    { key: 'maintenance', label: 'Under maintenance', value: breakdown.maintenance, color: CHART_COLORS.tertiary },
  ]
  const occupancyRate = share(breakdown.occupied)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy overview</CardTitle>
        <CardDescription>{formatNumber(total)} units across the selected portfolio</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 md:max-lg:grid md:max-lg:grid-cols-[auto_1fr] md:max-lg:items-center md:max-lg:gap-x-10">
        <div className="relative mx-auto size-44 md:max-lg:row-span-2">
          <PieChart width={176} height={176} accessibilityLayer>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              innerRadius={60}
              outerRadius={86}
              paddingAngle={2}
              cornerRadius={4}
              stroke="none"
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {segments.map((segment) => (
                <Cell key={segment.key} fill={segment.color} />
              ))}
            </Pie>
            <Tooltip content={(props) => <OccupancyTooltip {...props} total={total} />} />
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-h1 text-foreground tabular-nums">{formatPercent(occupancyRate)}</span>
            <span className="text-caption text-muted-foreground">occupied</span>
          </div>
        </div>

        <ul className="space-y-2.5" aria-label="Unit status">
          {segments.map((segment) => (
            <li key={segment.key} className="flex items-center gap-3 text-body">
              <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: segment.color }} aria-hidden="true" />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="ml-auto font-semibold text-foreground tabular-nums">{formatNumber(segment.value)}</span>
              <span className="w-12 text-right text-caption text-muted-foreground tabular-nums">
                {formatPercent(share(segment.value))}
              </span>
            </li>
          ))}
        </ul>

        {breakdown.byType.length > 1 ? (
          <div className="space-y-3 border-t border-border pt-4">
            {breakdown.byType.map((entry) => {
              const rate = entry.units === 0 ? 0 : (entry.occupied / entry.units) * 100
              return (
                <div key={entry.type} className="space-y-1.5">
                  <div className="flex justify-between text-caption">
                    <span className="text-muted-foreground">{PROPERTY_TYPE_LABELS[entry.type]}</span>
                    <span className="font-semibold text-foreground tabular-nums">{formatPercent(rate)}</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${PROPERTY_TYPE_LABELS[entry.type]} occupancy ${formatPercent(rate)}`}
                  >
                    <div className="h-full rounded-full bg-primary" style={{ width: `${rate}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function OccupancyTooltip({ active, payload, total }: TooltipContentProps & { total: number }) {
  const segment = payload[0]?.payload as Segment | undefined
  if (!active || !segment) return null
  const percent = total === 0 ? 0 : (segment.value / total) * 100
  return (
    <ChartTooltipCard
      title={segment.label}
      rows={[{ label: 'Units', value: `${formatNumber(segment.value)} · ${formatPercent(percent)}`, color: segment.color }]}
    />
  )
}
