import { ratioPercent } from '@/data/domain/money'
import { type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { incomeExpenseReport, type RecordSource } from '@/data/domain/report-income-expense'
import { maintenanceReport } from '@/data/domain/report-maintenance'
import { receivablesReport } from '@/data/domain/report-receivables'
import { type ReportWindow } from '@/data/domain/report-range'
import { type PropertyType, type RequestCategory, type ServiceRequest, type Tenant, type Vendor } from '@/types'

/**
 * Property performance: for each property, for the period — billed,
 * collected, collection rate, expenses paid and incurred, net cash flow and
 * maintenance paid — plus two figures as of today: current occupancy and
 * the open balance due (Due today and overdue, as on the Finance pages).
 *
 * The collection rate is the Finance definition: payments to date on
 * charges due in the period ÷ billed in the period. With all records the
 * figures equal Finance's `propertyPerformance` and `totalsFor` per property.
 */

export interface PropertyPerformanceFigures {
  billedCents: number
  collectedCents: number
  /** Payments to date on charges due in the period, capped per charge (for the rate). */
  collectedOnBilledCents: number
  collectionRate: number | null
  expensesPaidCents: number
  expensesIncurredCents: number
  netCashFlowCents: number
  maintenancePaidCents: number
  /** Open balance due today and overdue (not counting charges not yet due). */
  dueCents: number
  units: number
  occupiedUnits: number
  /** Current occupancy (today), in percent. */
  occupancy: number | null
}

export interface PropertyPerformanceRow extends PropertyPerformanceFigures {
  id: string
  name: string
  type: PropertyType
}

export interface PropertyPerformanceReport {
  rows: PropertyPerformanceRow[]
  totals: PropertyPerformanceFigures
  counted: { records: number; sample: number }
}

type Snapshot = FinanceSnapshot & {
  tenants: readonly Pick<Tenant, 'id' | 'name'>[]
  serviceRequests: readonly Pick<ServiceRequest, 'id' | 'propertyId' | 'category'>[]
  vendors: readonly Pick<Vendor, 'id' | 'name'>[]
}

const empty = (): PropertyPerformanceFigures => ({
  billedCents: 0,
  collectedCents: 0,
  collectedOnBilledCents: 0,
  collectionRate: null,
  expensesPaidCents: 0,
  expensesIncurredCents: 0,
  netCashFlowCents: 0,
  maintenancePaidCents: 0,
  dueCents: 0,
  units: 0,
  occupiedUnits: 0,
  occupancy: null,
})

function collectedOnBilled(snapshot: FinanceSnapshot, window: Pick<ReportWindow, 'from' | 'to'>, propertyId: string, source: RecordSource): number {
  const paid = new Map<string, number>()
  for (const payment of snapshot.payments) {
    if (payment.voidedAt) continue
    paid.set(payment.chargeId, (paid.get(payment.chargeId) ?? 0) + payment.amountCents)
  }
  let total = 0
  for (const charge of snapshot.charges) {
    if (charge.voidedAt || charge.propertyId !== propertyId || charge.dueDate < window.from || charge.dueDate > window.to) continue
    if (source !== 'all' && (source === 'sample') !== (charge.demo === true)) continue
    total += Math.min(charge.amountCents, paid.get(charge.id) ?? 0)
  }
  return total
}

export function propertyPerformanceReport(
  snapshot: Snapshot,
  window: Pick<ReportWindow, 'from' | 'to' | 'months'>,
  today: string,
  scope: PropertyScope,
  source: RecordSource,
  options: { categoryLabel: (category: RequestCategory) => string; isSampleWorkOrder: (id: string) => boolean },
): PropertyPerformanceReport {
  const totals = empty()
  const counted = { records: 0, sample: 0 }
  const rows = snapshot.properties
    .filter((property) => scope === null || scope.has(property.id))
    .map((property) => {
      const only = new Set([property.id])
      const cash = incomeExpenseReport(snapshot, window, only, source)
      const maintenance = maintenanceReport(snapshot, window, only, source, 'paid', options)
      const receivables = receivablesReport(snapshot, today, only, source)
      const units = snapshot.units.filter((unit) => unit.propertyId === property.id)
      const occupied = units.filter((unit) => unit.status === 'occupied').length
      const onBilled = collectedOnBilled(snapshot, window, property.id, source)
      const row: PropertyPerformanceRow = {
        id: property.id,
        name: property.name,
        type: property.type,
        billedCents: cash.totals.billedCents,
        collectedCents: cash.totals.collectedCents,
        collectedOnBilledCents: onBilled,
        collectionRate: ratioPercent(onBilled, cash.totals.billedCents),
        expensesPaidCents: cash.totals.paidCents,
        expensesIncurredCents: cash.totals.incurredCents,
        netCashFlowCents: cash.totals.netCashFlowCents,
        maintenancePaidCents: maintenance.totals.totalCents,
        dueCents: receivables.totals.dueCents,
        units: units.length,
        occupiedUnits: occupied,
        occupancy: ratioPercent(occupied, units.length),
      }
      counted.records += cash.counted.records
      counted.sample += cash.counted.sample
      for (const key of ['billedCents', 'collectedCents', 'collectedOnBilledCents', 'expensesPaidCents', 'expensesIncurredCents', 'netCashFlowCents', 'maintenancePaidCents', 'dueCents', 'units', 'occupiedUnits'] as const) {
        totals[key] += row[key]
      }
      return row
    })
    .sort((a, b) => a.name.localeCompare(b.name))
  totals.collectionRate = ratioPercent(totals.collectedOnBilledCents, totals.billedCents)
  totals.occupancy = ratioPercent(totals.occupiedUnits, totals.units)
  return { rows, totals, counted }
}
