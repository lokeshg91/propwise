import { useMemo } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'
import { toast } from 'sonner'

import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { DashboardToolbar } from '@/features/dashboard/components/dashboard-toolbar'
import { KpiGrid } from '@/features/dashboard/components/kpi-grid'
import { MaintenanceOverviewCard } from '@/features/dashboard/components/maintenance-overview-card'
import { OccupancyCard } from '@/features/dashboard/components/occupancy-card'
import { PropertyPerformanceCard } from '@/features/dashboard/components/property-performance-card'
import { RecentActivityCard } from '@/features/dashboard/components/recent-activity-card'
import { RevenueChartCard } from '@/features/dashboard/components/revenue-chart-card'
import { UpcomingPaymentsCard } from '@/features/dashboard/components/upcoming-payments-card'
import { type dashboardLoader } from '@/features/dashboard/dashboard.loader'
import { useDashboardFilters } from '@/features/dashboard/hooks/use-dashboard-filters'
import { rangeShortLabel } from '@/features/dashboard/lib/dashboard-filters'
import {
  getKpis,
  getMaintenanceRows,
  getMaintenanceSummary,
  getOccupancyBreakdown,
  getPropertyPerformance,
  getRecentActivity,
  getRevenueSummary,
  getUpcomingPayments,
} from '@/features/dashboard/lib/dashboard-selectors'
import { formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const data = useLoaderData<typeof dashboardLoader>()
  const { filters, setFilter } = useDashboardFilters()
  const revalidator = useRevalidator()
  const refreshing = revalidator.state === 'loading'

  const view = useMemo(() => {
    const maintenanceRows = getMaintenanceRows(data, filters)
    return {
      kpis: getKpis(data, filters),
      revenue: getRevenueSummary(data, filters),
      occupancy: getOccupancyBreakdown(data, filters),
      properties: getPropertyPerformance(data, filters),
      maintenanceRows,
      maintenanceSummary: getMaintenanceSummary(maintenanceRows),
      payments: getUpcomingPayments(data, filters),
      activities: getRecentActivity(data, filters),
    }
  }, [data, filters])

  const rangeLabel = rangeShortLabel(filters.range)

  const refresh = async () => {
    await revalidator.revalidate()
    toast.success('Dashboard refreshed', { description: 'Showing the latest sample data.' })
  }

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description={
          <>
            Monitor your property portfolio and daily operations.
            <span className="mt-1 block text-caption">
              Sample data · Updated {formatTime(data.generatedAt)}
            </span>
          </>
        }
        actions={
          <DashboardToolbar
            filters={filters}
            onFilterChange={setFilter}
            onRefresh={() => void refresh()}
            refreshing={refreshing}
          />
        }
      />

      <div
        aria-busy={refreshing}
        className={cn('flex flex-col gap-6 transition-opacity duration-200 lg:gap-8', refreshing && 'opacity-60')}
      >
        <KpiGrid kpis={view.kpis} rangeLabel={rangeLabel} />

        <section aria-label="Revenue and occupancy" className="grid gap-4 lg:grid-cols-3 lg:gap-6">
          <RevenueChartCard summary={view.revenue} rangeLabel={rangeLabel} />
          <OccupancyCard breakdown={view.occupancy} />
        </section>

        <PropertyPerformanceCard rows={view.properties} />

        <MaintenanceOverviewCard
          summary={view.maintenanceSummary}
          rows={view.maintenanceRows}
          rangeLabel={rangeLabel}
        />

        <section aria-label="Payments and activity" className="grid gap-4 lg:grid-cols-2 lg:gap-6">
          <UpcomingPaymentsCard payments={view.payments} />
          <RecentActivityCard activities={view.activities} />
        </section>
      </div>
    </PageContainer>
  )
}
