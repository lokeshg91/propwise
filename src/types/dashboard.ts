import { type Activity } from './activity'
import { type MaintenanceRequest } from './maintenance'
import { type PaymentStatus, type RentPayment } from './payment'
import { type PortfolioSnapshot } from './portfolio'
import { type Property, type PropertyType } from './property'

export const DATE_RANGES = ['3m', '6m', '12m'] as const
export type DateRange = (typeof DATE_RANGES)[number]

export const PROPERTY_TYPE_FILTERS = ['all', 'residential', 'commercial'] as const
export type PropertyTypeFilter = (typeof PROPERTY_TYPE_FILTERS)[number]

export interface DashboardFilters {
  range: DateRange
  type: PropertyTypeFilter
}

/** Raw dataset returned by the dashboard service. */
export interface DashboardData {
  properties: Property[]
  history: PortfolioSnapshot[]
  maintenanceRequests: MaintenanceRequest[]
  payments: RentPayment[]
  activities: Activity[]
  /** ISO timestamp of when the data was produced. */
  generatedAt: string
}

/** A value compared with an earlier one. `change` is absolute (current − previous). */
export interface MetricComparison {
  current: number
  previous: number
  change: number
  /** Relative change in percent, or null when the previous value is zero. */
  changePercent: number | null
}

export interface DashboardKpis {
  properties: MetricComparison
  units: { total: number; occupied: number; vacant: number; maintenance: number }
  /** Occupancy in percent (0–100). */
  occupancyRate: MetricComparison
  monthlyRevenue: MetricComparison
}

export interface RevenuePoint {
  /** "YYYY-MM" */
  month: string
  residential: number
  commercial: number
  total: number
}

export interface RevenueSummary {
  points: RevenuePoint[]
  /** Revenue across the selected range compared with the preceding range. */
  total: MetricComparison
  /** Property types included in the series. */
  series: PropertyType[]
}

export interface OccupancyBreakdown {
  total: number
  occupied: number
  vacant: number
  maintenance: number
  byType: Array<{ type: PropertyType; units: number; occupied: number }>
}

export interface MaintenanceSummary {
  open: number
  urgent: number
  inProgress: number
  /** Completed within the selected date range. */
  completed: number
}

/** A maintenance request joined with its property for display. */
export interface MaintenanceRequestRow extends MaintenanceRequest {
  propertyName: string
  propertyType: PropertyType
}

/** A rent payment joined with its property and resolved status. */
export interface PaymentRow extends RentPayment {
  propertyName: string
  propertyType: PropertyType
  status: PaymentStatus
}

/** Property with derived performance figures for the performance table. */
export interface PropertyPerformanceRow extends Property {
  /** Occupancy in percent (0–100). */
  occupancyRate: number
}
