import { Bar, BarChart, CartesianGrid, Tooltip, type TooltipContentProps, XAxis, YAxis } from 'recharts'

import { ChartLegend } from '@/components/charts/chart-legend'
import { chartAxisProps, chartCursor, chartGridProps, CHART_COLORS } from '@/components/charts/chart-theme'
import { ChartTooltipCard } from '@/components/charts/chart-tooltip-card'
import { TrendIndicator } from '@/components/shared/trend-indicator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PROPERTY_TYPE_LABELS } from '@/features/dashboard/lib/dashboard-filters'
import { formatCurrency, formatMonth, formatPercent, formatSigned } from '@/lib/format'
import { type PropertyType, type RevenuePoint, type RevenueSummary } from '@/types'

const SERIES_COLORS: Record<PropertyType, string> = {
  residential: CHART_COLORS.primary,
  commercial: CHART_COLORS.secondary,
}

interface RevenueChartCardProps {
  summary: RevenueSummary
  rangeLabel: string
}

export function RevenueChartCard({ summary, rangeLabel }: RevenueChartCardProps) {
  const { points, total, series } = summary
  const lastSeries = series[series.length - 1]
  const description = `Total rental revenue of ${formatCurrency(total.current)} over the last ${rangeLabel}.`

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Monthly revenue</CardTitle>
        <CardDescription>Rental income by property type</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="space-y-1">
            <p className="text-caption text-muted-foreground">Total, last {rangeLabel}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-h1 text-foreground tabular-nums">{formatCurrency(total.current)}</p>
              {total.changePercent === null ? null : (
                <TrendIndicator
                  change={total.change}
                  label={formatSigned(Number(total.changePercent.toFixed(1)), (v) => formatPercent(v))}
                  context="vs prior period"
                />
              )}
            </div>
          </div>
          <ChartLegend
            items={series.map((type) => ({ label: PROPERTY_TYPE_LABELS[type], color: SERIES_COLORS[type] }))}
          />
        </div>
        <div className="h-72 w-full" role="img" aria-label={description}>
          <BarChart
            responsive
            data={points}
            margin={{ top: 4, right: 4, bottom: 0, left: 4 }}
            barCategoryGap="22%"
            style={{ width: '100%', height: '100%' }}
          >
            <CartesianGrid {...chartGridProps} />
            <XAxis dataKey="month" {...chartAxisProps} tickFormatter={(month: string) => formatMonth(month)} minTickGap={8} />
            <YAxis
              {...chartAxisProps}
              width={56}
              tickFormatter={(value: number) => formatCurrency(value, { compact: true })}
            />
            <Tooltip cursor={chartCursor} content={(props) => <RevenueTooltip {...props} series={series} />} />
            {series.map((type) => (
              <Bar
                key={type}
                dataKey={type}
                name={PROPERTY_TYPE_LABELS[type]}
                stackId="revenue"
                fill={SERIES_COLORS[type]}
                radius={type === lastSeries ? [4, 4, 0, 0] : 0}
                maxBarSize={44}
              />
            ))}
          </BarChart>
        </div>
      </CardContent>
    </Card>
  )
}

function RevenueTooltip({
  active,
  payload,
  series,
}: TooltipContentProps & { series: PropertyType[] }) {
  const point = payload[0]?.payload as RevenuePoint | undefined
  if (!active || !point) return null

  return (
    <ChartTooltipCard
      title={formatMonth(point.month, 'long')}
      rows={series.map((type) => ({
        label: PROPERTY_TYPE_LABELS[type],
        value: formatCurrency(point[type]),
        color: SERIES_COLORS[type],
      }))}
      footer={
        series.length > 1 ? (
          <span className="flex justify-between gap-3">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-foreground tabular-nums">{formatCurrency(point.total)}</span>
          </span>
        ) : null
      }
    />
  )
}
