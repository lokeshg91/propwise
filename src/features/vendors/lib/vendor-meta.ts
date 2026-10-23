import { type Metric } from '@/data/domain/vendor-rules'
import { formatDuration } from '@/features/maintenance/lib/request-time'

/** Status filter groups for the listing. */
export const VENDOR_STATUS_GROUPS = ['active', 'inactive', 'all'] as const
export type VendorStatusGroup = (typeof VENDOR_STATUS_GROUPS)[number]

export const VENDOR_STATUS_GROUP_LABELS: Record<VendorStatusGroup, string> = {
  active: 'Active',
  inactive: 'Inactive',
  all: 'All',
}

export const NOT_ENOUGH_DATA = 'Not enough data'

/** "Based on 4 jobs" / "No eligible jobs yet". */
export function basedOnLabel(count: number): string {
  if (count === 0) return 'No eligible jobs yet'
  return `Based on ${count} ${count === 1 ? 'job' : 'jobs'}`
}

/** `percent` is the workspace percentage formatter (`useFormat().percent`). */
export const formatOnTime = (metric: Metric<number>, percent: (value: number, fractionDigits?: number) => string) =>
  metric.value === null ? NOT_ENOUGH_DATA : percent(metric.value, 0)
export const formatResolution = (metric: Metric<number>) => (metric.value === null ? NOT_ENOUGH_DATA : formatDuration(metric.value))
/** `amount` is the workspace whole-currency formatter (`useFormat().amount`). */
export const formatSpend = (metric: Metric<number>, amount: (value: number) => string) => (metric.value === null ? NOT_ENOUGH_DATA : amount(metric.value))
export function formatVariance(metric: Metric<number>): string {
  if (metric.value === null) return NOT_ENOUGH_DATA
  const rounded = Math.round(metric.value * 10) / 10
  if (rounded === 0) return 'On estimate'
  return `${rounded > 0 ? '+' : '−'}${Math.abs(rounded).toFixed(1)}% ${rounded > 0 ? 'over' : 'under'} estimate`
}
