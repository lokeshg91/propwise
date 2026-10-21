import { mockNow } from '@/data/mock/mock-dates'
import { properties } from '@/data/mock/properties'
import { type PortfolioSnapshot, type Property, PROPERTY_TYPES } from '@/types'

/** Number of months of history generated (current month included). */
export const HISTORY_MONTHS = 25

/**
 * Builds month-end snapshots per property type from the current portfolio.
 * Earlier months apply gentle rent growth, seasonal occupancy movement and
 * lease-up ramps, and exclude properties not yet acquired. The output is
 * deterministic, and the current month matches `properties` exactly.
 */
function buildPortfolioHistory(portfolio: Property[]): PortfolioSnapshot[] {
  const snapshots: PortfolioSnapshot[] = []

  for (let offset = HISTORY_MONTHS - 1; offset >= 0; offset -= 1) {
    const monthStart = new Date(mockNow.getFullYear(), mockNow.getMonth() - offset, 1)
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
    const month = `${monthStart.getFullYear()}-${String(monthStart.getMonth() + 1).padStart(2, '0')}`

    for (const type of PROPERTY_TYPES) {
      const snapshot: PortfolioSnapshot = {
        month,
        type,
        properties: 0,
        units: 0,
        occupiedUnits: 0,
        maintenanceUnits: 0,
        revenue: 0,
      }

      portfolio.forEach((property, index) => {
        if (property.type !== type || new Date(property.acquiredAt) > monthEnd) return

        const monthsOwned = monthsBetween(new Date(property.acquiredAt), monthEnd)
        const occupied = estimateOccupied(property, offset, index, monthsOwned)
        const rentGrowth = 1 - 0.0035 * offset
        const noise = offset === 0 ? 1 : 1 + 0.012 * Math.sin(offset * 1.7 + index)
        const revenuePerUnit = property.monthlyRevenue / property.occupiedUnits

        snapshot.properties += 1
        snapshot.units += property.totalUnits
        snapshot.occupiedUnits += occupied
        snapshot.maintenanceUnits += offset === 0 ? property.maintenanceUnits : (offset + index) % 3 === 0 ? 1 : 0
        snapshot.revenue += Math.round((revenuePerUnit * occupied * rentGrowth * noise) / 10) * 10
      })

      snapshots.push(snapshot)
    }
  }

  return snapshots
}

function estimateOccupied(property: Property, offset: number, index: number, monthsOwned: number) {
  if (offset === 0) return property.occupiedUnits
  const seasonal = Math.round(property.totalUnits * 0.012 * (1 + Math.sin(offset * 0.8 + index)))
  const drift = Math.round(property.totalUnits * 0.002 * offset)
  // Newly acquired properties lease up over their first months.
  const leaseUp = property.status === 'lease-up' ? Math.max(0, 6 - monthsOwned) * 2 : 0
  const occupied = property.occupiedUnits - seasonal - drift - leaseUp
  return Math.min(property.totalUnits, Math.max(Math.round(property.totalUnits * 0.55), occupied))
}

function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
}

export const portfolioHistory: PortfolioSnapshot[] = buildPortfolioHistory(properties)
