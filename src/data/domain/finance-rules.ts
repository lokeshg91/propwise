import { addDays, daysBetween } from '@/data/domain/dates'
import { percentOfCents, sumCents } from '@/data/domain/money'
import { type Charge, type Expense, type FinanceSettings, type Payment, type PropertyType } from '@/types'

/**
 * Finance rules shared by services, reconciliation and the UI. Statuses are
 * derived from records and `today`; they are never stored.
 */

/* ------------------------------------------------------------- statuses */

export const CHARGE_STATUSES = ['pending', 'partially-paid', 'overdue', 'paid', 'void'] as const
export type ChargeStatus = (typeof CHARGE_STATUSES)[number]

export const EXPENSE_STATUSES = ['pending', 'overdue', 'paid', 'void'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export const isActivePayment = (payment: Pick<Payment, 'voidedAt'>) => payment.voidedAt === undefined

/** Groups payments by charge id. */
export function paymentsByCharge(payments: readonly Payment[]): Map<string, Payment[]> {
  const map = new Map<string, Payment[]>()
  for (const payment of payments) {
    const list = map.get(payment.chargeId)
    if (list) list.push(payment)
    else map.set(payment.chargeId, [payment])
  }
  return map
}

export function paidCents(payments: readonly Payment[] = []): number {
  return sumCents(payments.filter(isActivePayment).map((payment) => payment.amountCents))
}

export interface ChargeState {
  status: ChargeStatus
  paidCents: number
  balanceCents: number
  /** Days past the due date while a balance remains (0 otherwise). */
  daysOverdue: number
  /** Fully paid, but the last payment came after the grace period. */
  paidLate: boolean
}

export function chargeState(charge: Charge, payments: readonly Payment[] = [], today: string, graceDays = 5): ChargeState {
  const paid = paidCents(payments)
  const balance = Math.max(0, charge.amountCents - paid)
  if (charge.voidedAt) return { status: 'void', paidCents: paid, balanceCents: 0, daysOverdue: 0, paidLate: false }
  const overdueDays = balance > 0 && charge.dueDate < today ? daysBetween(charge.dueDate, today) : 0
  if (balance === 0) {
    const last = payments.filter(isActivePayment).reduce((latest, payment) => (payment.receivedOn > latest ? payment.receivedOn : latest), '')
    return { status: 'paid', paidCents: paid, balanceCents: 0, daysOverdue: 0, paidLate: last > addDays(charge.dueDate, graceDays) }
  }
  if (paid > 0) return { status: 'partially-paid', paidCents: paid, balanceCents: balance, daysOverdue: overdueDays, paidLate: false }
  return { status: overdueDays > 0 ? 'overdue' : 'pending', paidCents: paid, balanceCents: balance, daysOverdue: overdueDays, paidLate: false }
}

export function expenseStatus(expense: Pick<Expense, 'voidedAt' | 'paidOn' | 'dueDate'>, today: string): ExpenseStatus {
  if (expense.voidedAt) return 'void'
  if (expense.paidOn) return 'paid'
  return expense.dueDate < today ? 'overdue' : 'pending'
}

/* ---------------------------------------------------------------- aging */

export const AGING_BUCKETS = ['current', '1-30', '31-60', '61-90', '90+'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

/** Bucket for an open balance by days past due (0 = not yet due or due today). */
export function agingBucket(daysOverdue: number): AgingBucket {
  if (daysOverdue <= 0) return 'current'
  if (daysOverdue <= 30) return '1-30'
  if (daysOverdue <= 60) return '31-60'
  if (daysOverdue <= 90) return '61-90'
  return '90+'
}

export const emptyAging = (): Record<AgingBucket, number> => ({ current: 0, '1-30': 0, '31-60': 0, '61-90': 0, '90+': 0 })

/* ------------------------------------------------------------ late fees */

/**
 * The late-fee rule (one definition used by the seed, services and UI copy):
 *
 * - Residential property: a fixed amount (`lateFee.residentialCents`, $50.00
 *   by default) per late rent charge. Not a percentage and not a cap.
 * - Commercial property: `lateFee.commercialPercent` (5 % by default) of the
 *   rent charge's full amount — not of the unpaid balance — rounded to the
 *   nearest cent. No minimum and no cap.
 * - Only rent charges, at most one late fee per charge, added by hand.
 * - Available once the rent is more than `graceDays` (5) days past due with a
 *   balance still open: due Oct 1 → grace Oct 2–6 → available from Oct 7.
 *   A payment made on or before the last grace day isn't late.
 */
export function suggestedLateFeeCents(charge: Pick<Charge, 'amountCents'>, propertyType: PropertyType, settings: Pick<FinanceSettings, 'lateFee'>): number {
  return propertyType === 'commercial' ? percentOfCents(charge.amountCents, settings.lateFee.commercialPercent) : settings.lateFee.residentialCents
}

/** First day a late fee can be added: the day after the grace period ends. */
export const lateFeeAvailableFrom = (dueDate: string, graceDays: number): string => addDays(dueDate, graceDays + 1)

/** Plain-language version of the rule for the UI. */
export function describeLateFeeRule(settings: Pick<FinanceSettings, 'lateFee' | 'graceDays'>, money: (cents: number) => string): string {
  return (
    `Residential: a fixed ${money(settings.lateFee.residentialCents)} per late rent charge. ` +
    `Commercial: ${settings.lateFee.commercialPercent}% of the full rent charge (not the unpaid balance), rounded to the cent, with no minimum or cap. ` +
    `A late fee can be added once per rent charge (a voided fee still counts) when a balance is still open more than ${settings.graceDays} days after the due date.`
  )
}

export type LateFeeBlock = 'not-rent' | 'void' | 'paid' | 'within-grace' | 'already-charged'

/** A late fee can be added once per rent charge, when a balance is still open after the grace period. */
export function lateFeeBlock(charge: Charge, state: ChargeState, today: string, graceDays: number, hasLateFee: boolean): LateFeeBlock | null {
  if (charge.category !== 'rent') return 'not-rent'
  if (state.status === 'void') return 'void'
  if (state.balanceCents === 0) return 'paid'
  if (today <= addDays(charge.dueDate, graceDays)) return 'within-grace'
  if (hasLateFee) return 'already-charged'
  return null
}

export const LATE_FEE_BLOCK_REASONS: Record<LateFeeBlock, string> = {
  'not-rent': 'Late fees apply to rent charges only.',
  void: 'This charge is void.',
  paid: 'This charge is paid in full.',
  'within-grace': 'The grace period hasn’t ended yet.',
  'already-charged': 'A late fee was already added for this charge. Only one late fee per charge is allowed, even if it was voided.',
}

/* ----------------------------------------------------------- duplicates */

/** Invoice numbers compare without case, spaces, "#", "No." or leading zeros. */
export function normalizeInvoiceNumber(value: string): string {
  return value
    .toLowerCase()
    .replace(/\bno\.?\s*/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/^0+(?=\d)/, '')
}

export const normalizePayee = (value: string): string => value.trim().toLowerCase().replace(/\s+/g, ' ')

const payeeKey = (expense: Pick<Expense, 'vendorId' | 'payeeName'>) =>
  expense.vendorId ? `v:${expense.vendorId}` : `p:${normalizePayee(expense.payeeName ?? '')}`

export interface DuplicateMatches<T> {
  /** Must not be saved (same invoice number for the same payee). */
  blocking: T[]
  /** Saved only after confirmation. */
  warnings: T[]
}

type ExpenseKey = Pick<Expense, 'vendorId' | 'payeeName' | 'invoiceNumber' | 'propertyId' | 'amountCents' | 'billDate'>

export function findExpenseDuplicates(expenses: readonly Expense[], input: ExpenseKey, exceptId?: string): DuplicateMatches<Expense> {
  const others = expenses.filter((expense) => expense.id !== exceptId && !expense.voidedAt && payeeKey(expense) === payeeKey(input))
  const invoice = input.invoiceNumber ? normalizeInvoiceNumber(input.invoiceNumber) : ''
  const blocking = invoice ? others.filter((expense) => expense.invoiceNumber && normalizeInvoiceNumber(expense.invoiceNumber) === invoice) : []
  const warnings = others.filter(
    (expense) =>
      !blocking.includes(expense) &&
      expense.propertyId === input.propertyId &&
      expense.amountCents === input.amountCents &&
      expense.billDate === input.billDate,
  )
  return { blocking, warnings }
}

type ChargeKey = Pick<Charge, 'leaseId' | 'propertyId' | 'payerName' | 'category' | 'amountCents' | 'dueDate'>

/** Same payer, category, amount and due date → warning. */
export function findChargeDuplicates(charges: readonly Charge[], input: ChargeKey, exceptId?: string): Charge[] {
  const payer = (charge: ChargeKey) => (charge.leaseId ? `l:${charge.leaseId}` : `p:${charge.propertyId}:${normalizePayee(charge.payerName ?? '')}`)
  return charges.filter(
    (charge) =>
      charge.id !== exceptId &&
      !charge.voidedAt &&
      payer(charge) === payer(input) &&
      charge.category === input.category &&
      charge.amountCents === input.amountCents &&
      charge.dueDate === input.dueDate,
  )
}

/** Same charge, amount and date → warning. */
export function findPaymentDuplicates(payments: readonly Payment[], input: Pick<Payment, 'chargeId' | 'amountCents' | 'receivedOn'>): Payment[] {
  return payments.filter(
    (payment) =>
      isActivePayment(payment) &&
      payment.chargeId === input.chargeId &&
      payment.amountCents === input.amountCents &&
      payment.receivedOn === input.receivedOn,
  )
}

/* ------------------------------------------------------------ variance */

/** Actual vs estimate as a percentage (one decimal), or null without a usable estimate. */
export function costVariancePercent(estimatedCents: number | undefined, amountCents: number): number | null {
  if (estimatedCents === undefined || estimatedCents <= 0) return null
  return Math.round(((amountCents - estimatedCents) / estimatedCents) * 1000) / 10
}
