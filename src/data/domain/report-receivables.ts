import { chargeState, graceFor, paymentsByCharge } from '@/data/domain/finance-rules'
import { type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { matchesSource, type RecordSource } from '@/data/domain/report-income-expense'
import { type Tenant } from '@/types'

/**
 * Receivables & Aging (C2), as of the generation date. Every non-void posted
 * charge with an open balance is in exactly one bucket:
 *
 *   Not yet due (due after today) · Due today · 1–30 · 31–60 · 61–90 · 90+ days past due
 *
 * Identity (tested): Σ buckets = total open = Σ rows = Σ open balances of all
 * posted, non-void charges. The due part (Due today … 90+) equals Finance's
 * `receivablesFor()`; Not yet due is shown separately. Projected rent that
 * hasn't been posted isn't a receivable and isn't included.
 */

export const RECEIVABLE_BUCKETS = ['not-yet-due', 'due-today', '1-30', '31-60', '61-90', '90+'] as const
export type ReceivableBucket = (typeof RECEIVABLE_BUCKETS)[number]
export type BucketAmounts = Record<ReceivableBucket, number>

export const emptyBuckets = (): BucketAmounts => ({ 'not-yet-due': 0, 'due-today': 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 })

/** The one bucket for an open balance. */
export function receivableBucket(dueDate: string, daysOverdue: number, today: string): ReceivableBucket {
  if (dueDate > today) return 'not-yet-due'
  if (daysOverdue <= 0) return 'due-today'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

export interface ReceivableFigures {
  openCharges: number
  /** Total open = due and overdue + not yet due. */
  totalOpenCents: number
  /** Due today and overdue: what Finance calls outstanding receivables. */
  dueCents: number
  overdueCents: number
  notYetDueCents: number
  buckets: BucketAmounts
  /** Oldest due date with an open balance (null when nothing is open). */
  oldestDueDate: string | null
}

export interface ReceivableRow extends ReceivableFigures {
  id: string
  name: string
  detail?: string
}

export interface ReceivablesReport {
  totals: ReceivableFigures
  byTenant: ReceivableRow[]
  byProperty: ReceivableRow[]
  counted: { records: number; sample: number }
}

const emptyFigures = (): ReceivableFigures => ({ openCharges: 0, totalOpenCents: 0, dueCents: 0, overdueCents: 0, notYetDueCents: 0, buckets: emptyBuckets(), oldestDueDate: null })

function add(figures: ReceivableFigures, balance: number, bucket: ReceivableBucket, dueDate: string) {
  figures.openCharges += 1
  figures.totalOpenCents += balance
  figures.buckets[bucket] += balance
  if (bucket === 'not-yet-due') figures.notYetDueCents += balance
  else figures.dueCents += balance
  if (bucket !== 'not-yet-due' && bucket !== 'due-today') figures.overdueCents += balance
  if (figures.oldestDueDate === null || dueDate < figures.oldestDueDate) figures.oldestDueDate = dueDate
}

export function receivablesReport(
  snapshot: FinanceSnapshot & { tenants: readonly Pick<Tenant, 'id' | 'name'>[] },
  today: string,
  scope: PropertyScope,
  source: RecordSource,
): ReceivablesReport {
  const payments = paymentsByCharge(snapshot.payments)
  const leases = new Map(snapshot.leases.map((lease) => [lease.id, lease]))
  const tenants = new Map(snapshot.tenants.map((tenant) => [tenant.id, tenant.name]))
  const properties = new Map(snapshot.properties.map((property) => [property.id, property.name]))
  const units = new Map(snapshot.units.map((unit) => [unit.id, unit.number]))
  const totals = emptyFigures()
  const byTenant = new Map<string, ReceivableRow>()
  const byProperty = new Map<string, ReceivableRow>()
  const counted = { records: 0, sample: 0 }

  for (const charge of snapshot.charges) {
    if (charge.voidedAt || !matchesSource(source, charge) || (scope !== null && !scope.has(charge.propertyId))) continue
    const state = chargeState(charge, payments.get(charge.id), today, graceFor(snapshot, charge))
    if (state.balanceCents === 0) continue
    counted.records += 1
    if (charge.demo) counted.sample += 1
    const bucket = receivableBucket(charge.dueDate, state.daysOverdue, today)
    add(totals, state.balanceCents, bucket, charge.dueDate)

    const property = byProperty.get(charge.propertyId) ?? { id: charge.propertyId, name: properties.get(charge.propertyId) ?? 'Unknown property', ...emptyFigures() }
    add(property, state.balanceCents, bucket, charge.dueDate)
    byProperty.set(property.id, property)

    const lease = charge.leaseId ? leases.get(charge.leaseId) : undefined
    const key = lease ? `tenant:${lease.tenantId}` : `payer:${charge.payerName ?? 'other'}:${charge.propertyId}`
    const unit = charge.unitId ? units.get(charge.unitId) : undefined
    const tenant = byTenant.get(key) ?? {
      id: key,
      name: lease ? (tenants.get(lease.tenantId) ?? 'Unknown tenant') : (charge.payerName ?? 'Other payer'),
      detail: `${properties.get(charge.propertyId) ?? 'Unknown property'}${unit ? ` · Unit ${unit}` : ''}`,
      ...emptyFigures(),
    }
    add(tenant, state.balanceCents, bucket, charge.dueDate)
    byTenant.set(key, tenant)
  }

  return {
    totals,
    byTenant: [...byTenant.values()].sort((a, b) => b.overdueCents - a.overdueCents || b.totalOpenCents - a.totalOpenCents || a.name.localeCompare(b.name)),
    byProperty: [...byProperty.values()].sort((a, b) => a.name.localeCompare(b.name)),
    counted,
  }
}
