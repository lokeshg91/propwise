import { DoorOpen, KeyRound, Percent, Wallet } from 'lucide-react'

import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { OccupancyMeter } from '@/features/properties/components/occupancy-meter'
import { type UnitStats } from '@/features/properties/lib/property-detail'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { type Property } from '@/types'

export function PropertyKpis({ property, stats }: { property: Property; stats: UnitStats }) {
  const available = stats.vacant + stats.notAdded

  return (
    <section aria-label="Property metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Total units"
        value={formatNumber(property.totalUnits)}
        icon={DoorOpen}
        footer={
          <p className="text-caption text-muted-foreground">
            {stats.notAdded > 0 ? `${stats.added} added · ${stats.notAdded} still to add` : `All ${stats.added} units set up`}
          </p>
        }
      />
      <KpiCard
        label="Occupancy rate"
        value={formatPercent(stats.occupancyRate)}
        icon={Percent}
        footer={
          <div className="space-y-2">
            <OccupancyMeter rate={stats.occupancyRate} className="block" />
            <p className="text-caption text-muted-foreground">
              {formatNumber(stats.occupied)} of {formatNumber(property.totalUnits)} units occupied
            </p>
          </div>
        }
      />
      <KpiCard
        label="Monthly revenue"
        value={formatCurrency(property.monthlyRevenue)}
        icon={Wallet}
        footer={
          <p className="text-caption text-muted-foreground">
            {stats.occupied > 0 ? `${formatCurrency(stats.averageRent)} average rent` : 'No occupied units yet'}
          </p>
        }
      />
      <KpiCard
        label="Available units"
        value={formatNumber(available)}
        icon={KeyRound}
        footer={
          <p className="text-caption text-muted-foreground">
            {stats.maintenance > 0 ? `${stats.maintenance} more under maintenance` : 'None under maintenance'}
          </p>
        }
      />
    </section>
  )
}
