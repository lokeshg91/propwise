import { addDays, todayIso } from '@/data/domain/dates'
import {
  chargeState,
  expenseStatus,
  findChargeDuplicates,
  findExpenseDuplicates,
  findPaymentDuplicates,
  isActivePayment,
  LATE_FEE_BLOCK_REASONS,
  lateFeeAvailableFrom,
  lateFeeBlock,
  paymentsByCharge,
  suggestedLateFeeCents,
  type ChargeState,
  type ExpenseStatus,
  agingBucket,
  emptyAging,
  type AgingBucket,
} from '@/data/domain/finance-rules'
import { PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { firstDayOf, periodOf, projectedRent } from '@/data/domain/finance-schedule'
import {
  depositsHeldCents,
  expenseBreakdown,
  monthlyTrend,
  payablesFor,
  propertyPerformance,
  receivablesFor,
  recentMovements,
  resolveRange,
  totalsFor,
  upcomingObligations,
  type FinanceRange,
  type FinanceSnapshot,
  type PropertyScope,
} from '@/data/domain/finance-summary'
import { isSupportedCurrency, isValidCents, toCents } from '@/data/domain/money'
import { createId, readDatabase, updateDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { nextReference, scheduleContext } from '@/data/store/finance-reconcile'
import { ServiceError } from '@/data/services/service-error'
import { simulateLatency } from '@/data/services/simulate-latency'
import { formatMoney } from '@/lib/format'
import {
  type Charge,
  type Expense,
  type ExpenseCategory,
  type FinanceEvent,
  type FinanceSettings,
  type IncomeCategory,
  type Payment,
  type PaymentMethod,
  type PropertyType,
  type RecurringCategory,
  type RecurringCharge,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  RECURRING_CATEGORIES,
} from '@/types'

/* ------------------------------------------------------------------ errors */

/**
 * A possible duplicate. `requiresConfirmation` is false when it must not be
 * saved (same invoice number for the same payee); otherwise save again with
 * `acknowledgeDuplicate`.
 */
export class FinanceDuplicateError extends ServiceError {
  readonly matches: Array<{ id: string; reference: string }>
  readonly requiresConfirmation: boolean

  constructor(message: string, field: string, matches: Array<{ id: string; reference: string }>, requiresConfirmation: boolean) {
    super('conflict', message, field)
    this.name = 'FinanceDuplicateError'
    this.matches = matches
    this.requiresConfirmation = requiresConfirmation
  }
}

export const isFinanceDuplicateError = (error: unknown): error is FinanceDuplicateError => error instanceof FinanceDuplicateError

export const FINANCE_LIMITS = { description: 160, payerName: 80, note: 300, reason: 300, reference: 40 } as const

/* ------------------------------------------------------------------ reads */

export function snapshotOf(db: DemoDatabase): FinanceSnapshot {
  return {
    charges: db.charges,
    payments: db.payments,
    expenses: db.expenses,
    properties: db.properties,
    units: db.units,
    leases: db.leases,
    workOrders: db.workOrders,
    graceDays: db.finance.graceDays,
  }
}

export interface FinanceFilters {
  range: FinanceRange
  propertyType: PropertyType | 'all'
  propertyId: string | 'all'
}

export const DEFAULT_FINANCE_FILTERS: FinanceFilters = { range: '3m', propertyType: 'all', propertyId: 'all' }

function scopeFor(db: DemoDatabase, filters: Pick<FinanceFilters, 'propertyType' | 'propertyId'>): PropertyScope {
  if (filters.propertyId !== 'all') return new Set([filters.propertyId])
  if (filters.propertyType === 'all') return null
  return new Set(db.properties.filter((property) => property.type === filters.propertyType).map((property) => property.id))
}

export function getFinanceSettings(): Promise<FinanceSettings> {
  return simulateLatency(readDatabase().finance)
}

export function getFinanceOverview(filters: FinanceFilters = DEFAULT_FINANCE_FILTERS) {
  const db = readDatabase()
  const today = todayIso()
  const range = resolveRange(filters.range, today)
  const scope = scopeFor(db, filters)
  const snapshot = snapshotOf(db)
  const requestProperty = new Map(db.serviceRequests.map((request) => [request.id, request.propertyId]))
  const projected = projectedRent(db.leases, scheduleContext(db, today), (lease) => toCents(lease.monthlyRent))
  return simulateLatency({
    filters,
    range,
    settings: db.finance,
    totals: totalsFor(snapshot, range, scope),
    // No comparison when the previous period starts before Finance history: it would be a partial period.
    previousTotals: range.previous.from < firstDayOf(db.finance.startPeriod) ? null : totalsFor(snapshot, range.previous, scope),
    receivables: receivablesFor(snapshot, today, scope),
    payables: payablesFor(snapshot, today, scope, (id) => requestProperty.get(id)),
    depositsHeldCents: depositsHeldCents(db.leases, scope),
    trend: monthlyTrend(snapshot, range.periods, scope),
    properties: propertyPerformance(snapshot, range, today, scope),
    expenseBreakdown: expenseBreakdown(snapshot, range, scope),
    recent: recentMovements(snapshot, scope, 10),
    upcoming: upcomingObligations(snapshot, today, scope, projected, 30),
    completedWithoutCost: db.workOrders.filter((order) => order.status === 'completed' && order.actualCost === null).length,
  })
}

export type FinanceOverview = Awaited<ReturnType<typeof getFinanceOverview>>

export type TransactionRow =
  | {
      kind: 'income'
      id: string
      reference: string
      date: string
      category: IncomeCategory
      party: string
      /** Tenant profile for lease charges. */
      partyHref: string | null
      /** `tenant:<id>` for lease charges: the Transactions `party` filter. */
      partyKey: string | null
      description: string
      propertyId: string
      propertyName: string
      unitLabel: string
      amountCents: number
      balanceCents: number
      state: ChargeState
      demo: boolean
      record: Charge
    }
  | {
      kind: 'expense'
      id: string
      reference: string
      date: string
      category: ExpenseCategory
      party: string
      /** Vendor profile when the payee is a vendor. */
      partyHref: string | null
      /** `vendor:<id>` when the payee is a vendor: the Transactions `party` filter. */
      partyKey: string | null
      description: string
      propertyId: string
      propertyName: string
      unitLabel: string
      amountCents: number
      balanceCents: number
      status: ExpenseStatus
      demo: boolean
      record: Expense
    }

/** Every income and expense record with its derived status. Filtering happens in the list. */
const tenantKey = (tenantId: string | null) => (tenantId ? `tenant:${tenantId}` : null)

export function getTransactions(): Promise<TransactionRow[]> {
  const db = readDatabase()
  const today = todayIso()
  const names = nameLookups(db)
  const payments = paymentsByCharge(db.payments)
  const rows: TransactionRow[] = []
  for (const charge of db.charges) {
    const state = chargeState(charge, payments.get(charge.id), today, db.finance.graceDays)
    rows.push({
      kind: 'income',
      id: charge.id,
      reference: charge.reference,
      date: charge.dueDate,
      category: charge.category,
      party: chargeParty(charge, names),
      partyHref: charge.leaseId ? names.tenantHref(charge.leaseId) : null,
      partyKey: tenantKey(charge.leaseId ? names.tenantId(charge.leaseId) : null),
      description: charge.description ?? '',
      propertyId: charge.propertyId,
      propertyName: names.property(charge.propertyId),
      unitLabel: names.unit(charge.unitId, charge.propertyId),
      amountCents: charge.amountCents,
      balanceCents: state.balanceCents,
      state,
      demo: charge.demo === true,
      record: charge,
    })
  }
  for (const expense of db.expenses) {
    const status = expenseStatus(expense, today)
    rows.push({
      kind: 'expense',
      id: expense.id,
      reference: expense.reference,
      date: expense.billDate,
      category: expense.category,
      party: expenseParty(expense, names),
      partyHref: expense.vendorId ? `/vendors/${expense.vendorId}` : null,
      partyKey: expense.vendorId ? `vendor:${expense.vendorId}` : null,
      description: expense.description,
      propertyId: expense.propertyId,
      propertyName: names.property(expense.propertyId),
      unitLabel: names.unit(expense.unitId, expense.propertyId),
      amountCents: expense.amountCents,
      balanceCents: status === 'pending' || status === 'overdue' ? expense.amountCents : 0,
      status,
      demo: expense.demo === true,
      record: expense,
    })
  }
  return simulateLatency(rows.sort((a, b) => b.date.localeCompare(a.date) || b.reference.localeCompare(a.reference)))
}

export interface TimelineEntry {
  id: string
  at: string
  kind: 'posted' | 'created' | 'payment' | 'payment-voided' | FinanceEvent['kind']
  actor: 'user' | 'system' | 'demo'
  title: string
  description: string
  amountCents?: number
}

export type TransactionDetail =
  | {
      kind: 'income'
      charge: Charge
      state: ChargeState
      payments: Payment[]
      lease: DemoDatabase['leases'][number] | null
      tenant: DemoDatabase['tenants'][number] | null
      property: DemoDatabase['properties'][number] | null
      unit: DemoDatabase['units'][number] | null
      parent: Charge | null
      lateFee: Charge | null
      recurring: RecurringCharge | null
      lateFeeAllowed: { allowed: boolean; reason: string | null; suggestedCents: number; availableFrom: string }
      timeline: TimelineEntry[]
      settings: FinanceSettings
    }
  | {
      kind: 'expense'
      expense: Expense
      status: ExpenseStatus
      vendor: DemoDatabase['vendors'][number] | null
      property: DemoDatabase['properties'][number] | null
      unit: DemoDatabase['units'][number] | null
      workOrder: DemoDatabase['workOrders'][number] | null
      request: DemoDatabase['serviceRequests'][number] | null
      timeline: TimelineEntry[]
      settings: FinanceSettings
    }

export function getTransactionDetail(id: string): Promise<TransactionDetail | null> {
  const db = readDatabase()
  const today = todayIso()
  const charge = db.charges.find((entry) => entry.id === id)
  if (charge) {
    const payments = db.payments.filter((payment) => payment.chargeId === id).sort((a, b) => a.receivedOn.localeCompare(b.receivedOn))
    const state = chargeState(charge, payments, today, db.finance.graceDays)
    const property = db.properties.find((entry) => entry.id === charge.propertyId) ?? null
    const lease = charge.leaseId ? (db.leases.find((entry) => entry.id === charge.leaseId) ?? null) : null
    // One late-fee record per rent charge, ever: a voided fee still counts (and is shown with its reason).
    const fees = db.charges.filter((entry) => entry.parentChargeId === id)
    const lateFee = fees.find((entry) => !entry.voidedAt) ?? fees.at(-1) ?? null
    const block = lateFeeBlock(charge, state, today, db.finance.graceDays, fees.length > 0)
    return simulateLatency({
      kind: 'income',
      charge,
      state,
      payments,
      lease,
      tenant: lease ? (db.tenants.find((entry) => entry.id === lease.tenantId) ?? null) : null,
      property,
      unit: charge.unitId ? (db.units.find((entry) => entry.id === charge.unitId) ?? null) : null,
      parent: charge.parentChargeId ? (db.charges.find((entry) => entry.id === charge.parentChargeId) ?? null) : null,
      lateFee,
      recurring: charge.recurringId ? (db.recurringCharges.find((entry) => entry.id === charge.recurringId) ?? null) : null,
      lateFeeAllowed: {
        allowed: block === null,
        reason: block === 'within-grace' ? `The grace period ends on ${addDays(charge.dueDate, db.finance.graceDays)}.` : block ? LATE_FEE_BLOCK_REASONS[block] : null,
        availableFrom: lateFeeAvailableFrom(charge.dueDate, db.finance.graceDays),
        suggestedCents: suggestedLateFeeCents(charge, property?.type ?? 'residential', db.finance),
      },
      timeline: chargeTimeline(db, charge, payments),
      settings: db.finance,
    } satisfies TransactionDetail)
  }
  const expense = db.expenses.find((entry) => entry.id === id)
  if (!expense) return simulateLatency(null)
  const workOrder = expense.workOrderId ? (db.workOrders.find((entry) => entry.id === expense.workOrderId) ?? null) : null
  return simulateLatency({
    kind: 'expense',
    expense,
    status: expenseStatus(expense, today),
    vendor: expense.vendorId ? (db.vendors.find((entry) => entry.id === expense.vendorId) ?? null) : null,
    property: db.properties.find((entry) => entry.id === expense.propertyId) ?? null,
    unit: expense.unitId ? (db.units.find((entry) => entry.id === expense.unitId) ?? null) : null,
    workOrder,
    request: workOrder ? (db.serviceRequests.find((entry) => entry.id === workOrder.requestId) ?? null) : null,
    timeline: expenseTimeline(db, expense),
    settings: db.finance,
  } satisfies TransactionDetail)
}

export interface ReceivableRow {
  leaseId: string
  tenantId: string
  tenantName: string
  propertyId: string
  propertyName: string
  unitLabel: string
  monthlyRentCents: number
  balanceCents: number
  aging: Record<AgingBucket, number>
  oldestDueDate: string | null
  lastPaymentOn: string | null
  openCharges: number
  demo: boolean
}

/** Open balances per lease, as of today. */
export function getReceivables(): Promise<ReceivableRow[]> {
  const db = readDatabase()
  const today = todayIso()
  const names = nameLookups(db)
  const payments = paymentsByCharge(db.payments)
  const rows = new Map<string, ReceivableRow>()
  const demoLeases = new Set(db.finance.demoScope.leaseIds)
  for (const lease of db.leases) {
    rows.set(lease.id, {
      leaseId: lease.id,
      tenantId: lease.tenantId,
      tenantName: names.tenant(lease.tenantId),
      propertyId: lease.propertyId,
      propertyName: names.property(lease.propertyId),
      unitLabel: names.unit(lease.unitId, lease.propertyId),
      monthlyRentCents: toCents(lease.monthlyRent),
      balanceCents: 0,
      aging: emptyAging(),
      oldestDueDate: null,
      lastPaymentOn: null,
      openCharges: 0,
      demo: demoLeases.has(lease.id),
    })
  }
  for (const charge of db.charges) {
    const row = charge.leaseId ? rows.get(charge.leaseId) : undefined
    if (!row) continue
    const list = payments.get(charge.id) ?? []
    for (const payment of list) if (isActivePayment(payment) && (!row.lastPaymentOn || payment.receivedOn > row.lastPaymentOn)) row.lastPaymentOn = payment.receivedOn
    if (charge.voidedAt || charge.dueDate > today) continue
    const state = chargeState(charge, list, today, db.finance.graceDays)
    if (state.balanceCents === 0) continue
    row.balanceCents += state.balanceCents
    row.openCharges += 1
    row.aging[agingBucket(state.daysOverdue)] += state.balanceCents
    if (!row.oldestDueDate || charge.dueDate < row.oldestDueDate) row.oldestDueDate = charge.dueDate
  }
  return simulateLatency([...rows.values()].sort((a, b) => b.balanceCents - a.balanceCents || a.tenantName.localeCompare(b.tenantName)))
}

export interface TenantLedgerEntry {
  charge: Charge
  state: ChargeState
  /** All payments on the charge, voided ones included, oldest first. */
  payments: Payment[]
  unitLabel: string
  propertyName: string
}

export interface TenantPaymentRow {
  payment: Payment
  charge: Pick<Charge, 'id' | 'reference' | 'category' | 'period' | 'description'>
}

export interface TenantFinance {
  /** Every charge billed to the tenant's leases (voided ones included), newest due date first. */
  entries: TenantLedgerEntry[]
  /** Every payment received from the tenant (voided ones included, with their reasons), newest first. */
  payments: TenantPaymentRow[]
  balanceCents: number
  overdueCents: number
  aging: Record<AgingBucket, number>
  /** Active payments received in the last 12 months. */
  receivedLast12Cents: number
  receivedLast12Count: number
  /** Share of fully paid rent charges paid within the grace period; null before any are paid. */
  onTimeRate: number | null
  /** The next charge due: a posted one, or next month's rent while it is only projected. */
  next: { dueDate: string; amountCents: number; projected: boolean; chargeId: string | null } | null
  recurring: RecurringCharge[]
  /** The current (or most recent) lease, used for "Add income". */
  leaseId: string | null
  /** Finance records start in this month; months before it aren't stored (Decision 5). */
  startPeriod: string
  /** True when a lease began before `startPeriod`, so earlier months aren't listed. */
  startsBeforeWindow: boolean
  hasDemo: boolean
  settings: FinanceSettings
}

/**
 * The tenant Payments tab: the tenant's charges and payments straight from
 * the stored Finance ledger (it replaced the ledger v0.7 generated on every
 * read). Nothing is derived or invented here; voided records stay listed.
 */
export function getTenantFinance(tenantId: string): Promise<TenantFinance> {
  const db = readDatabase()
  const today = todayIso()
  const names = nameLookups(db)
  const leases = db.leases.filter((lease) => lease.tenantId === tenantId)
  const leaseIds = new Set(leases.map((lease) => lease.id))
  const byCharge = paymentsByCharge(db.payments)
  const charges = db.charges.filter((charge) => charge.leaseId !== undefined && leaseIds.has(charge.leaseId))
  const entries: TenantLedgerEntry[] = charges
    .map((charge) => {
      const payments = [...(byCharge.get(charge.id) ?? [])].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.reference.localeCompare(b.reference))
      return {
        charge,
        state: chargeState(charge, payments, today, db.finance.graceDays),
        payments,
        unitLabel: names.unit(charge.unitId, charge.propertyId),
        propertyName: names.property(charge.propertyId),
      }
    })
    .sort((a, b) => b.charge.dueDate.localeCompare(a.charge.dueDate) || b.charge.reference.localeCompare(a.charge.reference))
  const payments: TenantPaymentRow[] = entries
    .flatMap((entry) =>
      entry.payments.map((payment) => ({
        payment,
        charge: { id: entry.charge.id, reference: entry.charge.reference, category: entry.charge.category, period: entry.charge.period, description: entry.charge.description },
      })),
    )
    .sort((a, b) => b.payment.receivedOn.localeCompare(a.payment.receivedOn) || b.payment.reference.localeCompare(a.payment.reference))

  const aging = emptyAging()
  let balanceCents = 0
  let overdueCents = 0
  for (const { charge, state } of entries) {
    if (state.balanceCents === 0 || charge.dueDate > today) continue
    balanceCents += state.balanceCents
    if (state.daysOverdue > 0) overdueCents += state.balanceCents
    aging[agingBucket(state.daysOverdue)] += state.balanceCents
  }
  const yearAgo = addDays(today, -365)
  const recent = payments.filter(({ payment }) => isActivePayment(payment) && payment.receivedOn > yearAgo && payment.receivedOn <= today)
  const paidRent = entries.filter(({ charge, state }) => charge.category === 'rent' && state.status === 'paid')

  const current = [...leases].sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.startDate.localeCompare(a.startDate))[0]
  const upcoming = entries.filter(({ charge, state }) => charge.dueDate > today && state.balanceCents > 0).at(-1)
  const projected = projectedRent(leases, scheduleContext(db, today), (lease) => toCents(lease.monthlyRent))[0]
  const next = upcoming
    ? { dueDate: upcoming.charge.dueDate, amountCents: upcoming.state.balanceCents, projected: false, chargeId: upcoming.charge.id }
    : projected
      ? { dueDate: projected.dueDate, amountCents: projected.amountCents, projected: true, chargeId: null }
      : null

  return simulateLatency({
    entries,
    payments,
    balanceCents,
    overdueCents,
    aging,
    receivedLast12Cents: recent.reduce((total, { payment }) => total + payment.amountCents, 0),
    receivedLast12Count: recent.length,
    onTimeRate: paidRent.length === 0 ? null : (paidRent.filter(({ state }) => !state.paidLate).length / paidRent.length) * 100,
    next,
    recurring: db.recurringCharges.filter((entry) => leaseIds.has(entry.leaseId)),
    leaseId: current?.id ?? null,
    startPeriod: db.finance.startPeriod,
    startsBeforeWindow: leases.some((lease) => periodOf(lease.startDate) < db.finance.startPeriod),
    hasDemo: entries.some(({ charge }) => charge.demo === true),
    settings: db.finance,
  })
}

export interface FinanceFormOptions {
  properties: Array<{ id: string; name: string; type: PropertyType; units: Array<{ id: string; label: string }> }>
  /** Leases a tenant charge can be billed to (current leases first). */
  leases: Array<{ id: string; propertyId: string; unitId: string; tenantName: string; unitLabel: string; current: boolean; status: string }>
  /** Vendors new bills can be paid to (inactive vendors are excluded). */
  vendors: Array<{ id: string; name: string }>
  settings: FinanceSettings
}

export function getFinanceFormOptions(): Promise<FinanceFormOptions> {
  const db = readDatabase()
  const names = nameLookups(db)
  return simulateLatency({
    properties: db.properties
      .map((property) => ({
        id: property.id,
        name: property.name,
        type: property.type,
        units: db.units
          .filter((unit) => unit.propertyId === property.id)
          .map((unit) => ({ id: unit.id, label: names.unit(unit.id, property.id) }))
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    leases: db.leases
      .map((lease) => ({
        id: lease.id,
        propertyId: lease.propertyId,
        unitId: lease.unitId,
        tenantName: names.tenant(lease.tenantId),
        unitLabel: names.unit(lease.unitId, lease.propertyId),
        current: lease.status === 'active' || lease.status === 'pending',
        status: lease.status,
      }))
      .sort((a, b) => Number(b.current) - Number(a.current) || a.unitLabel.localeCompare(b.unitLabel, undefined, { numeric: true })),
    vendors: db.vendors.filter((vendor) => vendor.active).map((vendor) => ({ id: vendor.id, name: vendor.name })).sort((a, b) => a.name.localeCompare(b.name)),
    settings: db.finance,
  })
}

/** The property Finance tab: the overview scoped to one property, plus its tenants with open balances. */
export async function getPropertyFinance(propertyId: string, range: FinanceRange = '12m') {
  const [overview, receivables] = await Promise.all([getFinanceOverview({ range, propertyType: 'all', propertyId }), getReceivables()])
  return { ...overview, tenants: receivables.filter((row) => row.propertyId === propertyId && row.balanceCents > 0) }
}

export type PropertyFinance = Awaited<ReturnType<typeof getPropertyFinance>>

/* ----------------------------------------------------------------- writes */

export interface ChargeInput {
  /** Tenant charge; property and unit come from the lease. */
  leaseId?: string
  /** Non-tenant income. */
  propertyId?: string
  unitId?: string
  payerName?: string
  category: IncomeCategory
  description: string
  amountCents: number
  issuedOn?: string
  dueDate: string
}

export interface ReceivedNow {
  receivedOn: string
  method: PaymentMethod
  externalRef?: string
}

export function createCharge(input: ChargeInput, options: { acknowledgeDuplicate?: boolean; receivedNow?: ReceivedNow } = {}): Promise<Charge> {
  return run(() =>
    updateDatabase((db) => {
      const today = todayIso()
      const fields = chargeFields(db, input, today)
      const duplicates = findChargeDuplicates(db.charges, fields)
      if (duplicates.length > 0 && !options.acknowledgeDuplicate) {
        throw new FinanceDuplicateError('A charge with the same payer, category, amount and due date already exists.', 'amountCents', refs(duplicates), true)
      }
      const now = new Date().toISOString()
      const charge: Charge = { id: createId('chg'), reference: nextReference(db, 'income'), source: 'manual', ...fields, createdAt: now }
      db.charges.push(charge)
      event(db, 'charge', charge.id, 'created', 'Charge added', describeParty(db, charge), now, { amountCents: charge.amountCents })
      if (options.receivedNow) addPayment(db, charge, { amountCents: charge.amountCents, ...options.receivedNow }, today, now)
      return charge
    }),
  )
}

/** Edits a manual charge. Lease, recurring and late-fee charges are changed with `adjustCharge`. */
export function updateCharge(id: string, input: Pick<ChargeInput, 'description' | 'amountCents' | 'dueDate' | 'payerName'>, options: { acknowledgeDuplicate?: boolean } = {}): Promise<Charge> {
  return run(() =>
    updateDatabase((db) => {
      const charge = findCharge(db, id)
      assertNotVoid(charge)
      if (charge.source !== 'manual') throw new ServiceError('conflict', 'Only charges added by hand can be edited. Use Adjust amount instead.')
      const paid = paidFor(db, id)
      assertAmount(input.amountCents, 'amountCents', paid)
      assertDate(input.dueDate, 'dueDate')
      if (input.dueDate < charge.issuedOn) throw new ServiceError('invalid', 'Due date can’t be before the issue date.', 'dueDate')
      const description = text(input.description, 'description', FINANCE_LIMITS.description, false)
      const payerName = charge.leaseId ? undefined : text(input.payerName ?? '', 'payerName', FINANCE_LIMITS.payerName, true)
      const next = { ...charge, description, amountCents: input.amountCents, dueDate: input.dueDate, ...(payerName ? { payerName } : {}) }
      const changed = (['description', 'amountCents', 'dueDate', 'payerName'] as const).filter((key) => next[key] !== charge[key])
      if (changed.length === 0) return charge
      const duplicates = findChargeDuplicates(db.charges, next, id)
      if (duplicates.length > 0 && !options.acknowledgeDuplicate) {
        throw new FinanceDuplicateError('A charge with the same payer, category, amount and due date already exists.', 'amountCents', refs(duplicates), true)
      }
      const now = new Date().toISOString()
      Object.assign(charge, next, { updatedAt: now })
      event(db, 'charge', id, 'edited', 'Charge edited', `Changed: ${changed.join(', ')}.`, now)
      return charge
    }),
  )
}

/** Changes the amount of any open charge, with a reason. Reconciliation never changes an adjusted charge again. */
export function adjustCharge(id: string, amountCents: number, reason: string): Promise<Charge> {
  return run(() =>
    updateDatabase((db) => {
      const charge = findCharge(db, id)
      assertNotVoid(charge)
      const why = text(reason, 'reason', FINANCE_LIMITS.reason, true)
      assertAmount(amountCents, 'amountCents', paidFor(db, id))
      if (amountCents === charge.amountCents) throw new ServiceError('invalid', 'Enter a different amount.', 'amountCents')
      const now = new Date().toISOString()
      const before = charge.amountCents
      Object.assign(charge, { amountCents, adjusted: true, updatedAt: now } satisfies Partial<Charge>)
      event(db, 'charge', id, 'adjusted', 'Amount adjusted', `From ${formatMoney(before, db.finance)} to ${formatMoney(amountCents, db.finance)}.`, now, { reason: why, amountCents })
      return charge
    }),
  )
}

export function voidCharge(id: string, reason: string): Promise<Charge> {
  return run(() =>
    updateDatabase((db) => {
      const charge = findCharge(db, id)
      assertNotVoid(charge)
      const why = text(reason, 'reason', FINANCE_LIMITS.reason, true)
      const active = db.payments.filter((payment) => payment.chargeId === id && isActivePayment(payment))
      if (active.length > 0) {
        throw new ServiceError('conflict', `Void the ${active.length === 1 ? 'payment' : `${active.length} payments`} on this charge first (${active.map((payment) => payment.reference).join(', ')}).`)
      }
      const fee = db.charges.find((entry) => entry.parentChargeId === id && !entry.voidedAt)
      if (fee) throw new ServiceError('conflict', `Void the late fee ${fee.reference} first.`)
      const now = new Date().toISOString()
      Object.assign(charge, { voidedAt: now, voidReason: why, voidedBy: 'user', updatedAt: now } satisfies Partial<Charge>)
      event(db, 'charge', id, 'voided', 'Charge voided', 'The charge no longer counts towards the balance.', now, { reason: why })
      return charge
    }),
  )
}

export interface PaymentInput {
  amountCents: number
  receivedOn: string
  method: PaymentMethod
  externalRef?: string
  note?: string
}

export function recordPayment(chargeId: string, input: PaymentInput, options: { acknowledgeDuplicate?: boolean } = {}): Promise<Payment> {
  return run(() =>
    updateDatabase((db) => {
      const charge = findCharge(db, chargeId)
      assertNotVoid(charge)
      const duplicates = findPaymentDuplicates(db.payments, { chargeId, amountCents: input.amountCents, receivedOn: input.receivedOn })
      if (duplicates.length > 0 && !options.acknowledgeDuplicate) {
        throw new FinanceDuplicateError('A payment of this amount on this date is already recorded for this charge.', 'amountCents', refs(duplicates), true)
      }
      return addPayment(db, charge, input, todayIso(), new Date().toISOString())
    }),
  )
}

export function voidPayment(paymentId: string, reason: string): Promise<Payment> {
  return run(() =>
    updateDatabase((db) => {
      const payment = db.payments.find((entry) => entry.id === paymentId)
      if (!payment) throw new ServiceError('not-found', 'Payment not found.')
      if (payment.voidedAt) throw new ServiceError('conflict', 'This payment is already void.')
      const why = text(reason, 'reason', FINANCE_LIMITS.reason, true)
      const now = new Date().toISOString()
      Object.assign(payment, { voidedAt: now, voidReason: why } satisfies Partial<Payment>)
      event(db, 'charge', payment.chargeId, 'payment-voided', 'Payment voided', `${payment.reference} was voided.`, now, { reason: why, amountCents: payment.amountCents, paymentId })
      return payment
    }),
  )
}

/**
 * Adds the late fee for a rent charge. The amount always comes from the
 * central rule (`suggestedLateFeeCents`) and can't be chosen by the caller:
 * residential a fixed amount, commercial a percentage of the full charge.
 * At most one late-fee record per rent charge: voiding the fee keeps the
 * record and doesn't allow another one.
 */
export function addLateFee(chargeId: string): Promise<Charge> {
  return run(() =>
    updateDatabase((db) => {
      const charge = findCharge(db, chargeId)
      const today = todayIso()
      const payments = db.payments.filter((payment) => payment.chargeId === chargeId)
      const state = chargeState(charge, payments, today, db.finance.graceDays)
      // Voided fees count too: a rent charge gets at most one late-fee record.
      const existing = db.charges.some((entry) => entry.parentChargeId === chargeId)
      const block = lateFeeBlock(charge, state, today, db.finance.graceDays, existing)
      if (block) throw new ServiceError('conflict', LATE_FEE_BLOCK_REASONS[block])
      const type = db.properties.find((property) => property.id === charge.propertyId)?.type ?? 'residential'
      const fee = suggestedLateFeeCents(charge, type, db.finance)
      const now = new Date().toISOString()
      const created: Charge = {
        id: createId('chg'),
        reference: nextReference(db, 'income'),
        category: 'late-fee',
        source: 'late-fee',
        ...(charge.leaseId ? { leaseId: charge.leaseId } : {}),
        parentChargeId: charge.id,
        propertyId: charge.propertyId,
        ...(charge.unitId ? { unitId: charge.unitId } : {}),
        ...(charge.period ? { period: charge.period } : {}),
        description: 'Late fee',
        amountCents: fee,
        issuedOn: today,
        dueDate: today,
        createdAt: now,
      }
      db.charges.push(created)
      event(db, 'charge', charge.id, 'late-fee-added', 'Late fee added', `${created.reference} was added.`, now, { amountCents: fee })
      event(db, 'charge', created.id, 'created', 'Late fee added', `For ${charge.reference}.`, now, { amountCents: fee })
      return created
    }),
  )
}

export interface RecurringInput {
  leaseId: string
  category: RecurringCategory
  description: string
  amountCents: number
  startPeriod: string
  endPeriod?: string
}

export function createRecurringCharge(input: RecurringInput): Promise<RecurringCharge> {
  return run(() =>
    updateDatabase((db) => {
      const lease = db.leases.find((entry) => entry.id === input.leaseId)
      if (!lease) throw new ServiceError('not-found', 'Lease not found.', 'leaseId')
      if (lease.status !== 'active' && lease.status !== 'pending') throw new ServiceError('conflict', 'Recurring charges can only be added to a current lease.', 'leaseId')
      if (!(RECURRING_CATEGORIES as readonly string[]).includes(input.category)) throw new ServiceError('invalid', 'Choose parking, service charge, utility recovery or other income.', 'category')
      assertAmount(input.amountCents, 'amountCents')
      const current = periodOf(todayIso())
      if (!/^\d{4}-\d{2}$/.test(input.startPeriod) || input.startPeriod < current) throw new ServiceError('invalid', 'Start this month or later.', 'startPeriod')
      if (input.endPeriod !== undefined && input.endPeriod < input.startPeriod) throw new ServiceError('invalid', 'The last month can’t be before the first.', 'endPeriod')
      const overlap = db.recurringCharges.find(
        (entry) =>
          entry.leaseId === input.leaseId &&
          entry.category === input.category &&
          (entry.endPeriod === undefined || entry.endPeriod >= input.startPeriod) &&
          (input.endPeriod === undefined || input.endPeriod >= entry.startPeriod),
      )
      if (overlap) throw new ServiceError('conflict', 'This lease already has a schedule for this category in those months.', 'category')
      const now = new Date().toISOString()
      const schedule: RecurringCharge = {
        id: createId('rc'),
        leaseId: input.leaseId,
        category: input.category,
        description: text(input.description, 'description', FINANCE_LIMITS.description, true),
        amountCents: input.amountCents,
        startPeriod: input.startPeriod,
        ...(input.endPeriod ? { endPeriod: input.endPeriod } : {}),
        createdAt: now,
      }
      db.recurringCharges.push(schedule)
      event(db, 'recurring', schedule.id, 'created', 'Recurring charge set up', `From ${schedule.startPeriod}${schedule.endPeriod ? ` to ${schedule.endPeriod}` : ''}.`, now, { amountCents: schedule.amountCents })
      return schedule
    }),
  )
}

/** Ends a schedule after `lastPeriod`. Unpaid, untouched charges after it are voided by reconciliation, with a reason. */
export function endRecurringCharge(id: string, lastPeriod: string): Promise<RecurringCharge> {
  return run(() =>
    updateDatabase((db) => {
      const schedule = db.recurringCharges.find((entry) => entry.id === id)
      if (!schedule) throw new ServiceError('not-found', 'Recurring charge not found.')
      if (!/^\d{4}-\d{2}$/.test(lastPeriod) || lastPeriod < schedule.startPeriod) throw new ServiceError('invalid', 'The last month can’t be before the first.', 'endPeriod')
      if (schedule.endPeriod !== undefined && lastPeriod >= schedule.endPeriod) throw new ServiceError('invalid', 'Choose a month before the current end.', 'endPeriod')
      const now = new Date().toISOString()
      Object.assign(schedule, { endPeriod: lastPeriod, updatedAt: now } satisfies Partial<RecurringCharge>)
      event(db, 'recurring', id, 'recurring-ended', 'Recurring charge ended', `Last month: ${lastPeriod}.`, now)
      return schedule
    }),
  )
}

export interface ExpenseInput {
  category: ExpenseCategory
  vendorId?: string
  payeeName?: string
  propertyId: string
  unitId?: string
  description: string
  invoiceNumber?: string
  estimatedCents?: number
  amountCents: number
  billDate: string
  dueDate?: string
}

export interface PaidNow {
  paidOn: string
  method: PaymentMethod
  paymentRef?: string
}

export function createExpense(input: ExpenseInput, options: { acknowledgeDuplicate?: boolean; paidNow?: PaidNow } = {}): Promise<Expense> {
  return run(() =>
    updateDatabase((db) => {
      const fields = expenseFields(db, input)
      assertExpenseDuplicates(db, fields, undefined, options.acknowledgeDuplicate)
      const now = new Date().toISOString()
      const expense: Expense = { id: createId('exp'), reference: nextReference(db, 'expense'), source: 'manual', ...fields, createdAt: now }
      if (options.paidNow) applyPaid(expense, options.paidNow)
      db.expenses.push(expense)
      event(db, 'expense', expense.id, 'created', 'Bill added', expensePayeeName(db, expense), now, { amountCents: expense.amountCents })
      if (options.paidNow) event(db, 'expense', expense.id, 'marked-paid', 'Marked as paid', `Paid on ${expense.paidOn}.`, now)
      return expense
    }),
  )
}

/** Edits a bill. Work-order bills keep the work order's amount: only the due date can change. */
export function updateExpense(id: string, input: ExpenseInput, options: { acknowledgeDuplicate?: boolean } = {}): Promise<Expense> {
  return run(() =>
    updateDatabase((db) => {
      const expense = findExpense(db, id)
      if (expense.voidedAt) throw new ServiceError('conflict', 'This bill is void.')
      const now = new Date().toISOString()
      if (expense.source === 'work-order') {
        const dueDate = input.dueDate ?? expense.dueDate
        assertDate(dueDate, 'dueDate')
        if (dueDate < expense.billDate) throw new ServiceError('invalid', 'Due date can’t be before the bill date.', 'dueDate')
        if (input.amountCents !== expense.amountCents || input.propertyId !== expense.propertyId || (input.vendorId ?? '') !== (expense.vendorId ?? '')) {
          throw new ServiceError('conflict', 'Amount, property and vendor come from the work order and can’t be changed here.')
        }
        if (dueDate === expense.dueDate) return expense
        Object.assign(expense, { dueDate, updatedAt: now })
        event(db, 'expense', id, 'edited', 'Bill edited', `Due date → ${dueDate}.`, now)
        return expense
      }
      const fields = expenseFields(db, input, expense.vendorId)
      if (expense.paidOn && expense.paidOn < fields.billDate) throw new ServiceError('invalid', 'The bill date can’t be after the date it was paid.', 'billDate')
      assertExpenseDuplicates(db, fields, id, options.acknowledgeDuplicate)
      const changed = (Object.keys(fields) as Array<keyof typeof fields>).filter((key) => fields[key] !== expense[key])
      if (changed.length === 0) return expense
      for (const key of ['vendorId', 'payeeName', 'unitId', 'invoiceNumber', 'estimatedCents'] as const) delete expense[key]
      Object.assign(expense, fields, { updatedAt: now })
      event(db, 'expense', id, 'edited', 'Bill edited', `Changed: ${changed.join(', ')}.`, now)
      return expense
    }),
  )
}

export function markExpensePaid(id: string, input: PaidNow): Promise<Expense> {
  return run(() =>
    updateDatabase((db) => {
      const expense = findExpense(db, id)
      if (expense.voidedAt) throw new ServiceError('conflict', 'This bill is void.')
      if (expense.paidOn) throw new ServiceError('conflict', 'This bill is already marked as paid.')
      applyPaid(expense, input)
      const now = new Date().toISOString()
      expense.updatedAt = now
      event(db, 'expense', id, 'marked-paid', 'Marked as paid', `Paid on ${expense.paidOn}.`, now)
      return expense
    }),
  )
}

export function markExpenseUnpaid(id: string, reason: string): Promise<Expense> {
  return run(() =>
    updateDatabase((db) => {
      const expense = findExpense(db, id)
      if (!expense.paidOn) throw new ServiceError('conflict', 'This bill isn’t marked as paid.')
      const why = text(reason, 'reason', FINANCE_LIMITS.reason, true)
      const now = new Date().toISOString()
      const paidOn = expense.paidOn
      delete expense.paidOn
      delete expense.paymentMethod
      delete expense.paymentRef
      expense.updatedAt = now
      event(db, 'expense', id, 'marked-unpaid', 'Marked as unpaid', `The payment on ${paidOn} was undone.`, now, { reason: why })
      return expense
    }),
  )
}

export function voidExpense(id: string, reason: string): Promise<Expense> {
  return run(() =>
    updateDatabase((db) => {
      const expense = findExpense(db, id)
      if (expense.voidedAt) throw new ServiceError('conflict', 'This bill is already void.')
      if (expense.source === 'work-order') throw new ServiceError('conflict', 'Bills from work orders can’t be voided. The cost belongs to the work order.')
      if (expense.paidOn) throw new ServiceError('conflict', 'Mark the bill as unpaid before voiding it.')
      const why = text(reason, 'reason', FINANCE_LIMITS.reason, true)
      const now = new Date().toISOString()
      Object.assign(expense, { voidedAt: now, voidReason: why, updatedAt: now } satisfies Partial<Expense>)
      event(db, 'expense', id, 'voided', 'Bill voided', 'The bill no longer counts towards expenses.', now, { reason: why })
      return expense
    }),
  )
}

/** Currency and locale for Finance amounts (two-decimal currencies only). */
export function updateFinanceSettings(input: Pick<FinanceSettings, 'currency' | 'locale'>): Promise<FinanceSettings> {
  return run(() =>
    updateDatabase((db) => {
      const currency = input.currency.trim().toUpperCase()
      if (!isSupportedCurrency(currency)) throw new ServiceError('invalid', 'Choose a currency with two decimal places, e.g. USD, EUR or GBP.', 'currency')
      try {
        new Intl.NumberFormat(input.locale, { style: 'currency', currency })
      } catch {
        throw new ServiceError('invalid', 'Choose a valid locale, e.g. en-US.', 'locale')
      }
      Object.assign(db.finance, { currency, locale: input.locale })
      return db.finance
    }),
  )
}

/* ---------------------------------------------------------------- helpers */

function run<T>(mutation: () => T): Promise<T> {
  try {
    return simulateLatency(mutation(), 250)
  } catch (error) {
    return Promise.reject(error instanceof Error ? error : new Error(String(error)))
  }
}

const refs = (records: Array<{ id: string; reference: string }>) => records.map(({ id, reference }) => ({ id, reference }))

function findCharge(db: DemoDatabase, id: string): Charge {
  const charge = db.charges.find((entry) => entry.id === id)
  if (!charge) throw new ServiceError('not-found', 'Charge not found.')
  return charge
}

function findExpense(db: DemoDatabase, id: string): Expense {
  const expense = db.expenses.find((entry) => entry.id === id)
  if (!expense) throw new ServiceError('not-found', 'Bill not found.')
  return expense
}

function assertNotVoid(charge: Charge) {
  if (charge.voidedAt) throw new ServiceError('conflict', 'This charge is void.')
}

const paidFor = (db: DemoDatabase, chargeId: string) =>
  db.payments.filter((payment) => payment.chargeId === chargeId && isActivePayment(payment)).reduce((total, payment) => total + payment.amountCents, 0)

function assertAmount(value: number, field: string, atLeast = 0) {
  if (!isValidCents(value)) throw new ServiceError('invalid', 'Enter an amount between 0.01 and 10,000,000.00.', field)
  if (value < atLeast) throw new ServiceError('invalid', 'The amount can’t be less than what has already been paid.', field)
}

function assertDate(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00`).getTime())) throw new ServiceError('invalid', 'Enter a valid date.', field)
}

function text(value: string, field: string, max: number, required: boolean): string {
  const trimmed = value.trim()
  if (required && trimmed.length < 2) throw new ServiceError('invalid', 'This is required.', field)
  if (trimmed.length > max) throw new ServiceError('invalid', `Keep it under ${max} characters.`, field)
  return trimmed
}

function chargeFields(db: DemoDatabase, input: ChargeInput, today: string): Omit<Charge, 'id' | 'reference' | 'source' | 'createdAt'> {
  if (!(INCOME_CATEGORIES as readonly string[]).includes(input.category)) throw new ServiceError('invalid', 'Choose a category.', 'category')
  if (input.category === 'rent') throw new ServiceError('invalid', 'Rent is billed from the lease. Use “Other income” for a one-off amount.', 'category')
  if (input.category === 'late-fee') throw new ServiceError('invalid', 'Add late fees from the overdue charge.', 'category')
  assertAmount(input.amountCents, 'amountCents')
  const issuedOn = input.issuedOn ?? today
  assertDate(issuedOn, 'issuedOn')
  assertDate(input.dueDate, 'dueDate')
  if (input.dueDate < issuedOn) throw new ServiceError('invalid', 'Due date can’t be before the issue date.', 'dueDate')
  const description = text(input.description, 'description', FINANCE_LIMITS.description, false)
  if (input.leaseId) {
    const lease = db.leases.find((entry) => entry.id === input.leaseId)
    if (!lease) throw new ServiceError('not-found', 'Lease not found.', 'leaseId')
    return {
      category: input.category,
      leaseId: lease.id,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      ...(description ? { description } : {}),
      amountCents: input.amountCents,
      issuedOn,
      dueDate: input.dueDate,
    }
  }
  const property = db.properties.find((entry) => entry.id === input.propertyId)
  if (!property) throw new ServiceError('invalid', 'Choose a tenant or a property.', 'propertyId')
  if (input.unitId && db.units.find((unit) => unit.id === input.unitId)?.propertyId !== property.id) throw new ServiceError('invalid', 'Choose a unit in this property.', 'unitId')
  return {
    category: input.category,
    propertyId: property.id,
    ...(input.unitId ? { unitId: input.unitId } : {}),
    payerName: text(input.payerName ?? '', 'payerName', FINANCE_LIMITS.payerName, true),
    ...(description ? { description } : {}),
    amountCents: input.amountCents,
    issuedOn,
    dueDate: input.dueDate,
  }
}

function addPayment(db: DemoDatabase, charge: Charge, input: PaymentInput, today: string, now: string): Payment {
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new ServiceError('invalid', 'Choose a payment method.', 'method')
  const balance = Math.max(0, charge.amountCents - paidFor(db, charge.id))
  if (balance === 0) throw new ServiceError('conflict', 'This charge is already paid in full.')
  assertAmount(input.amountCents, 'amountCents')
  if (input.amountCents > balance) throw new ServiceError('invalid', 'The payment can’t be more than the balance. Credits aren’t supported yet.', 'amountCents')
  assertDate(input.receivedOn, 'receivedOn')
  if (input.receivedOn > today) throw new ServiceError('invalid', 'The payment date can’t be in the future.', 'receivedOn')
  if (input.receivedOn < charge.issuedOn) throw new ServiceError('invalid', 'The payment date can’t be before the charge was issued.', 'receivedOn')
  const externalRef = input.externalRef?.trim()
  const note = input.note?.trim()
  if (note && note.length > FINANCE_LIMITS.note) throw new ServiceError('invalid', `Keep it under ${FINANCE_LIMITS.note} characters.`, 'note')
  const payment: Payment = {
    id: createId('pay'),
    reference: nextReference(db, 'payment'),
    chargeId: charge.id,
    amountCents: input.amountCents,
    receivedOn: input.receivedOn,
    method: input.method,
    ...(externalRef ? { externalRef: externalRef.slice(0, FINANCE_LIMITS.reference) } : {}),
    ...(note ? { note } : {}),
    createdAt: now,
  }
  db.payments.push(payment)
  return payment
}

function expenseFields(db: DemoDatabase, input: ExpenseInput, currentVendorId?: string): Omit<Expense, 'id' | 'reference' | 'source' | 'createdAt'> {
  if (!(EXPENSE_CATEGORIES as readonly string[]).includes(input.category)) throw new ServiceError('invalid', 'Choose a category.', 'category')
  const property = db.properties.find((entry) => entry.id === input.propertyId)
  if (!property) throw new ServiceError('invalid', 'Choose a property.', 'propertyId')
  if (input.unitId && db.units.find((unit) => unit.id === input.unitId)?.propertyId !== property.id) throw new ServiceError('invalid', 'Choose a unit in this property.', 'unitId')
  let payee: Pick<Expense, 'vendorId' | 'payeeName'>
  if (input.vendorId) {
    const vendor = db.vendors.find((entry) => entry.id === input.vendorId)
    if (!vendor) throw new ServiceError('invalid', 'Choose a vendor.', 'vendorId')
    // Inactive vendors can't get new bills, but an existing bill keeps its vendor.
    if (!vendor.active && vendor.id !== currentVendorId) throw new ServiceError('invalid', `${vendor.name} is inactive and can’t get new bills.`, 'vendorId')
    payee = { vendorId: vendor.id }
  } else {
    payee = { payeeName: text(input.payeeName ?? '', 'payeeName', FINANCE_LIMITS.payerName, true) }
  }
  assertAmount(input.amountCents, 'amountCents')
  if (input.estimatedCents !== undefined) assertAmount(input.estimatedCents, 'estimatedCents')
  assertDate(input.billDate, 'billDate')
  const dueDate = input.dueDate ?? addDays(input.billDate, db.finance.paymentTermsDays)
  assertDate(dueDate, 'dueDate')
  if (dueDate < input.billDate) throw new ServiceError('invalid', 'Due date can’t be before the bill date.', 'dueDate')
  const invoiceNumber = input.invoiceNumber?.trim()
  return {
    category: input.category,
    ...payee,
    propertyId: property.id,
    ...(input.unitId ? { unitId: input.unitId } : {}),
    description: text(input.description, 'description', FINANCE_LIMITS.description, true),
    ...(invoiceNumber ? { invoiceNumber: invoiceNumber.slice(0, FINANCE_LIMITS.reference) } : {}),
    ...(input.estimatedCents !== undefined ? { estimatedCents: input.estimatedCents } : {}),
    amountCents: input.amountCents,
    billDate: input.billDate,
    dueDate,
  }
}

function assertExpenseDuplicates(db: DemoDatabase, fields: Omit<Expense, 'id' | 'reference' | 'source' | 'createdAt'>, exceptId: string | undefined, acknowledged = false) {
  const matches = findExpenseDuplicates(db.expenses, fields, exceptId)
  if (matches.blocking.length > 0) {
    throw new FinanceDuplicateError('This invoice number is already recorded for this payee.', 'invoiceNumber', refs(matches.blocking), false)
  }
  if (matches.warnings.length > 0 && !acknowledged) {
    throw new FinanceDuplicateError('A bill from this payee for the same property, amount and date already exists.', 'amountCents', refs(matches.warnings), true)
  }
}

function applyPaid(expense: Expense, input: PaidNow) {
  if (!(PAYMENT_METHODS as readonly string[]).includes(input.method)) throw new ServiceError('invalid', 'Choose a payment method.', 'method')
  assertDate(input.paidOn, 'paidOn')
  if (input.paidOn > todayIso()) throw new ServiceError('invalid', 'The payment date can’t be in the future.', 'paidOn')
  if (input.paidOn < expense.billDate) throw new ServiceError('invalid', 'The payment date can’t be before the bill date.', 'paidOn')
  const paymentRef = input.paymentRef?.trim()
  Object.assign(expense, { paidOn: input.paidOn, paymentMethod: input.method, ...(paymentRef ? { paymentRef: paymentRef.slice(0, FINANCE_LIMITS.reference) } : {}) })
}

function event(
  db: DemoDatabase,
  recordType: FinanceEvent['recordType'],
  recordId: string,
  kind: FinanceEvent['kind'],
  title: string,
  description: string,
  now: string,
  extra: Partial<Pick<FinanceEvent, 'reason' | 'amountCents' | 'paymentId'>> = {},
) {
  db.financeEvents.push({ id: createId('fev'), recordType, recordId, kind, actor: 'user', title, description, ...extra, createdAt: now })
}

function nameLookups(db: DemoDatabase) {
  const properties = new Map(db.properties.map((property) => [property.id, property]))
  const units = new Map(db.units.map((unit) => [unit.id, unit]))
  const tenants = new Map(db.tenants.map((tenant) => [tenant.id, tenant.name]))
  const leases = new Map(db.leases.map((lease) => [lease.id, lease]))
  const vendors = new Map(db.vendors.map((vendor) => [vendor.id, vendor.name]))
  return {
    property: (id: string) => properties.get(id)?.name ?? 'Unknown property',
    unit: (id: string | undefined, propertyId: string) => {
      if (!id) return ''
      const unit = units.get(id)
      return unit ? `${properties.get(propertyId)?.type === 'commercial' ? 'Suite' : 'Unit'} ${unit.number}` : ''
    },
    tenant: (id: string) => tenants.get(id) ?? 'Unknown tenant',
    leaseTenant: (leaseId: string) => {
      const lease = leases.get(leaseId)
      return lease ? (tenants.get(lease.tenantId) ?? 'Unknown tenant') : 'Unknown tenant'
    },
    vendor: (id: string) => vendors.get(id) ?? 'Unknown vendor',
    tenantHref: (leaseId: string) => {
      const lease = leases.get(leaseId)
      return lease ? `/tenants/${lease.tenantId}?tab=payments` : null
    },
    tenantId: (leaseId: string) => leases.get(leaseId)?.tenantId ?? null,
  }
}

type Names = ReturnType<typeof nameLookups>
const chargeParty = (charge: Charge, names: Names) => (charge.leaseId ? names.leaseTenant(charge.leaseId) : (charge.payerName ?? ''))
const expenseParty = (expense: Expense, names: Names) => (expense.vendorId ? names.vendor(expense.vendorId) : (expense.payeeName ?? ''))

function describeParty(db: DemoDatabase, charge: Charge): string {
  return chargeParty(charge, nameLookups(db))
}

function expensePayeeName(db: DemoDatabase, expense: Expense): string {
  return expenseParty(expense, nameLookups(db))
}

function chargeTimeline(db: DemoDatabase, charge: Charge, payments: Payment[]): TimelineEntry[] {
  const demo = charge.demo ? 'demo' : null
  const entries: TimelineEntry[] = []
  if (charge.source === 'lease' || charge.source === 'recurring') {
    entries.push({ id: `${charge.id}:posted`, at: charge.demo ? `${charge.issuedOn}T09:00:00.000Z` : charge.createdAt, kind: 'posted', actor: demo ?? 'system', title: 'Charge posted', description: charge.source === 'lease' ? 'From the lease terms.' : 'From a recurring schedule.', amountCents: charge.amountCents })
  } else if (!db.financeEvents.some((event) => event.recordId === charge.id && event.kind === 'created')) {
    entries.push({ id: `${charge.id}:created`, at: charge.demo ? `${charge.issuedOn}T09:00:00.000Z` : charge.createdAt, kind: 'created', actor: demo ?? 'user', title: 'Charge added', description: '', amountCents: charge.amountCents })
  }
  for (const payment of payments) {
    entries.push({
      id: payment.id,
      // Demo payments were all written by the migration; order them by the date the money arrived.
      at: payment.demo ? `${payment.receivedOn}T12:00:00.000Z` : payment.createdAt,
      kind: 'payment',
      actor: payment.demo ? 'demo' : 'user',
      title: payment.voidedAt ? 'Payment received (later voided)' : 'Payment received',
      description: `${payment.reference} · ${PAYMENT_METHOD_LABELS[payment.method]}${payment.externalRef ? ` · ${payment.externalRef}` : ''} · received ${payment.receivedOn}`,
      amountCents: payment.amountCents,
    })
  }
  for (const event of db.financeEvents) {
    if (event.recordId !== charge.id) continue
    entries.push({ id: event.id, at: event.createdAt, kind: event.kind, actor: event.demo ? 'demo' : event.actor, title: event.title, description: event.reason ? `${event.description} Reason: ${event.reason}` : event.description, ...(event.amountCents !== undefined ? { amountCents: event.amountCents } : {}) })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}

function expenseTimeline(db: DemoDatabase, expense: Expense): TimelineEntry[] {
  const demo = expense.demo ? 'demo' : null
  const entries: TimelineEntry[] = []
  if (expense.source === 'work-order') {
    entries.push({ id: `${expense.id}:created`, at: expense.demo ? `${expense.billDate}T09:00:00.000Z` : expense.createdAt, kind: 'posted', actor: demo ?? 'system', title: 'Bill created from work order', description: expense.workOrderId ?? '', amountCents: expense.amountCents })
  } else if (!db.financeEvents.some((event) => event.recordId === expense.id && event.kind === 'created')) {
    entries.push({ id: `${expense.id}:created`, at: expense.demo ? `${expense.billDate}T09:00:00.000Z` : expense.createdAt, kind: 'created', actor: demo ?? 'user', title: 'Bill added', description: '', amountCents: expense.amountCents })
  }
  if (expense.paidOn && !db.financeEvents.some((event) => event.recordId === expense.id && event.kind === 'marked-paid')) {
    entries.push({ id: `${expense.id}:paid`, at: `${expense.paidOn}T12:00:00.000Z`, kind: 'marked-paid', actor: demo ?? 'user', title: 'Paid', description: `Paid on ${expense.paidOn}.` })
  }
  for (const event of db.financeEvents) {
    if (event.recordId !== expense.id) continue
    entries.push({ id: event.id, at: event.createdAt, kind: event.kind, actor: event.demo ? 'demo' : event.actor, title: event.title, description: event.reason ? `${event.description} Reason: ${event.reason}` : event.description })
  }
  return entries.sort((a, b) => b.at.localeCompare(a.at))
}
