import { Building2, ShieldCheck, UserRoundCheck, Users } from 'lucide-react'

import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { type StaffSummary } from '@/features/staff/lib/staff-list'
import { useFormat } from '@/hooks/use-format'

/** Team-wide totals (not affected by filters). */
export function StaffMetrics({ summary, propertyCount }: { summary: StaffSummary; propertyCount: number }) {
  const { number: formatNumber } = useFormat()
  return (
    <section aria-label="Staff metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard label="Team members" value={formatNumber(summary.total)} icon={Users} footer={<p className="text-caption text-muted-foreground">Including you</p>} />
      <KpiCard
        label="Active"
        value={formatNumber(summary.active)}
        icon={UserRoundCheck}
        footer={<p className="text-caption text-muted-foreground">{summary.inactive > 0 ? `${formatNumber(summary.inactive)} inactive, history kept` : 'Everyone is active'}</p>}
      />
      <KpiCard label="Owners and admins" value={formatNumber(summary.managers)} icon={ShieldCheck} footer={<p className="text-caption text-muted-foreground">Active, with staff and settings access</p>} />
      <KpiCard
        label="Properties covered"
        value={`${formatNumber(summary.coveredProperties)} of ${formatNumber(propertyCount)}`}
        icon={Building2}
        footer={<p className="text-caption text-muted-foreground">Assigned to at least one active member</p>}
      />
    </section>
  )
}
