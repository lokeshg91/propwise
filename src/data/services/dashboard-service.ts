import { activities } from '@/data/mock/activities'
import { maintenanceRequests } from '@/data/mock/maintenance-requests'
import { rentPayments } from '@/data/mock/payments'
import { portfolioHistory } from '@/data/mock/portfolio-history'
import { properties } from '@/data/mock/properties'
import { simulateLatency } from '@/data/services/simulate-latency'
import { type DashboardData } from '@/types'

/**
 * Returns everything the overview needs in one request. Replace with a call
 * to your API (e.g. `GET /dashboard`); filtering and aggregation happen on
 * the client in `features/dashboard/lib/dashboard-selectors.ts`.
 */
export function getDashboardData(): Promise<DashboardData> {
  return simulateLatency(
    {
      properties,
      history: portfolioHistory,
      maintenanceRequests,
      payments: rentPayments,
      activities,
      generatedAt: new Date().toISOString(),
    },
    350,
  )
}
