import { type PropertyType } from './property'

/** Month-end portfolio figures for one property type. */
export interface PortfolioSnapshot {
  /** Calendar month, "YYYY-MM". */
  month: string
  type: PropertyType
  properties: number
  units: number
  occupiedUnits: number
  maintenanceUnits: number
  /** Rental revenue collected in the month, USD. */
  revenue: number
}
