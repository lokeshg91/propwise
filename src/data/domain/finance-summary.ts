import { addDays } from '@/data/domain/dates'
import { addPeriods, firstDayOf, lastDayOf, periodOf, periodRange } from '@/data/domain/finance-schedule'
import { agingBucket, chargeState, emptyAging, expenseStatus, isActivePayment, paymentsByCharge, type AgingBucket } from '@/data/domain/finance-rules'
import { ratioPercent, sumCents, toCents } from '@/data/domain/money'
import { type Charge, type Expense, type ExpenseCategory, type Lease, type Payment, type Property, type Unit, type WorkOrder } from '@/types'

/**
 * Finance figures as pure functions over a snapshot of records. Headline
 * figures are cash basis (money received or paid in the range); billed and
 * incurred amounts are reported alongside.
 */

export const FINANCE_RANGES = ['this-month', '3m', '6m', '12m', 'ytd'] as const
export type FinanceRange = (typeof FINANCE_RANGES)[number]

export interface DateWindow {
  /** Inclusive calendar dates. */
  from: string
  to: string
  periods: string[]
}

export interface ResolvedRange extends DateWindow {
  /** The window of the same length just before, for comparisons. */
  previous: DateWindow
}

const windowOf = (fromPeriod: string, toPeriod: string): DateWindow => ({
  from: firstDayOf(fromPeriod),
  to: lastDayOf(toPeriod),
  periods: periodRange(fromPeriod, toPeriod),
})

/** Month-based ranges ending with the current month. */
export function resolveRange(range: FinanceRange, today: string): ResolvedRange {
  const current = periodOf(today)
  const months = range === 'this-month' ? 1 : range === '3m' ? 3 : range === '6m' ? 6 : range === '12m' ? 12 : Number(current.slice(5, 7))
  const fromPeriod = addPeriods(current, -(months - 1))
  return { ...windowOf(fromPeriod, current), previous: windowOf(addPeriods(fromPeriod, -months), addPeriods(fromPeriod, -1)) }
}

export const inWindow = (date: string | undefined, window: Pick<DateWindow, 'from' | 'to'>) => date !== undefined && date >= window.from && date <= window.to

export interface FinanceSnapshot {
  charges: readonly Charge[]
  payments: readonly Payment[]
  expenses: readonly Expense[]
  properties: readonly Property[]
  units: readonly Unit[]
  leases: readonly Lease[]
  workOrders: readonly WorkOrder[]
  graceDays: number
}

/** Properties a view is limited to; `null` means all. */
export type PropertyScope = ReadonlySet<string> | null

const inScope = (scope: PropertyScope, propertyId: string) => scope === null || scope.has(propertyId)

export interface FinanceTotals {
  collectedCents: number
  billedCents: number
  expensesPaidCents: number
  expensesIncurredCents: number
  netCashFlowCents: number
  /** Payments to date on charges due in the range ÷ billed in the range. */
  collectionRate: number | null
}

export function totalsFor(snapshot: FinanceSnapshot, window: Pick<DateWindow, 'from' | 'to'>, scope: PropertyScope): FinanceTotals {
  const charges = new Map(snapshot.charges.map((charge) => [charge.id, charge]))
  let collected = 0
  const paidByCharge = new Map<string, number>()
  for (const payment of snapshot.payments) {
    if (!isActivePayment(payment)) continue
    const charge = charges.get(payment.chargeId)
    if (!charge || charge.voidedAt || !inScope(scope, charge.propertyId)) continue
    if (inWindow(payment.receivedOn, window)) collected += payment.amountCents
    paidByCharge.set(charge.id, (paidByCharge.get(charge.id) ?? 0) + payment.amountCents)
  }
  let billed = 0
  let collectedOnBilled = 0
  for (const charge of snapshot.charges) {
    if (charge.voidedAt || !inScope(scope, charge.propertyId) || !inWindow(charge.dueDate, window)) continue
    billed += charge.amountCents
    collectedOnBilled += Math.min(charge.amountCents, paidByCharge.get(charge.id) ?? 0)
  }
  let paid = 0
  let incurred = 0
  for (const expense of snapshot.expenses) {
    if (expense.voidedAt || !inScope(scope, expense.propertyId)) continue
    if (inWindow(expense.paidOn, window)) paid += expense.amountCents
    if (inWindow(expense.billDate, window)) incurred += expense.amountCents
  }
  return {
    collectedCents: collected,
    billedCents: billed,
    expensesPaidCents: paid,
    expensesIncurredCents: incurred,
    netCashFlowCents: collected - paid,
    collectionRate: ratioPercent(collectedOnBilled, billed),
  }
}

export interface ReceivablesPosition {
  outstandingCents: number
  overdueCents: number
  aging: Record<AgingBucket, number>
  oldestOverdueDays: number
  openCharges: number
}

/** Open balances as of `today` (not limited to a range). */
export function receivablesFor(snapshot: FinanceSnapshot, today: string, scope: PropertyScope): ReceivablesPosition {
  const payments = paymentsByCharge(snapshot.payments)
  const position: ReceivablesPosition = { outstandingCents: 0, overdueCents: 0, aging: emptyAging(), oldestOverdueDays: 0, openCharges: 0 }
  for (const charge of snapshot.charges) {
    if (charge.voidedAt || !inScope(scope, charge.propertyId) || charge.dueDate > today) continue
    const state = chargeState(charge, payments.get(charge.id), today, snapshot.graceDays)
    if (state.balanceCents === 0) continue
    position.outstandingCents += state.balanceCents
    position.openCharges += 1
    position.aging[agingBucket(state.daysOverdue)] += state.balanceCents
    if (state.daysOverdue > 0) position.overdueCents += state.balanceCents
    position.oldestOverdueDays = Math.max(position.oldestOverdueDays, state.daysOverdue)
  }
  return position
}

export interface PayablesPosition {
  unpaidCents: number
  overdueCents: number
  unpaidCount: number
  /** Estimates on active work orders (scheduled, in progress or on hold): derived from Maintenance. */
  committedMaintenanceCents: number
}

export function payablesFor(snapshot: FinanceSnapshot, today: string, scope: PropertyScope, requestProperty: (requestId: string) => string | undefined): PayablesPosition {
  const position: PayablesPosition = { unpaidCents: 0, overdueCents: 0, unpaidCount: 0, committedMaintenanceCents: 0 }
  for (const expense of snapshot.expenses) {
    if (!inScope(scope, expense.propertyId)) continue
    const status = expenseStatus(expense, today)
    if (status !== 'pending' && status !== 'overdue') continue
    position.unpaidCents += expense.amountCents
    position.unpaidCount += 1
    if (status === 'overdue') position.overdueCents += expense.amountCents
  }
  for (const order of snapshot.workOrders) {
    if (order.status === 'completed' || order.status === 'cancelled' || order.estimatedCost === null) continue
    const propertyId = requestProperty(order.requestId)
    if (propertyId && inScope(scope, propertyId)) position.committedMaintenanceCents += toCents(order.estimatedCost)
  }
  return position
}

export interface TrendPoint {
  period: string
  collectedCents: number
  billedCents: number
  expensesPaidCents: number
  netCashFlowCents: number
}

export function monthlyTrend(snapshot: FinanceSnapshot, periods: readonly string[], scope: PropertyScope): TrendPoint[] {
  return periods.map((period) => {
    const totals = totalsFor(snapshot, { from: firstDayOf(period), to: lastDayOf(period) }, scope)
    return {
      period,
      collectedCents: totals.collectedCents,
      billedCents: totals.billedCents,
      expensesPaidCents: totals.expensesPaidCents,
      netCashFlowCents: totals.netCashFlowCents,
    }
  })
}

export interface PropertyFinanceRow {
  propertyId: string
  name: string
  type: Property['type']
  totals: FinanceTotals
  outstandingCents: number
  overdueCents: number
  /** Occupied units ÷ total units, from the Properties module. */
  occupancy: number | null
}

export function propertyPerformance(snapshot: FinanceSnapshot, window: Pick<DateWindow, 'from' | 'to'>, today: string, scope: PropertyScope): PropertyFinanceRow[] {
  return snapshot.properties
    .filter((property) => inScope(scope, property.id))
    .map((property) => {
      const only = new Set([property.id])
      const units = snapshot.units.filter((unit) => unit.propertyId === property.id)
      const receivables = receivablesFor(snapshot, today, only)
      return {
        propertyId: property.id,
        name: property.name,
        type: property.type,
        totals: totalsFor(snapshot, window, only),
        outstandingCents: receivables.outstandingCents,
        overdueCents: receivables.overdueCents,
        occupancy: ratioPercent(units.filter((unit) => unit.status === 'occupied').length, units.length),
      }
    })
}

export function expenseBreakdown(snapshot: FinanceSnapshot, window: Pick<DateWindow, 'from' | 'to'>, scope: PropertyScope) {
  const totals = new Map<ExpenseCategory, number>()
  for (const expense of snapshot.expenses) {
    if (expense.voidedAt || !inScope(scope, expense.propertyId) || !inWindow(expense.paidOn, window)) continue
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amountCents)
  }
  return [...totals].map(([category, amountCents]) => ({ category, amountCents })).sort((a, b) => b.amountCents - a.amountCents)
}

export type CashMovement =
  | { kind: 'payment'; id: string; date: string; amountCents: number; payment: Payment; charge: Charge }
  | { kind: 'expense'; id: string; date: string; amountCents: number; expense: Expense }

/** Most recent money in (payments) and out (bills paid). */
export function recentMovements(snapshot: FinanceSnapshot, scope: PropertyScope, limit = 10): CashMovement[] {
  const charges = new Map(snapshot.charges.map((charge) => [charge.id, charge]))
  const movements: CashMovement[] = []
  for (const payment of snapshot.payments) {
    const charge = charges.get(payment.chargeId)
    if (!isActivePayment(payment) || !charge || !inScope(scope, charge.propertyId)) continue
    movements.push({ kind: 'payment', id: payment.id, date: payment.receivedOn, amountCents: payment.amountCents, payment, charge })
  }
  for (const expense of snapshot.expenses) {
    if (!expense.paidOn || expense.voidedAt || !inScope(scope, expense.propertyId)) continue
    movements.push({ kind: 'expense', id: expense.id, date: expense.paidOn, amountCents: expense.amountCents, expense })
  }
  return movements.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, limit)
}

export type UpcomingItem =
  | { kind: 'charge'; date: string; amountCents: number; charge: Charge }
  | { kind: 'projected-rent'; date: string; amountCents: number; leaseId: string; propertyId: string; unitId: string; period: string }
  | { kind: 'expense'; date: string; amountCents: number; expense: Expense }

/** Open charges and bills due in the next `days`, plus projected (not yet posted) rent. */
export function upcomingObligations(
  snapshot: FinanceSnapshot,
  today: string,
  scope: PropertyScope,
  projected: ReadonlyArray<{ leaseId: string; period: string; dueDate: string; amountCents: number; propertyId: string; unitId: string }>,
  days = 30,
): UpcomingItem[] {
  const until = addDays(today, days)
  const payments = paymentsByCharge(snapshot.payments)
  const items: UpcomingItem[] = []
  for (const charge of snapshot.charges) {
    if (charge.voidedAt || !inScope(scope, charge.propertyId) || charge.dueDate < today || charge.dueDate > until) continue
    const state = chargeState(charge, payments.get(charge.id), today, snapshot.graceDays)
    if (state.balanceCents > 0) items.push({ kind: 'charge', date: charge.dueDate, amountCents: state.balanceCents, charge })
  }
  for (const entry of projected) {
    if (!inScope(scope, entry.propertyId) || entry.dueDate > until) continue
    items.push({ kind: 'projected-rent', date: entry.dueDate, ...entry })
  }
  for (const expense of snapshot.expenses) {
    if (!inScope(scope, expense.propertyId) || expenseStatus(expense, today) !== 'pending' || expense.dueDate > until) continue
    items.push({ kind: 'expense', date: expense.dueDate, amountCents: expense.amountCents, expense })
  }
  return items.sort((a, b) => a.date.localeCompare(b.date))
}

/** Deposits on current leases: shown as a figure, never counted as income. */
export function depositsHeldCents(leases: readonly Lease[], scope: PropertyScope): number {
  return sumCents(leases.filter((lease) => (lease.status === 'active' || lease.status === 'pending') && inScope(scope, lease.propertyId)).map((lease) => toCents(lease.securityDeposit)))
}
