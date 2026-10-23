import { chargeState, graceFor, isActivePayment, paymentsByCharge, type ChargeState } from '@/data/domain/finance-rules'
import { inWindow, type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { ratioPercent } from '@/data/domain/money'
import { matchesSource, type RecordSource } from '@/data/domain/report-income-expense'
import { type ReportWindow } from '@/data/domain/report-range'
import { type Charge, type Tenant } from '@/types'

/**
 * Rent Collection: rent charges due in the period (optionally with
 * recurring charges such as parking), and how they stand today.
 *
 * - Against these charges: billed, collected to date, outstanding, the
 *   collection rate, and how many were paid on time, paid late (using the
 *   rule version in force on each charge's due date), partly paid, unpaid
 *   or not yet due.
 * - Rent received in the period (cash, whichever month it was for) is a
 *   separate figure.
 *
 * Every charge falls in exactly one status; billed = collected + outstanding.
 */

export type CollectionStatus = 'on-time' | 'late' | 'partial' | 'unpaid' | 'not-yet-due'
export const COLLECTION_STATUSES = ['on-time', 'late', 'partial', 'unpaid', 'not-yet-due'] as const satisfies readonly CollectionStatus[]

export interface CollectionFigures {
  charges: number
  billedCents: number
  /** Payments to date on these charges, capped at each charge's amount. */
  collectedCents: number
  outstandingCents: number
  /** Collected ÷ billed, in percent (one decimal). */
  collectionRate: number | null
  counts: Record<CollectionStatus, number>
}

export interface CollectionGroupRow extends CollectionFigures {
  id: string
  name: string
  /** Tenant rows: the property and unit of their charges (the latest one). */
  detail?: string
}

export interface RentCollectionReport {
  totals: CollectionFigures
  /** Cash received in the period on rent (and recurring, when included) charges. */
  receivedInPeriodCents: number
  byProperty: CollectionGroupRow[]
  byTenant: CollectionGroupRow[]
  counted: { records: number; sample: number }
}

const emptyFigures = (): CollectionFigures => ({
  charges: 0,
  billedCents: 0,
  collectedCents: 0,
  outstandingCents: 0,
  collectionRate: null,
  counts: { 'on-time': 0, late: 0, partial: 0, unpaid: 0, 'not-yet-due': 0 },
})

/** One status per charge, as of `today`. */
export function collectionStatus(charge: Pick<Charge, 'dueDate'>, state: ChargeState, today: string): CollectionStatus {
  if (state.status === 'paid') return state.paidLate ? 'late' : 'on-time'
  if (state.status === 'partially-paid') return 'partial'
  return charge.dueDate > today ? 'not-yet-due' : 'unpaid'
}

const add = (figures: CollectionFigures, charge: Charge, state: ChargeState, status: CollectionStatus) => {
  figures.charges += 1
  figures.billedCents += charge.amountCents
  figures.collectedCents += Math.min(charge.amountCents, state.paidCents)
  figures.outstandingCents += state.balanceCents
  figures.counts[status] += 1
}
const finish = (figures: CollectionFigures) => {
  figures.collectionRate = ratioPercent(figures.collectedCents, figures.billedCents)
}

export const isCollectionCharge = (charge: Pick<Charge, 'category' | 'source'>, includeRecurring: boolean) =>
  charge.category === 'rent' || (includeRecurring && charge.source === 'recurring')

export function rentCollectionReport(
  snapshot: FinanceSnapshot & { tenants: readonly Pick<Tenant, 'id' | 'name'>[] },
  window: Pick<ReportWindow, 'from' | 'to'>,
  scope: PropertyScope,
  source: RecordSource,
  today: string,
  options: { includeRecurring: boolean },
): RentCollectionReport {
  const payments = paymentsByCharge(snapshot.payments)
  const leases = new Map(snapshot.leases.map((lease) => [lease.id, lease]))
  const tenants = new Map(snapshot.tenants.map((tenant) => [tenant.id, tenant.name]))
  const properties = new Map(snapshot.properties.map((property) => [property.id, property.name]))
  const units = new Map(snapshot.units.map((unit) => [unit.id, unit.number]))
  const inScope = (propertyId: string) => scope === null || scope.has(propertyId)
  const totals = emptyFigures()
  const byProperty = new Map<string, CollectionGroupRow>()
  const byTenant = new Map<string, CollectionGroupRow & { lastDue: string }>()
  const counted = { records: 0, sample: 0 }

  for (const charge of snapshot.charges) {
    if (charge.voidedAt || !isCollectionCharge(charge, options.includeRecurring)) continue
    if (!matchesSource(source, charge) || !inScope(charge.propertyId) || !inWindow(charge.dueDate, window)) continue
    counted.records += 1
    if (charge.demo) counted.sample += 1
    const state = chargeState(charge, payments.get(charge.id), today, graceFor(snapshot, charge))
    const status = collectionStatus(charge, state, today)
    add(totals, charge, state, status)

    const property = byProperty.get(charge.propertyId) ?? { id: charge.propertyId, name: properties.get(charge.propertyId) ?? 'Unknown property', ...emptyFigures() }
    add(property, charge, state, status)
    byProperty.set(charge.propertyId, property)

    const lease = charge.leaseId ? leases.get(charge.leaseId) : undefined
    const tenantId = lease?.tenantId ?? `payer:${charge.payerName ?? 'other'}`
    const tenant = byTenant.get(tenantId) ?? { id: tenantId, name: lease ? (tenants.get(lease.tenantId) ?? 'Unknown tenant') : (charge.payerName ?? 'Other payer'), lastDue: '', ...emptyFigures() }
    add(tenant, charge, state, status)
    if (charge.dueDate >= tenant.lastDue) {
      tenant.lastDue = charge.dueDate
      const unit = charge.unitId ? units.get(charge.unitId) : undefined
      tenant.detail = `${properties.get(charge.propertyId) ?? 'Unknown property'}${unit ? ` · Unit ${unit}` : ''}`
    }
    byTenant.set(tenantId, tenant)
  }

  // Cash received in the period on the same kind of charges (any due date).
  let received = 0
  const charges = new Map(snapshot.charges.map((charge) => [charge.id, charge]))
  for (const payment of snapshot.payments) {
    if (!isActivePayment(payment) || !matchesSource(source, payment) || !inWindow(payment.receivedOn, window)) continue
    const charge = charges.get(payment.chargeId)
    if (!charge || charge.voidedAt || !isCollectionCharge(charge, options.includeRecurring) || !inScope(charge.propertyId)) continue
    received += payment.amountCents
  }

  finish(totals)
  const properties_ = [...byProperty.values()]
  const tenants_ = [...byTenant.values()].map(({ lastDue: _lastDue, ...row }) => row)
  for (const row of [...properties_, ...tenants_]) finish(row)
  return {
    totals,
    receivedInPeriodCents: received,
    byProperty: properties_.sort((a, b) => a.name.localeCompare(b.name)),
    byTenant: tenants_.sort((a, b) => b.outstandingCents - a.outstandingCents || a.name.localeCompare(b.name)),
    counted,
  }
}
