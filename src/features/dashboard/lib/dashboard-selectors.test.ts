import {
  aggregateHistory,
  compare,
  getKpis,
  getMaintenanceRows,
  getMaintenanceSummary,
  getOccupancyBreakdown,
  getPaymentStatus,
  getRecentActivity,
  getRevenueSummary,
  getUpcomingPayments,
} from '@/features/dashboard/lib/dashboard-selectors'
import { type DashboardData, type PortfolioSnapshot, type Property } from '@/types'

const NOW = new Date(2026, 9, 21, 12) // 21 Oct 2026

const property = (overrides: Partial<Property> & Pick<Property, 'id' | 'type'>): Property => ({
  name: overrides.id,
  location: { city: 'Austin', state: 'TX' },
  totalUnits: 10,
  occupiedUnits: 9,
  maintenanceUnits: 0,
  monthlyRevenue: 10_000,
  status: 'stable',
  acquiredAt: '2020-01-01',
  ...overrides,
})

/** 25 months of flat history so range comparisons are easy to reason about. */
function history(): PortfolioSnapshot[] {
  const snapshots: PortfolioSnapshot[] = []
  for (let index = 0; index < 25; index += 1) {
    const date = new Date(2024, 9 + index, 1)
    const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    snapshots.push({ month, type: 'residential', properties: index < 22 ? 1 : 2, units: 20, occupiedUnits: 16 + (index === 24 ? 2 : 0), maintenanceUnits: 1, revenue: 1_000 + index * 10 })
    snapshots.push({ month, type: 'commercial', properties: 1, units: 10, occupiedUnits: 8, maintenanceUnits: 0, revenue: 2_000 })
  }
  return snapshots
}

const data: DashboardData = {
  properties: [
    property({ id: 'res-1', type: 'residential', totalUnits: 20, occupiedUnits: 18, maintenanceUnits: 1 }),
    property({ id: 'com-1', type: 'commercial', totalUnits: 10, occupiedUnits: 8 }),
  ],
  history: history(),
  maintenanceRequests: [
    { id: 'MR-1', issue: 'Leak', propertyId: 'res-1', unit: '1A', priority: 'urgent', status: 'open', vendor: null, createdAt: '2026-10-20T10:00:00Z', completedAt: null },
    { id: 'MR-2', issue: 'HVAC', propertyId: 'com-1', unit: 'S1', priority: 'high', status: 'in-progress', vendor: 'Vendor', createdAt: '2026-10-19T10:00:00Z', completedAt: null },
    { id: 'MR-3', issue: 'Paint', propertyId: 'res-1', unit: '2B', priority: 'low', status: 'completed', vendor: 'Vendor', createdAt: '2026-09-01T10:00:00Z', completedAt: '2026-09-05T10:00:00Z' },
    { id: 'MR-4', issue: 'Roof', propertyId: 'com-1', unit: 'Bldg', priority: 'high', status: 'completed', vendor: 'Vendor', createdAt: '2026-03-01T10:00:00Z', completedAt: '2026-03-04T10:00:00Z' },
  ],
  payments: [
    { id: 'p1', tenantName: 'A', propertyId: 'res-1', unit: '1A', amount: 1_000, dueDate: '2026-10-18', autopay: false, paidAt: null },
    { id: 'p2', tenantName: 'B', propertyId: 'com-1', unit: 'S1', amount: 5_000, dueDate: '2026-10-25', autopay: true, paidAt: null },
    { id: 'p3', tenantName: 'C', propertyId: 'res-1', unit: '2B', amount: 1_200, dueDate: '2026-10-23', autopay: false, paidAt: '2026-10-20T10:00:00Z' },
    { id: 'p4', tenantName: 'D', propertyId: 'res-1', unit: '3C', amount: 1_300, dueDate: '2026-11-20', autopay: false, paidAt: null },
  ],
  activities: [
    { id: 'a1', type: 'payment-received', title: 'Paid', description: '', propertyId: 'res-1', createdAt: '2026-10-20T10:00:00Z' },
    { id: 'a2', type: 'lease-signed', title: 'Lease', description: '', propertyId: 'com-1', createdAt: '2026-10-21T09:00:00Z' },
  ],
  generatedAt: NOW.toISOString(),
}

describe('dashboard selectors', () => {
  it('computes comparisons', () => {
    expect(compare(110, 100)).toEqual({ current: 110, previous: 100, change: 10, changePercent: 10 })
    expect(compare(5, 0).changePercent).toBeNull()
  })

  it('aggregates history by property type', () => {
    const all = aggregateHistory(data.history, 'all')
    expect(all).toHaveLength(25)
    expect(all.at(-1)).toMatchObject({ units: 30, revenue: 1_240 + 2_000 })
    expect(aggregateHistory(data.history, 'commercial').at(-1)?.units).toBe(10)
  })

  it('builds KPIs that respond to the type filter and date range', () => {
    const all = getKpis(data, { range: '12m', type: 'all' })
    expect(all.properties).toMatchObject({ current: 3, previous: 2, change: 1 })
    expect(all.units).toEqual({ total: 30, occupied: 26, maintenance: 1, vacant: 4 })
    expect(all.occupancyRate.current).toBeCloseTo((26 / 30) * 100)
    expect(all.monthlyRevenue).toMatchObject({ current: 3_240, previous: 3_230 })

    // The extra residential property was added 2 months ago, inside a 3-month range only.
    expect(getKpis(data, { range: '3m', type: 'residential' }).properties.change).toBe(1)
    expect(getKpis(data, { range: '12m', type: 'commercial' }).properties.change).toBe(0)
  })

  it('returns revenue points for the selected range only', () => {
    const six = getRevenueSummary(data, { range: '6m', type: 'all' })
    expect(six.points).toHaveLength(6)
    expect(six.series).toEqual(['residential', 'commercial'])
    expect(six.points.at(-1)).toMatchObject({ residential: 1_240, commercial: 2_000, total: 3_240 })

    const commercial = getRevenueSummary(data, { range: '3m', type: 'commercial' })
    expect(commercial.series).toEqual(['commercial'])
    expect(commercial.points.every((point) => point.residential === 0)).toBe(true)
    expect(commercial.total).toMatchObject({ current: 6_000, previous: 6_000, change: 0 })
  })

  it('breaks down occupancy', () => {
    expect(getOccupancyBreakdown(data, { range: '12m', type: 'all' })).toMatchObject({
      total: 30,
      occupied: 26,
      maintenance: 1,
      vacant: 3,
    })
  })

  it('summarises maintenance within the range', () => {
    const twelve = getMaintenanceRows(data, { range: '12m', type: 'all' }, NOW)
    expect(getMaintenanceSummary(twelve)).toEqual({ open: 1, urgent: 1, inProgress: 1, completed: 2 })

    const three = getMaintenanceRows(data, { range: '3m', type: 'all' }, NOW)
    expect(three.map((row) => row.id)).toEqual(['MR-1', 'MR-2', 'MR-3'])
    expect(three[0]?.propertyName).toBe('res-1')
  })

  it('resolves payment statuses and the upcoming window', () => {
    const [overdue, scheduled, paid] = data.payments
    expect(overdue && getPaymentStatus(overdue, NOW)).toBe('overdue')
    expect(scheduled && getPaymentStatus(scheduled, NOW)).toBe('scheduled')
    expect(paid && getPaymentStatus(paid, NOW)).toBe('paid')

    const upcoming = getUpcomingPayments(data, { range: '12m', type: 'all' }, NOW)
    expect(upcoming.map((row) => row.id)).toEqual(['p1', 'p2'])
    expect(getUpcomingPayments(data, { range: '12m', type: 'commercial' }, NOW).map((row) => row.id)).toEqual(['p2'])
  })

  it('filters and orders recent activity', () => {
    expect(getRecentActivity(data, { range: '12m', type: 'all' }).map((a) => a.id)).toEqual(['a2', 'a1'])
    expect(getRecentActivity(data, { range: '12m', type: 'residential' }).map((a) => a.id)).toEqual(['a1'])
  })
})
