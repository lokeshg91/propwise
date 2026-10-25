import { addDays, toIsoDate } from '@/data/domain/dates'
import {
  billingBlockReason,
  expectedRentCharge,
  leaseBillablePeriods,
  leaseBillingBlock,
  periodOf,
  recurringBillablePeriods,
  recurringBillingBlock,
  type ExpectedCharge,
  type ScheduleContext,
} from '@/data/domain/finance-schedule'
import { toCents } from '@/data/domain/money'
import { type FinanceData } from '@/data/store/demo-store'
import { formatMoney, type MoneyFormat } from '@/lib/format'
import { type Charge, type Expense, type FinanceEvent } from '@/types'

/**
 * Keeps Finance in step with the facts other modules own: lease terms
 * (Tenants), recurring schedules (Finance) and completed work orders
 * (Maintenance). It runs on the draft inside every commit and after loading.
 *
 * Guarantees (all covered by tests):
 * - Only Finance collections and finance sequences are written.
 * - Payments are never created, changed or removed.
 * - A charge with any payment (even a voided one), a manual adjustment or a
 *   void is never changed. A charge is only re-synced while it's not yet due.
 * - A work-order bill is created once and never changed afterwards.
 * - Every automatic void or adjustment gets a reason and a system event.
 * - Deterministic ids: running it again on its own output changes nothing.
 */

export interface ReconcileContext {
  /** Local calendar date, YYYY-MM-DD. */
  today: string
  /** ISO timestamp used for new records and events. */
  now: string
}

export interface ReconcileReport {
  posted: number
  resynced: number
  autoVoided: number
  billsCreated: number
  changed: boolean
}

export const rentChargeId = (leaseId: string, period: string) => `chg_${leaseId}_${period}`
export const recurringChargeId = (recurringId: string, period: string) => `chg_${recurringId}_${period}`
export const workOrderBillId = (workOrderId: string) => `exp_${workOrderId}`

export const REFERENCE_PREFIX = { income: 'INC', payment: 'PAY', expense: 'EXP' } as const
export type ReferenceSeries = keyof typeof REFERENCE_PREFIX

/** Takes the next human reference number for a series, e.g. "INC-10422". */
export function nextReference(db: Pick<FinanceData, 'sequences'>, series: ReferenceSeries): string {
  const number = db.sequences[series]
  db.sequences[series] = number + 1
  return `${REFERENCE_PREFIX[series]}-${number}`
}

export function scheduleContext(db: Pick<FinanceData, 'finance' | 'tenantEvents'>, today: string): ScheduleContext {
  const cancelledLeaseIds = new Set<string>()
  for (const event of db.tenantEvents) if (event.kind === 'lease-cancelled' && event.leaseId) cancelledLeaseIds.add(event.leaseId)
  return { startPeriod: db.finance.startPeriod, throughPeriod: periodOf(today), cancelledLeaseIds }
}

const SNAPSHOT_FIELDS = ['amountCents', 'dueDate', 'issuedOn', 'propertyId', 'unitId'] as const

export function reconcileFinance(db: FinanceData, context: ReconcileContext): ReconcileReport {
  const report: ReconcileReport = { posted: 0, resynced: 0, autoVoided: 0, billsCreated: 0, changed: false }
  const schedule = scheduleContext(db, context.today)
  const charges = new Map(db.charges.map((charge) => [charge.id, charge]))
  const touched = new Set<string>()
  for (const payment of db.payments) touched.add(payment.chargeId)
  const events = new Set(db.financeEvents.map((event) => event.id))
  const leases = new Map(db.leases.map((lease) => [lease.id, lease]))
  const demoLeases = new Set(db.finance.demoScope.leaseIds)

  /** Payment-free, never adjusted and not void: the only charges reconciliation may change. */
  const untouched = (charge: Charge) => !charge.voidedAt && !charge.adjusted && !touched.has(charge.id)

  const addEvent = (event: Omit<FinanceEvent, 'createdAt' | 'actor' | 'recordType'>) => {
    if (events.has(event.id)) return
    events.add(event.id)
    db.financeEvents.push({ ...event, recordType: 'charge', actor: 'system', createdAt: context.now })
  }

  const post = (charge: Omit<Charge, 'reference' | 'createdAt'>) => {
    const created: Charge = { ...charge, reference: nextReference(db, 'income'), createdAt: context.now }
    db.charges.push(created)
    charges.set(created.id, created)
    report.posted += 1
  }

  /** Re-syncs a provisional charge (not yet due, untouched) to the terms that produce it. */
  const resync = (charge: Charge, expected: ExpectedCharge, reason: string) => {
    if (!untouched(charge) || charge.dueDate <= context.today) return
    const changes = SNAPSHOT_FIELDS.filter((field) => charge[field] !== expected[field])
    if (changes.length === 0) return
    const before = charge.amountCents
    for (const field of changes) Object.assign(charge, { [field]: expected[field] })
    charge.updatedAt = context.now
    const count = db.financeEvents.filter((event) => event.recordId === charge.id && event.kind === 'auto-adjusted').length
    addEvent({
      id: `fev_${charge.id}_auto-adj_${count + 1}`,
      recordId: charge.id,
      kind: 'auto-adjusted',
      title: 'Updated to match new terms',
      description: describeChanges(changes, before, expected, db.finance),
      reason,
      ...(changes.includes('amountCents') ? { amountCents: expected.amountCents } : {}),
    })
    report.resynced += 1
  }

  const autoVoid = (charge: Charge, reason: string) => {
    if (!untouched(charge)) return
    Object.assign(charge, { voidedAt: context.now, voidReason: reason, voidedBy: 'system', updatedAt: context.now } satisfies Partial<Charge>)
    addEvent({ id: `fev_${charge.id}_auto-void`, recordId: charge.id, kind: 'auto-voided', title: 'Voided automatically', description: reason, reason })
    report.autoVoided += 1
  }

  // 1. Rent from lease terms.
  for (const lease of db.leases) {
    const rent = toCents(lease.monthlyRent)
    for (const period of leaseBillablePeriods(lease, schedule)) {
      const id = rentChargeId(lease.id, period)
      const expected = expectedRentCharge(lease, period, rent)
      const existing = charges.get(id)
      if (existing) {
        resync(existing, expected, 'Lease terms changed before this charge was due.')
        continue
      }
      post({
        id,
        category: 'rent',
        source: 'lease',
        leaseId: lease.id,
        period,
        ...expected,
        ...(demoLeases.has(lease.id) ? { demo: true } : {}),
      })
    }
  }

  // 2. Recurring schedules (parking, service charges, …).
  for (const recurring of db.recurringCharges) {
    const lease = leases.get(recurring.leaseId)
    if (!lease) continue
    for (const period of recurringBillablePeriods(recurring, lease, schedule)) {
      const id = recurringChargeId(recurring.id, period)
      const expected = expectedRentCharge(lease, period, recurring.amountCents)
      const existing = charges.get(id)
      if (existing) {
        resync(existing, expected, 'The recurring schedule or lease changed before this charge was due.')
        continue
      }
      post({
        id,
        category: recurring.category,
        source: 'recurring',
        leaseId: lease.id,
        recurringId: recurring.id,
        period,
        description: recurring.description,
        ...expected,
        ...(recurring.demo ? { demo: true } : {}),
      })
    }
  }

  // 3. Posted charges whose month is no longer billable (lease ended or cancelled, schedule ended).
  const recurringById = new Map(db.recurringCharges.map((recurring) => [recurring.id, recurring]))
  for (const charge of db.charges) {
    if (!untouched(charge) || !charge.period || !charge.leaseId) continue
    const lease = leases.get(charge.leaseId)
    if (!lease) continue
    let block: ReturnType<typeof recurringBillingBlock> = null
    if (charge.source === 'lease') block = leaseBillingBlock(lease, charge.period, schedule)
    else if (charge.source === 'recurring' && charge.recurringId) {
      const recurring = recurringById.get(charge.recurringId)
      block = recurring ? recurringBillingBlock(recurring, lease, charge.period, schedule) : null
    }
    // A clock moved backwards must never void anything.
    if (block === null || block === 'future') continue
    autoVoid(charge, block === 'outside-schedule' ? 'The recurring schedule ended before this month.' : billingBlockReason(block))
  }

  // 4. Bills for completed work orders with a final cost. Created once, never changed.
  const expenses = new Set(db.expenses.map((expense) => expense.id))
  const requests = new Map(db.serviceRequests.map((request) => [request.id, request]))
  const demoOrders = new Set(db.finance.demoScope.workOrderIds)
  for (const order of db.workOrders) {
    if (order.status !== 'completed' || order.actualCost === null || !order.completedAt) continue
    const id = workOrderBillId(order.id)
    if (expenses.has(id)) continue
    const request = requests.get(order.requestId)
    if (!request) continue
    const billDate = toIsoDate(new Date(order.completedAt))
    const bill: Expense = {
      id,
      reference: nextReference(db, 'expense'),
      category: 'maintenance',
      source: 'work-order',
      workOrderId: order.id,
      requestId: request.id,
      vendorId: order.vendorId,
      propertyId: request.propertyId,
      ...(request.unitId ? { unitId: request.unitId } : {}),
      description: request.title,
      ...(order.estimatedCost !== null ? { estimatedCents: toCents(order.estimatedCost) } : {}),
      amountCents: toCents(order.actualCost),
      billDate,
      dueDate: addDays(billDate, db.finance.paymentTermsDays),
      ...(demoOrders.has(order.id) ? { demo: true } : {}),
      createdAt: context.now,
    }
    db.expenses.push(bill)
    expenses.add(id)
    report.billsCreated += 1
  }

  report.changed = report.posted + report.resynced + report.autoVoided + report.billsCreated > 0
  return report
}

function describeChanges(
  changes: ReadonlyArray<(typeof SNAPSHOT_FIELDS)[number]>,
  beforeCents: number,
  expected: ExpectedCharge,
  money: MoneyFormat,
): string {
  const parts: string[] = []
  if (changes.includes('amountCents')) parts.push(`amount ${formatMoney(beforeCents, money)} → ${formatMoney(expected.amountCents, money)}`)
  if (changes.includes('dueDate')) parts.push(`due date → ${expected.dueDate}`)
  if (changes.includes('unitId') || changes.includes('propertyId')) parts.push('unit updated')
  if (changes.includes('issuedOn') && parts.length === 0) parts.push(`issue date → ${expected.issuedOn}`)
  return `Changed: ${parts.join(', ')}.`
}

