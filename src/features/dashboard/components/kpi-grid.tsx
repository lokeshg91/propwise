import { Building2, DoorOpen, Percent, Wallet } from 'lucide-react'

import { TrendIndicator } from '@/components/shared/trend-indicator'
import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { formatCurrency, formatNumber, formatPercent, formatSigned } from '@/lib/format'
import { type DashboardKpis } from '@/types'

interface KpiGridProps {
  kpis: DashboardKpis
  /** e.g. "12 months", used in comparison captions. */
  rangeLabel: string
}

export function KpiGrid({ kpis, rangeLabel }: KpiGridProps) {
  const { properties, units, occupancyRate, monthlyRevenue } = kpis
  const occupiedShare = units.total === 0 ? 0 : (units.occupied / units.total) * 100

  return (
    <section aria-label="Key metrics" className="grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Total properties"
        value={formatNumber(properties.current)}
        icon={Building2}
        footer={
          <TrendIndicator
            change={properties.change}
            label={formatSigned(properties.change, formatNumber)}
            context={`vs ${rangeLabel} ago`}
          />
        }
      />
      <KpiCard
        label="Total units"
        value={formatNumber(units.total)}
        icon={DoorOpen}
        footer={
          <div className="space-y-2">
            <div
              className="flex h-1.5 overflow-hidden rounded-full bg-muted"
              role="img"
              aria-label={`${units.occupied} occupied, ${units.vacant} vacant`}
            >
              <div className="rounded-full bg-primary" style={{ width: `${occupiedShare}%` }} />
            </div>
            <p className="flex flex-wrap gap-x-3 text-caption text-muted-foreground">
              <span>
                <span className="font-semibold text-foreground tabular-nums">{formatNumber(units.occupied)}</span> occupied
              </span>
              <span>
                <span className="font-semibold text-foreground tabular-nums">{formatNumber(units.vacant)}</span> vacant
              </span>
            </p>
          </div>
        }
      />
      <KpiCard
        label="Occupancy rate"
        value={formatPercent(occupancyRate.current)}
        icon={Percent}
        footer={
          <TrendIndicator
            change={Number(occupancyRate.change.toFixed(1))}
            label={`${formatSigned(Number(occupancyRate.change.toFixed(1)), (v) => v.toFixed(1))} pts`}
            context={`vs ${rangeLabel} ago`}
          />
        }
      />
      <KpiCard
        label="Monthly revenue"
        value={formatCurrency(monthlyRevenue.current)}
        icon={Wallet}
        footer={
          <TrendIndicator
            change={monthlyRevenue.change}
            label={
              monthlyRevenue.changePercent === null
                ? 'New'
                : formatSigned(Number(monthlyRevenue.changePercent.toFixed(1)), (v) => formatPercent(v))
            }
            context="vs last month"
          />
        }
      />
    </section>
  )
}
