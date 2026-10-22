import { addDays } from '@/data/domain/dates'
import { type Lease, type RecurringCharge } from '@/types'

/**
 * When leases and recurring schedules are billed. Pure functions: `today`
 * and the finance start month are always passed in.
 */

/* ---------------------------------------------------------------- periods */

/** "2026-10-22" → "2026-10". Also accepts ISO timestamps. */
export const periodOf = (date: string): string => date.slice(0, 7)

export function addPeriods(period: string, months: number): string {
  const [year, month] = period.split('-').map(Number)
  const index = (year ?? 1970) * 12 + ((month ?? 1) - 1) + months
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
}

/** Inclusive list of months, e.g. ("2025-11", "2026-01") → [2025-11, 2025-12, 2026-01]. */
export function periodRange(from: string, to: string): string[] {
  const periods: string[] = []
  for (let period = from; period <= to && periods.length < 1200; period = addPeriods(period, 1)) periods.push(period)
  return periods
}

export const firstDayOf = (period: string): string => `${period}-01`

export function lastDayOf(period: string): string {
  return addDays(firstDayOf(addPeriods(period, 1)), -1)
}

/** Due date for a billing month; due days are 1–28 so every month has one. */
export function dueDateFor(period: string, dueDay: number): string {
  return `${period}-${String(Math.min(Math.max(dueDay, 1), 28)).padStart(2, '0')}`
}

/* ------------------------------------------------------------------ leases */

export interface ScheduleContext {
  /** First month Finance tracks. */
  startPeriod: string
  /** Posting horizon: charges are posted through this month. */
  throughPeriod: string
  /** Leases cancelled before move-in (never billed). */
  cancelledLeaseIds: ReadonlySet<string>
}

export type BillingBlock =
  | 'pending'
  | 'cancelled-before-move-in'
  | 'before-finance-start'
  | 'before-recorded'
  | 'before-lease-start'
  | 'after-lease-end'
  | 'future'

const BLOCK_REASONS: Record<BillingBlock, string> = {
  pending: 'The lease hasn’t started yet.',
  'cancelled-before-move-in': 'The lease was cancelled before move-in.',
  'before-finance-start': 'The month is before Finance records start.',
  'before-recorded': 'The lease was recorded in Propwise after this month.',
  'before-lease-start': 'The lease start moved after this due date.',
  'after-lease-end': 'The lease ended before this charge was due.',
  future: 'The month hasn’t started yet.',
}

export const billingBlockReason = (block: BillingBlock): string => BLOCK_REASONS[block]

/** Last date a lease can be billed for, or null while it runs open-ended (active or in holdover). */
function billingEnd(lease: Lease): string | null {
  if (lease.endedAt) return lease.endedAt
  return lease.status === 'active' ? null : lease.endDate
}

/**
 * Whether rent for `period` is billable, and why not. A month is billed in
 * full when its due date falls inside the occupancy window (no proration).
 * Backdated leases are billed from the month they were recorded in Propwise.
 */
export function leaseBillingBlock(lease: Lease, period: string, context: ScheduleContext): BillingBlock | null {
  if (lease.status === 'pending') return 'pending'
  if (context.cancelledLeaseIds.has(lease.id)) return 'cancelled-before-move-in'
  if (period < context.startPeriod) return 'before-finance-start'
  if (period > context.throughPeriod) return 'future'
  if (period < periodOf(lease.createdAt)) return 'before-recorded'
  const due = dueDateFor(period, lease.paymentDueDay)
  if (due < lease.startDate) return 'before-lease-start'
  const end = billingEnd(lease)
  if (end !== null && due > end) return 'after-lease-end'
  return null
}

/** Months with a rent charge, oldest first. */
export function leaseBillablePeriods(lease: Lease, context: ScheduleContext): string[] {
  if (lease.status === 'pending' || context.cancelledLeaseIds.has(lease.id)) return []
  const first = [context.startPeriod, periodOf(lease.createdAt), periodOf(lease.startDate)].sort().at(-1) ?? context.startPeriod
  return periodRange(first, context.throughPeriod).filter((period) => leaseBillingBlock(lease, period, context) === null)
}

export interface ExpectedCharge {
  amountCents: number
  dueDate: string
  issuedOn: string
  propertyId: string
  unitId: string
}

/** The rent charge a lease produces for a month, from its current terms. */
export function expectedRentCharge(lease: Lease, period: string, rentCents: number): ExpectedCharge {
  const first = firstDayOf(period)
  return {
    amountCents: rentCents,
    dueDate: dueDateFor(period, lease.paymentDueDay),
    issuedOn: lease.startDate > first ? lease.startDate : first,
    propertyId: lease.propertyId,
    unitId: lease.unitId,
  }
}

/* -------------------------------------------------------------- recurring */

/** A recurring schedule bills a month only while the schedule and its lease are both billable. */
export function recurringBillingBlock(
  schedule: RecurringCharge,
  lease: Lease,
  period: string,
  context: ScheduleContext,
): BillingBlock | 'outside-schedule' | null {
  if (period < schedule.startPeriod || (schedule.endPeriod !== undefined && period > schedule.endPeriod)) return 'outside-schedule'
  return leaseBillingBlock(lease, period, context)
}

export function recurringBillablePeriods(schedule: RecurringCharge, lease: Lease, context: ScheduleContext): string[] {
  const first = schedule.startPeriod > context.startPeriod ? schedule.startPeriod : context.startPeriod
  return periodRange(first, context.throughPeriod).filter((period) => recurringBillingBlock(schedule, lease, period, context) === null)
}

/** Projected (not stored) charges for the month after the posting horizon, for "Upcoming". */
export function projectedRent(leases: readonly Lease[], context: ScheduleContext, rentCents: (lease: Lease) => number) {
  const period = addPeriods(context.throughPeriod, 1)
  const projection: ScheduleContext = { ...context, throughPeriod: period }
  return leases
    .filter((lease) => lease.status === 'active' && leaseBillingBlock(lease, period, projection) === null)
    .map((lease) => ({ leaseId: lease.id, period, ...expectedRentCharge(lease, period, rentCents(lease)) }))
}
