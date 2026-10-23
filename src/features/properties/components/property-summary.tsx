import { useFormat } from '@/hooks/use-format'

interface PropertySummaryProps {
  summary: { properties: number; units: number; occupied: number; occupancyRate: number; monthlyRevenue: number }
}

/** Compact totals for the current filter selection. */
export function PropertySummary({ summary }: PropertySummaryProps) {
  const { amount: formatCurrency, number: formatNumber, percent: formatPercent } = useFormat()
  const items = [
    { label: 'Properties', value: formatNumber(summary.properties) },
    { label: 'Total units', value: formatNumber(summary.units) },
    { label: 'Occupancy', value: formatPercent(summary.occupancyRate) },
    { label: 'Monthly revenue', value: formatCurrency(summary.monthlyRevenue) },
  ]

  return (
    <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={item.label}
          className={
            'flex flex-col gap-1 px-5 py-4 ' +
            [index % 2 === 1 ? 'border-l border-border' : '', index >= 2 ? 'max-lg:border-t max-lg:border-border' : '', index >= 1 ? 'lg:border-l lg:border-border' : ''].join(' ')
          }
        >
          <dt className="text-caption text-muted-foreground">{item.label}</dt>
          <dd className="text-h2 text-foreground tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
