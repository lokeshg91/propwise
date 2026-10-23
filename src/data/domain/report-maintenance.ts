import { inWindow, type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { costVariancePercent } from '@/data/domain/finance-rules'
import { matchesSource, type RecordSource } from '@/data/domain/report-income-expense'
import { type ReportWindow } from '@/data/domain/report-range'
import { type Expense, type ExpenseSource, type RequestCategory, type ServiceRequest, type Vendor } from '@/types'

/**
 * Maintenance expenses (C3): Finance bills only.
 *
 * - Included: every non-void bill with `source = 'work-order'` or
 *   `category = 'maintenance'` (work-order, manual and operating bills).
 *   Each bill counts once (by bill id), even when it matches both rules.
 * - `WorkOrder.actualCost` is never added up. A completed work order with
 *   no final cost has no bill; it's only counted ("Completed without a final
 *   cost"), with no amount.
 * - Basis: paid (by paid date) or incurred (by bill date).
 * - A manual bill that repeats a work-order bill is a separate bill (Phase 8
 *   warned at entry) and counts separately.
 */

export type MaintenanceBasis = 'paid' | 'incurred'

export const isMaintenanceBill = (bill: Pick<Expense, 'source' | 'category'>) => bill.source === 'work-order' || bill.category === 'maintenance'

export interface MaintenanceFigures {
  bills: number
  totalCents: number
  /** Bills with an estimate (work-order bills): estimate and actual, for estimate vs actual. */
  estimatedBills: number
  estimatedCents: number
  actualOnEstimatedCents: number
  bySource: Record<ExpenseSource, number>
}

export interface MaintenanceRow extends MaintenanceFigures {
  id: string
  name: string
}

export interface MaintenanceReport {
  totals: MaintenanceFigures
  /** Total ÷ bills (whole cents), or null with no bills. */
  averageCents: number | null
  /** (actual − estimate) ÷ estimate, for bills that had an estimate. */
  variancePercent: number | null
  completedWithoutCost: number
  byProperty: MaintenanceRow[]
  byPayee: MaintenanceRow[]
  byCategory: MaintenanceRow[]
  counted: { records: number; sample: number }
}

const emptyFigures = (): MaintenanceFigures => ({ bills: 0, totalCents: 0, estimatedBills: 0, estimatedCents: 0, actualOnEstimatedCents: 0, bySource: { 'work-order': 0, manual: 0, operating: 0 } })

function add(figures: MaintenanceFigures, bill: Expense) {
  figures.bills += 1
  figures.totalCents += bill.amountCents
  figures.bySource[bill.source] += bill.amountCents
  if (bill.estimatedCents !== undefined) {
    figures.estimatedBills += 1
    figures.estimatedCents += bill.estimatedCents
    figures.actualOnEstimatedCents += bill.amountCents
  }
}

export const NOT_LINKED = 'not-linked'

export function maintenanceReport(
  snapshot: FinanceSnapshot & { serviceRequests: readonly Pick<ServiceRequest, 'id' | 'propertyId' | 'category'>[]; vendors: readonly Pick<Vendor, 'id' | 'name'>[] },
  window: Pick<ReportWindow, 'from' | 'to'>,
  scope: PropertyScope,
  source: RecordSource,
  basis: MaintenanceBasis,
  options: { categoryLabel: (category: RequestCategory) => string; isSampleWorkOrder: (id: string) => boolean },
): MaintenanceReport {
  const properties = new Map(snapshot.properties.map((property) => [property.id, property.name]))
  const vendors = new Map(snapshot.vendors.map((vendor) => [vendor.id, vendor.name]))
  const requests = new Map(snapshot.serviceRequests.map((request) => [request.id, request]))
  const inScope = (propertyId: string | undefined) => propertyId !== undefined && (scope === null || scope.has(propertyId))
  const totals = emptyFigures()
  const byProperty = new Map<string, MaintenanceRow>()
  const byPayee = new Map<string, MaintenanceRow>()
  const byCategory = new Map<string, MaintenanceRow>()
  const row = (map: Map<string, MaintenanceRow>, id: string, name: string) => map.get(id) ?? map.set(id, { id, name, ...emptyFigures() }).get(id)!
  const counted = { records: 0, sample: 0 }
  const seen = new Set<string>()

  for (const bill of snapshot.expenses) {
    if (seen.has(bill.id)) continue
    if (bill.voidedAt || !isMaintenanceBill(bill) || !matchesSource(source, bill) || !inScope(bill.propertyId)) continue
    if (!inWindow(basis === 'paid' ? bill.paidOn : bill.billDate, window)) continue
    seen.add(bill.id)
    counted.records += 1
    if (bill.demo) counted.sample += 1
    add(totals, bill)
    add(row(byProperty, bill.propertyId, properties.get(bill.propertyId) ?? 'Unknown property'), bill)
    const payeeId = bill.vendorId ? `vendor:${bill.vendorId}` : `payee:${(bill.payeeName ?? '').trim().toLowerCase()}`
    add(row(byPayee, payeeId, bill.vendorId ? (vendors.get(bill.vendorId) ?? 'Unknown vendor') : bill.payeeName?.trim() || 'No payee'), bill)
    const request = bill.requestId ? requests.get(bill.requestId) : undefined
    add(row(byCategory, request ? request.category : NOT_LINKED, request ? options.categoryLabel(request.category) : 'Not linked to a request'), bill)
  }

  // Completed work orders without a final cost have no bill: counted only, never given an amount.
  let completedWithoutCost = 0
  for (const order of snapshot.workOrders) {
    if (order.status !== 'completed' || order.actualCost !== null || !order.completedAt) continue
    if (source !== 'all' && (source === 'sample') !== options.isSampleWorkOrder(order.id)) continue
    if (!inScope(requests.get(order.requestId)?.propertyId) || !inWindow(order.completedAt.slice(0, 10), window)) continue
    completedWithoutCost += 1
  }

  const byName = (a: MaintenanceRow, b: MaintenanceRow) => b.totalCents - a.totalCents || a.name.localeCompare(b.name)
  return {
    totals,
    averageCents: totals.bills > 0 ? Math.round(totals.totalCents / totals.bills) : null,
    variancePercent: totals.estimatedBills > 0 ? costVariancePercent(totals.estimatedCents, totals.actualOnEstimatedCents) : null,
    completedWithoutCost,
    byProperty: [...byProperty.values()].sort(byName),
    byPayee: [...byPayee.values()].sort(byName),
    byCategory: [...byCategory.values()].sort((a, b) => (a.id === NOT_LINKED ? 1 : b.id === NOT_LINKED ? -1 : byName(a, b))),
    counted,
  }
}
