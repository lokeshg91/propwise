import { ClipboardList, HardHat, UserRoundCheck, UserRoundX } from 'lucide-react'

import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { type VendorSummary } from '@/features/vendors/lib/vendor-list'
import { useFormat } from '@/hooks/use-format'

/** Directory-wide vendor totals (not affected by list filters). */
export function VendorMetrics({ summary }: { summary: VendorSummary }) {
  const { number: formatNumber } = useFormat()
  return (
    <section aria-label="Vendor metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Total vendors"
        value={formatNumber(summary.total)}
        icon={HardHat}
        footer={<p className="text-caption text-muted-foreground">In your vendor directory</p>}
      />
      <KpiCard
        label="Active vendors"
        value={formatNumber(summary.active)}
        icon={UserRoundCheck}
        footer={<p className="text-caption text-muted-foreground">Can take new work orders</p>}
      />
      <KpiCard
        label="Inactive vendors"
        value={formatNumber(summary.inactive)}
        icon={UserRoundX}
        footer={
          <p className="text-caption text-muted-foreground">
            {summary.inactiveWithOpenJobs > 0 ? `${summary.inactiveWithOpenJobs} still finishing open jobs` : 'Kept for work-order history'}
          </p>
        }
      />
      <KpiCard
        label="Open work orders"
        value={formatNumber(summary.openWorkOrders)}
        icon={ClipboardList}
        footer={
          <p className="text-caption text-muted-foreground">
            {summary.vendorsWithOpenJobs > 0 ? `Across ${summary.vendorsWithOpenJobs} ${summary.vendorsWithOpenJobs === 1 ? 'vendor' : 'vendors'}` : 'Nothing scheduled or in progress'}
          </p>
        }
      />
    </section>
  )
}
