import { matchesType, rangeMonths } from '@/features/dashboard/lib/dashboard-filters'
import { daysUntil } from '@/lib/format'
import {
  type Activity,
  type DashboardData,
  type DashboardFilters,
  type DashboardKpis,
  type MaintenanceRequestRow,
  type MaintenanceSummary,
  type MetricComparison,
  type OccupancyBreakdown,
  type PaymentRow,
  type PaymentStatus,
  type PortfolioSnapshot,
  type Property,
  type PropertyPerformanceRow,
  PROPERTY_TYPES,
  type PropertyTypeFilter,
  type RentPayment,
  type RevenueSummary,
} from '@/types'

/** Upcoming payments window, in days. */
export const PAYMENT_WINDOW_DAYS = 14

export function compare(current: number, previous: number): MetricComparison {
  return {
    current,
    previous,
    change: current - previous,
    changePercent: previous === 0 ? null : ((current - previous) / previous) * 100,
  }
}

const occupancy = (occupied: number, units: number) => (units === 0 ? 0 : (occupied / units) * 100)

type MonthTotals = Omit<PortfolioSnapshot, 'type'>

/** Sums snapshots of the selected property types per month, oldest first. */
export function aggregateHistory(history: PortfolioSnapshot[], type: PropertyTypeFilter): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>()
  for (const snapshot of history) {
    if (!matchesType(snapshot.type, type)) continue
    const totals = byMonth.get(snapshot.month) ?? {
      month: snapshot.month,
      properties: 0,
      units: 0,
      occupiedUnits: 0,
      maintenanceUnits: 0,
      revenue: 0,
    }
    totals.properties += snapshot.properties
    totals.units += snapshot.units
    totals.occupiedUnits += snapshot.occupiedUnits
    totals.maintenanceUnits += snapshot.maintenanceUnits
    totals.revenue += snapshot.revenue
    byMonth.set(snapshot.month, totals)
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month))
}

const EMPTY_TOTALS: MonthTotals = {
  month: '',
  properties: 0,
  units: 0,
  occupiedUnits: 0,
  maintenanceUnits: 0,
  revenue: 0,
}

export function getKpis(data: DashboardData, filters: DashboardFilters): DashboardKpis {
  const months = aggregateHistory(data.history, filters.type)
  const lastIndex = months.length - 1
  const current = months[lastIndex] ?? EMPTY_TOTALS
  const lastMonth = months[lastIndex - 1] ?? EMPTY_TOTALS
  const rangeStart = months[lastIndex - rangeMonths(filters.range)] ?? months[0] ?? EMPTY_TOTALS

  return {
    properties: compare(current.properties, rangeStart.properties),
    units: {
      total: current.units,
      occupied: current.occupiedUnits,
      maintenance: current.maintenanceUnits,
      vacant: current.units - current.occupiedUnits,
    },
    occupancyRate: compare(
      occupancy(current.occupiedUnits, current.units),
      occupancy(rangeStart.occupiedUnits, rangeStart.units),
    ),
    monthlyRevenue: compare(current.revenue, lastMonth.revenue),
  }
}

export function getRevenueSummary(data: DashboardData, filters: DashboardFilters): RevenueSummary {
  const count = rangeMonths(filters.range)
  const residential = new Map(aggregateHistory(data.history, 'residential').map((m) => [m.month, m.revenue]))
  const commercial = new Map(aggregateHistory(data.history, 'commercial').map((m) => [m.month, m.revenue]))
  const selected = aggregateHistory(data.history, filters.type)

  const points = selected.slice(-count).map((month) => {
    const res = matchesType('residential', filters.type) ? (residential.get(month.month) ?? 0) : 0
    const com = matchesType('commercial', filters.type) ? (commercial.get(month.month) ?? 0) : 0
    return { month: month.month, residential: res, commercial: com, total: res + com }
  })

  const previous = selected.slice(-count * 2, -count)
  const sum = (values: Array<{ revenue: number }>) => values.reduce((total, v) => total + v.revenue, 0)

  return {
    points,
    total: compare(sum(selected.slice(-count)), sum(previous)),
    series: PROPERTY_TYPES.filter((type) => matchesType(type, filters.type)),
  }
}

export function filterProperties(properties: Property[], type: PropertyTypeFilter): Property[] {
  return properties.filter((property) => matchesType(property.type, type))
}

export function getOccupancyBreakdown(data: DashboardData, filters: DashboardFilters): OccupancyBreakdown {
  const selected = filterProperties(data.properties, filters.type)
  const total = selected.reduce((sum, p) => sum + p.totalUnits, 0)
  const occupied = selected.reduce((sum, p) => sum + p.occupiedUnits, 0)
  const maintenance = selected.reduce((sum, p) => sum + p.maintenanceUnits, 0)

  return {
    total,
    occupied,
    maintenance,
    vacant: total - occupied - maintenance,
    byType: PROPERTY_TYPES.filter((type) => matchesType(type, filters.type)).map((type) => {
      const ofType = selected.filter((p) => p.type === type)
      return {
        type,
        units: ofType.reduce((sum, p) => sum + p.totalUnits, 0),
        occupied: ofType.reduce((sum, p) => sum + p.occupiedUnits, 0),
      }
    }),
  }
}

export function getPropertyPerformance(data: DashboardData, filters: DashboardFilters): PropertyPerformanceRow[] {
  return filterProperties(data.properties, filters.type).map((property) => ({
    ...property,
    occupancyRate: occupancy(property.occupiedUnits, property.totalUnits),
  }))
}

function propertyLookup(properties: Property[]) {
  return new Map(properties.map((property) => [property.id, property]))
}

function rangeStartDate(filters: DashboardFilters, now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() - rangeMonths(filters.range), now.getDate())
}

/** Requests for the selected types, newest first. Completed requests older than the range are excluded. */
export function getMaintenanceRows(
  data: DashboardData,
  filters: DashboardFilters,
  now: Date = new Date(),
): MaintenanceRequestRow[] {
  const lookup = propertyLookup(data.properties)
  const since = rangeStartDate(filters, now)
  const rows: MaintenanceRequestRow[] = []

  for (const request of data.maintenanceRequests) {
    const property = lookup.get(request.propertyId)
    if (!property || !matchesType(property.type, filters.type)) continue
    if (request.status === 'completed' && request.completedAt && new Date(request.completedAt) < since) continue
    rows.push({ ...request, propertyName: property.name, propertyType: property.type })
  }

  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function getMaintenanceSummary(rows: MaintenanceRequestRow[]): MaintenanceSummary {
  return {
    open: rows.filter((row) => row.status === 'open').length,
    urgent: rows.filter((row) => row.priority === 'urgent' && row.status !== 'completed').length,
    inProgress: rows.filter((row) => row.status === 'in-progress').length,
    completed: rows.filter((row) => row.status === 'completed').length,
  }
}

export function getPaymentStatus(payment: RentPayment, now: Date = new Date()): PaymentStatus {
  if (payment.paidAt) return 'paid'
  if (daysUntil(payment.dueDate, now) < 0) return 'overdue'
  return payment.autopay ? 'scheduled' : 'pending'
}

/** Unpaid rent that is overdue or due within the payment window, soonest first. */
export function getUpcomingPayments(
  data: DashboardData,
  filters: DashboardFilters,
  now: Date = new Date(),
): PaymentRow[] {
  const lookup = propertyLookup(data.properties)
  const rows: PaymentRow[] = []

  for (const payment of data.payments) {
    const property = lookup.get(payment.propertyId)
    if (!property || !matchesType(property.type, filters.type)) continue
    const status = getPaymentStatus(payment, now)
    if (status === 'paid' || daysUntil(payment.dueDate, now) > PAYMENT_WINDOW_DAYS) continue
    rows.push({ ...payment, status, propertyName: property.name, propertyType: property.type })
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function getRecentActivity(data: DashboardData, filters: DashboardFilters, limit = 6): Activity[] {
  const lookup = propertyLookup(data.properties)
  return data.activities
    .filter((activity) => {
      const property = lookup.get(activity.propertyId)
      return property ? matchesType(property.type, filters.type) : filters.type === 'all'
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
}
