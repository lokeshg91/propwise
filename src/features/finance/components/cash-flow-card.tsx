import { ChartNoAxesColumn } from 'lucide-react'
import { Bar, CartesianGrid, ComposedChart, Line, Tooltip, type TooltipContentProps, XAxis, YAxis } from 'recharts'

import { ChartLegend } from '@/components/charts/chart-legend'
import { chartAxisProps, chartCursor, chartGridProps, CHART_COLORS } from '@/components/charts/chart-theme'
import { ChartTooltipCard } from '@/components/charts/chart-tooltip-card'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type TrendPoint } from '@/data/domain/finance-summary'
import { useMoney } from '@/features/finance/hooks/use-money'
import { useFormat } from '@/hooks/use-format'

const SERIES = [
  { key: 'collectedCents', label: 'Collected', color: CHART_COLORS.primary },
  { key: 'expensesPaidCents', label: 'Expenses paid', color: CHART_COLORS.secondary },
] as const
const NET_COLOR = CHART_COLORS.tertiary

/** Money in and out per month, with net cash flow as a line. */
export function CashFlowCard({ trend }: { trend: TrendPoint[] }) {
  const { month: formatMonth } = useFormat()
  const money = useMoney()
  const empty = trend.every((point) => point.collectedCents === 0 && point.expensesPaidCents === 0)
  const description = `Collected ${money(trend.reduce((sum, point) => sum + point.collectedCents, 0), { whole: true })} and paid ${money(
    trend.reduce((sum, point) => sum + point.expensesPaidCents, 0),
    { whole: true },
  )} over ${trend.length} ${trend.length === 1 ? 'month' : 'months'}.`
  return (
    <Card className="min-w-0 lg:col-span-2">
      <CardHeader>
        <CardTitle>Income vs expenses</CardTitle>
        <CardDescription>Cash received and bills paid each month</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ChartLegend items={[...SERIES.map((series) => ({ label: series.label, color: series.color })), { label: 'Net cash flow', color: NET_COLOR }]} />
        {empty ? (
          <EmptyState size="sm" icon={ChartNoAxesColumn} title="No money in or out in this period" description="Choose a longer period or another property." />
        ) : (
          <div className="h-72 w-full" role="img" aria-label={description}>
            <ComposedChart responsive data={trend} margin={{ top: 4, right: 4, bottom: 0, left: 4 }} barCategoryGap="24%" style={{ width: '100%', height: '100%' }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="period" {...chartAxisProps} tickFormatter={(period: string) => formatMonth(period)} minTickGap={8} />
              <YAxis {...chartAxisProps} width={64} tickFormatter={(value: number) => money(value, { compact: true })} />
              <Tooltip cursor={chartCursor} content={(props) => <CashFlowTooltip {...props} money={money} />} />
              {SERIES.map((series) => (
                <Bar key={series.key} dataKey={series.key} name={series.label} fill={series.color} radius={[4, 4, 0, 0]} maxBarSize={28} />
              ))}
              <Line dataKey="netCashFlowCents" name="Net cash flow" stroke={NET_COLOR} strokeWidth={2} dot={{ r: 3, fill: NET_COLOR }} type="monotone" />
            </ComposedChart>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function CashFlowTooltip({ active, payload, money }: TooltipContentProps & { money: (cents: number) => string }) {
  const { month: formatMonth } = useFormat()
  const point = payload[0]?.payload as TrendPoint | undefined
  if (!active || !point) return null
  return (
    <ChartTooltipCard
      title={formatMonth(point.period, 'long')}
      rows={[
        { label: 'Collected', value: money(point.collectedCents), color: SERIES[0].color },
        { label: 'Expenses paid', value: money(point.expensesPaidCents), color: SERIES[1].color },
        { label: 'Billed', value: money(point.billedCents), color: CHART_COLORS.neutral },
      ]}
      footer={
        <span className="flex justify-between gap-3">
          <span className="text-muted-foreground">Net cash flow</span>
          <span className="font-semibold text-foreground tabular-nums">{money(point.netCashFlowCents)}</span>
        </span>
      }
    />
  )
}
