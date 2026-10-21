import { CircleCheckBig, ClipboardList, Hammer, TriangleAlert } from 'lucide-react'

import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { type RequestSummary } from '@/features/maintenance/lib/request-list'
import { formatDuration } from '@/features/maintenance/lib/request-time'
import { formatNumber } from '@/lib/format'

/** Portfolio-wide maintenance metrics (not affected by list filters). */
export function RequestMetrics({ summary }: { summary: RequestSummary }) {
  return (
    <section aria-label="Maintenance metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Open requests"
        value={formatNumber(summary.active)}
        icon={ClipboardList}
        footer={<p className="text-caption text-muted-foreground">{summary.unassigned} waiting for a vendor</p>}
      />
      <KpiCard
        label="Overdue"
        value={formatNumber(summary.overdue)}
        icon={TriangleAlert}
        footer={
          <p className={summary.overdue > 0 ? 'text-caption font-medium text-danger' : 'text-caption text-muted-foreground'}>
            {summary.overdue > 0 ? 'Past their resolution target' : 'Everything is on track'}
          </p>
        }
      />
      <KpiCard
        label="Scheduled or in progress"
        value={formatNumber(summary.inProgress)}
        icon={Hammer}
        footer={<p className="text-caption text-muted-foreground">{summary.onHold} on hold</p>}
      />
      <KpiCard
        label="Completed in 30 days"
        value={formatNumber(summary.completed30)}
        icon={CircleCheckBig}
        footer={
          <p className="text-caption text-muted-foreground">
            {summary.averageResolutionHours !== null ? `${formatDuration(summary.averageResolutionHours)} average to resolve` : 'No completed requests yet'}
          </p>
        }
      />
    </section>
  )
}
