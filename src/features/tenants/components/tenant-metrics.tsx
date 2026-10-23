import { CalendarClock, KeyRound, UsersRound, Wallet } from 'lucide-react'

import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { type TenantSummary } from '@/features/tenants/lib/tenant-list'
import { useFormat } from '@/hooks/use-format'

/** Portfolio-wide tenant metrics (not affected by list filters). */
export function TenantMetrics({ summary }: { summary: TenantSummary }) {
  const { amount: formatCurrency, number: formatNumber } = useFormat()
  return (
    <section aria-label="Tenant metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Active tenants"
        value={formatNumber(summary.active)}
        icon={UsersRound}
        footer={<p className="text-caption text-muted-foreground">{formatNumber(summary.past)} past tenants on record</p>}
      />
      <KpiCard
        label="Upcoming move-ins"
        value={formatNumber(summary.pending)}
        icon={KeyRound}
        footer={
          <p className="text-caption text-muted-foreground">
            {summary.moveInDue > 0 ? `${summary.moveInDue} due to be marked as moved in` : 'Signed leases starting soon'}
          </p>
        }
      />
      <KpiCard
        label="Expiring in 60 days"
        value={formatNumber(summary.expiring)}
        icon={CalendarClock}
        footer={
          <p className={summary.holdover > 0 ? 'text-caption font-medium text-danger' : 'text-caption text-muted-foreground'}>
            {summary.holdover > 0 ? `${summary.holdover} in holdover past lease end` : 'No holdover leases'}
          </p>
        }
      />
      <KpiCard
        label="Monthly rent roll"
        value={formatCurrency(summary.rentRoll)}
        icon={Wallet}
        footer={<p className="text-caption text-muted-foreground">Across all active leases</p>}
      />
    </section>
  )
}
