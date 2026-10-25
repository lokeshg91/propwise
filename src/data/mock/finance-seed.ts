import { addDays } from '@/data/domain/dates'
import { addPeriods, firstDayOf, lastDayOf, periodRange } from '@/data/domain/finance-schedule'
import { chargeState, graceFor, paymentsByCharge, ruleFor, suggestedLateFeeCents } from '@/data/domain/finance-rules'
import { percentOfCents, sumCents } from '@/data/domain/money'
import { hashString } from '@/data/mock/tenancy-seed'
import { type FinanceData } from '@/data/store/demo-store'
import { nextReference } from '@/data/store/finance-reconcile'
import {
  type Charge,
  type Expense,
  type ExpenseCategory,
  type FinanceEvent,
  type Lease,
  type Payment,
  type PaymentMethod,
  type RecurringCharge,
} from '@/types'

/**
 * Fictional finance history for the demo (12 months up to today). Every
 * record is flagged `demo: true`, ids are derived from their source and
 * amounts from a hash, so the same data always produces the same history.
 *
 * Only records in `finance.demoScope` (the original sample leases,
 * properties and completed work orders) get history. Leases, properties and
 * work orders created by the user never get fabricated payments or bills.
 */

/** Sample invoices are dated this many days before their due date (demo history only). */
export const DEMO_INVOICE_LEAD_DAYS = 3

const pick = <T,>(items: readonly T[], seed: number): T => items[seed % items.length] as T
const roll = (key: string) => hashString(key) % 100

const METHODS_RESIDENTIAL: PaymentMethod[] = ['bank-transfer', 'bank-transfer', 'bank-transfer', 'card', 'card', 'check', 'cash', 'other']
const METHODS_COMMERCIAL: PaymentMethod[] = ['bank-transfer', 'bank-transfer', 'bank-transfer', 'check']

/* -------------------------------------------------------------- schedules */

/** Parking for some residential sample leases and service charges (CAM) for commercial ones. */
export function buildDemoRecurring(db: FinanceData, now: string): RecurringCharge[] {
  const scope = new Set(db.finance.demoScope.leaseIds)
  const properties = new Map(db.properties.map((property) => [property.id, property]))
  const schedules: RecurringCharge[] = []
  for (const lease of db.leases) {
    if (!scope.has(lease.id)) continue
    const type = properties.get(lease.propertyId)?.type
    const seed = hashString(`${lease.id}:recurring`)
    const startPeriod = db.finance.startPeriod
    if (type === 'residential' && seed % 100 < 15) {
      schedules.push({
        id: `rc_${lease.id}_parking`,
        leaseId: lease.id,
        category: 'parking',
        description: 'Reserved parking space',
        amountCents: pick([7500, 10000, 12500], seed >>> 3),
        startPeriod,
        demo: true,
        createdAt: now,
      })
    }
    if (type === 'commercial') {
      schedules.push({
        id: `rc_${lease.id}_cam`,
        leaseId: lease.id,
        category: 'service-charge',
        description: 'Common area maintenance (CAM)',
        // 10–14 % of rent, rounded to $5.
        amountCents: Math.round((lease.monthlyRent * (10 + (seed % 5))) / 100 / 5) * 500,
        startPeriod,
        demo: true,
        createdAt: now,
      })
    }
  }
  return schedules
}

/* --------------------------------------------------------------- history */

export function addDemoHistory(db: FinanceData, today: string, now: string): void {
  const leases = new Map(db.leases.map((lease) => [lease.id, lease]))
  const properties = new Map(db.properties.map((property) => [property.id, property]))
  const pay = (charge: Charge, amountCents: number, receivedOn: string, method: PaymentMethod, index: number) => {
    const payment: Payment = {
      id: `pay_${charge.id}_${index}`,
      reference: nextReference(db, 'payment'),
      chargeId: charge.id,
      amountCents,
      receivedOn,
      method,
      ...(method === 'check' ? { externalRef: `Check ${1000 + (hashString(charge.id) % 9000)}` } : {}),
      demo: true,
      createdAt: now,
    }
    db.payments.push(payment)
    return payment
  }

  // Sample invoices are issued a few days before they're due, so the early payments v0.7 showed (up to
  // 3 days before the due date) keep their dates without being dated before their charge. Demo history
  // only (charges already due): due dates never change, and live or user-created charges keep the
  // standard issue date (the 1st of the month, or the lease start).
  // Never before the lease starts (the standard rule for a lease's first month).
  for (const charge of db.charges) {
    if (!charge.demo || (charge.source !== 'lease' && charge.source !== 'recurring') || !charge.leaseId || charge.dueDate > today) continue
    const start = leases.get(charge.leaseId)?.startDate ?? charge.issuedOn
    const lead = addDays(charge.dueDate, -DEMO_INVOICE_LEAD_DAYS)
    const issuedOn = lead > start ? lead : start
    if (issuedOn < charge.issuedOn) charge.issuedOn = issuedOn
  }

  // Rent: the same thresholds and dates the v0.7 generated ledger used, so months stay paid, late or overdue.
  const rentPaidOn = new Map<string, string>()
  const arrearsLease = pickArrearsLease(db, today)
  for (const charge of db.charges) {
    if (!charge.demo || charge.category !== 'rent' || !charge.leaseId || charge.dueDate > today) continue
    const lease = leases.get(charge.leaseId) as Lease
    const commercial = properties.get(charge.propertyId)?.type === 'commercial'
    const method = pick(commercial ? METHODS_COMMERCIAL : METHODS_RESIDENTIAL, hashString(`${charge.id}:method`))
    const value = roll(`${lease.id}:${charge.period}`)
    const due = charge.dueDate
    // One commercial tenant in arrears for the last three months.
    if (lease.id === arrearsLease && charge.dueDate >= addDays(today, -95)) continue
    if (value < 86) {
      const early = addDays(due, -(value % 4))
      // Never before the charge was issued (approved rule); with the lead time above this keeps the v0.7 date.
      const date = [early < charge.issuedOn ? charge.issuedOn : early, today].sort()[0] as string
      pay(charge, charge.amountCents, date, method, 1)
      rentPaidOn.set(charge.id, date)
    } else if (value < 95 || addDays(due, 45) < today) {
      const date = addDays(due, 2 + (value % 8))
      if (value >= 93 && value < 95) {
        // Paid late in two instalments.
        const first = addDays(due, 2)
        if (first > today) continue
        const half = Math.round(charge.amountCents / 2 / 1000) * 1000
        pay(charge, half, first, method, 1)
        const second = addDays(due, 9 + (value % 5))
        if (second <= today) {
          pay(charge, charge.amountCents - half, second, method, 2)
          rentPaidOn.set(charge.id, second)
        }
      } else if (date <= today) {
        pay(charge, charge.amountCents, date, method, 1)
        rentPaidOn.set(charge.id, date)
      }
    } else if (value < 97) {
      // Partially paid and still open.
      const date = addDays(due, 3)
      if (date <= today) pay(charge, Math.round((charge.amountCents * (40 + (value % 3) * 10)) / 100 / 1000) * 1000, date, method, 1)
    }
    // Otherwise: overdue, nothing paid.
  }

  // Recurring charges are paid together with that month's rent.
  for (const charge of db.charges) {
    if (!charge.demo || charge.source !== 'recurring' || !charge.leaseId || !charge.period) continue
    const date = rentPaidOn.get(`chg_${charge.leaseId}_${charge.period}`)
    if (date) pay(charge, charge.amountCents, date, 'bank-transfer', 1)
  }

  addLateFees(db, today, now, pay)
  addLaundryIncome(db, today, now, pay)
  addOperatingExpenses(db, today, now)
  settleWorkOrderBills(db, today)
  addShowcaseVoids(db, today, now, pay)
}

type Pay = (charge: Charge, amountCents: number, receivedOn: string, method: PaymentMethod, index: number) => Payment

/** The active commercial sample lease that showcases 60+ days of arrears. */
function pickArrearsLease(db: FinanceData, today: string): string | null {
  const scope = new Set(db.finance.demoScope.leaseIds)
  const commercial = new Set(db.properties.filter((property) => property.type === 'commercial').map((property) => property.id))
  const candidates = db.leases
    .filter((lease) => scope.has(lease.id) && commercial.has(lease.propertyId) && lease.status === 'active' && lease.startDate < addDays(today, -200))
    .sort((a, b) => a.id.localeCompare(b.id))
  return candidates[0]?.id ?? null
}

function addLateFees(db: FinanceData, today: string, now: string, pay: Pay) {
  const payments = paymentsByCharge(db.payments)
  const properties = new Map(db.properties.map((property) => [property.id, property]))
  for (const charge of [...db.charges]) {
    if (!charge.demo || charge.category !== 'rent') continue
    const list = payments.get(charge.id) ?? []
    const grace = graceFor(db.finance, charge)
    const state = chargeState(charge, list, today, grace)
    const lateDate = addDays(charge.dueDate, grace + 1)
    const paidLate = state.status === 'paid' && state.paidLate
    const openLate = state.balanceCents > 0 && today >= lateDate
    if (!(paidLate || openLate) || roll(`${charge.id}:fee`) >= 60 || lateDate > today) continue
    const fee: Charge = {
      id: `${charge.id}_late`,
      reference: nextReference(db, 'income'),
      category: 'late-fee',
      source: 'late-fee',
      ...(charge.leaseId ? { leaseId: charge.leaseId } : {}),
      parentChargeId: charge.id,
      propertyId: charge.propertyId,
      ...(charge.unitId ? { unitId: charge.unitId } : {}),
      ...(charge.period ? { period: charge.period } : {}),
      description: 'Late fee',
      amountCents: suggestedLateFeeCents(charge, properties.get(charge.propertyId)?.type ?? 'residential', ruleFor(db.finance, charge.dueDate)),
      issuedOn: lateDate,
      dueDate: lateDate,
      demo: true,
      createdAt: now,
    }
    db.charges.push(fee)
    const lastPaid = list.reduce((latest, payment) => (payment.receivedOn > latest ? payment.receivedOn : latest), '')
    if (paidLate && roll(`${charge.id}:fee-paid`) < 70) pay(fee, fee.amountCents, lastPaid > lateDate ? lastPaid : lateDate, 'bank-transfer', 1)
  }
}

const LAUNDRY_PROPERTIES = ['prop_101', 'prop_102', 'prop_105']

function addLaundryIncome(db: FinanceData, today: string, now: string, pay: Pay) {
  const scope = new Set(db.finance.demoScope.propertyIds)
  for (const propertyId of LAUNDRY_PROPERTIES) {
    if (!scope.has(propertyId)) continue
    for (const period of periodRange(db.finance.startPeriod, addPeriods(today.slice(0, 7), -1))) {
      const issuedOn = lastDayOf(period)
      const charge: Charge = {
        id: `chg_demo_laundry_${propertyId}_${period}`,
        reference: nextReference(db, 'income'),
        category: 'other-income',
        source: 'manual',
        propertyId,
        payerName: 'Brightwash Laundry Services',
        period,
        description: 'Laundry room revenue share',
        amountCents: 30000 + (hashString(`${propertyId}:${period}:laundry`) % 36) * 1000,
        issuedOn,
        dueDate: addDays(issuedOn, 10),
        demo: true,
        createdAt: now,
      }
      db.charges.push(charge)
      if (charge.dueDate <= today) pay(charge, charge.amountCents, addDays(charge.dueDate, -2), 'bank-transfer', 1)
    }
  }
}

interface ExpenseSpec {
  category: ExpenseCategory
  /** Vendor id; falls back to `payee` text if the vendor no longer exists. */
  vendorId?: string
  payee: string
  description: string
  billDay: number
  termsDays: number
  /** Cents per unit, before the ±15 % monthly variation. */
  perUnitCents: number
  /** Months (0–11 from the start month) this expense is billed. */
  months: number[]
  invoicePrefix?: string
  /** Fixed amounts (premiums, taxes) don't vary from the estimate. */
  fixed?: boolean
  residential?: boolean
  commercial?: boolean
}

const EVERY_MONTH = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
const SPECS: ExpenseSpec[] = [
  { category: 'utilities', payee: 'Larkspur Power & Water', description: 'Common-area electricity and water', billDay: 6, termsDays: 20, perUnitCents: 2600, months: EVERY_MONTH, invoicePrefix: 'LPW' },
  { category: 'landscaping', vendorId: 'ven_greenleaf-landscaping', payee: 'GreenLeaf Landscaping', description: 'Grounds maintenance contract', billDay: 15, termsDays: 15, perUnitCents: 1000, months: EVERY_MONTH, invoicePrefix: 'GL', fixed: true, residential: true },
  { category: 'cleaning', vendorId: 'ven_proclean-facilities', payee: 'ProClean Facilities', description: 'Common-area cleaning contract', billDay: 15, termsDays: 15, perUnitCents: 11000, months: EVERY_MONTH, invoicePrefix: 'PCF', fixed: true, commercial: true },
  { category: 'insurance', payee: 'Fernhill Mutual Insurance', description: 'Quarterly property insurance premium', billDay: 1, termsDays: 14, perUnitCents: 4800, months: [0, 3, 6, 9], invoicePrefix: 'FMI', fixed: true },
  { category: 'property-tax', payee: 'County Treasurer', description: 'Semi-annual property tax instalment', billDay: 1, termsDays: 27, perUnitCents: 32000, months: [0, 6], fixed: true },
  { category: 'pest-control', vendorId: 'ven_evergreen-pest-control', payee: 'Evergreen Pest Control', description: 'Quarterly pest treatment', billDay: 10, termsDays: 15, perUnitCents: 700, months: [2, 5, 8, 11], invoicePrefix: 'EPC' },
  { category: 'maintenance', vendorId: 'ven_apex-elevator-services', payee: 'Apex Elevator Services', description: 'Quarterly elevator service contract', billDay: 12, termsDays: 30, perUnitCents: 4500, months: [1, 4, 7, 10], invoicePrefix: 'AES', fixed: true, commercial: true },
]

function addOperatingExpenses(db: FinanceData, today: string, now: string) {
  const scope = new Set(db.finance.demoScope.propertyIds)
  const vendors = new Set(db.vendors.map((vendor) => vendor.id))
  const periods = periodRange(db.finance.startPeriod, today.slice(0, 7))
  const lastMonth = addPeriods(today.slice(0, 7), -1)
  const charges = new Map(db.charges.map((charge) => [charge.id, charge]))

  for (const property of db.properties) {
    if (!scope.has(property.id)) continue
    const commercial = property.type === 'commercial'
    const unitFactor = commercial ? 2.5 : 1
    periods.forEach((period, index) => {
      for (const spec of SPECS) {
        if ((spec.residential && commercial) || (spec.commercial && !commercial) || !spec.months.includes(index)) continue
        const billDate = `${period}-${String(spec.billDay).padStart(2, '0')}`
        if (billDate > today) continue
        const estimatedCents = Math.round((property.totalUnits * spec.perUnitCents * unitFactor) / 100) * 100
        const swing = spec.fixed ? 0 : (hashString(`${property.id}:${period}:${spec.category}`) % 31) - 15
        const amountCents = spec.fixed ? estimatedCents : Math.round((estimatedCents * (100 + swing)) / 100 / 100) * 100
        const vendorId = spec.vendorId && vendors.has(spec.vendorId) ? spec.vendorId : undefined
        const expense: Expense = {
          id: `exp_demo_${property.id}_${spec.category}_${period}`,
          reference: nextReference(db, 'expense'),
          category: spec.category,
          source: 'operating',
          ...(vendorId ? { vendorId } : { payeeName: spec.payee }),
          propertyId: property.id,
          description: spec.description,
          ...(spec.invoicePrefix ? { invoiceNumber: `${spec.invoicePrefix}-${property.id.slice(5)}-${period.replace('-', '')}` } : {}),
          ...(spec.fixed ? {} : { estimatedCents }),
          amountCents,
          billDate,
          dueDate: addDays(billDate, spec.termsDays),
          demo: true,
          createdAt: now,
        }
        settle(expense, today, period === lastMonth && hashString(`${expense.id}:late`) % 9 === 0)
        db.expenses.push(expense)
      }

      // Management fee: 6 % of rent collected in the month, billed at month end.
      const billDate = lastDayOf(period)
      if (billDate > today || billDate === today) return
      const collected = sumCents(
        db.payments
          .filter((payment) => !payment.voidedAt && payment.receivedOn.startsWith(period))
          .filter((payment) => {
            const charge = charges.get(payment.chargeId)
            return charge?.propertyId === property.id && charge.category === 'rent'
          })
          .map((payment) => payment.amountCents),
      )
      if (collected === 0) return
      const fee: Expense = {
        id: `exp_demo_${property.id}_management-fee_${period}`,
        reference: nextReference(db, 'expense'),
        category: 'management-fee',
        source: 'operating',
        payeeName: 'Northbridge Property Management',
        propertyId: property.id,
        description: `Management fee, 6 % of rent collected in ${period}`,
        invoiceNumber: `NPM-${property.id.slice(5)}-${period.replace('-', '')}`,
        amountCents: percentOfCents(collected, 6),
        billDate,
        dueDate: addDays(billDate, 10),
        demo: true,
        createdAt: now,
      }
      settle(fee, today, false)
      db.expenses.push(fee)
    })
  }
}

/** Past-due demo bills are paid a few days before the due date, except the ones left open on purpose. */
function settle(expense: Expense, today: string, leaveOpen: boolean) {
  if (leaveOpen || expense.dueDate >= today) return
  const paidOn = addDays(expense.dueDate, -(hashString(expense.id) % 5))
  expense.paidOn = paidOn < expense.billDate ? expense.billDate : paidOn
  expense.paymentMethod = 'bank-transfer'
  expense.paymentRef = `ACH ${String(hashString(`${expense.id}:ref`) % 1_000_000).padStart(6, '0')}`
}

/** Sample work-order bills: paid when completed more than 21 days ago, except one left overdue. */
function settleWorkOrderBills(db: FinanceData, today: string) {
  const bills = db.expenses.filter((expense) => expense.demo && expense.source === 'work-order').sort((a, b) => a.billDate.localeCompare(b.billDate))
  const overdue = bills.find((bill) => bill.dueDate < today)
  for (const bill of bills) {
    if (bill === overdue || bill.billDate > addDays(today, -21)) continue
    bill.paidOn = addDays(bill.billDate, 14)
    bill.paymentMethod = 'bank-transfer'
    bill.paymentRef = `ACH ${String(hashString(`${bill.id}:ref`) % 1_000_000).padStart(6, '0')}`
  }
}

/** A returned check (voided payment, then paid again) and a charge voided as an entry error. */
function addShowcaseVoids(db: FinanceData, today: string, now: string, pay: Pay) {
  const charges = new Map(db.charges.map((charge) => [charge.id, charge]))
  const events: FinanceEvent[] = []
  const check = db.payments
    .filter((payment) => payment.demo && payment.method === 'check' && payment.receivedOn < addDays(today, -20) && charges.get(payment.chargeId)?.category === 'rent')
    .sort((a, b) => b.receivedOn.localeCompare(a.receivedOn) || a.id.localeCompare(b.id))[0]
  if (check) {
    const charge = charges.get(check.chargeId) as Charge
    check.voidedAt = now
    check.voidReason = 'Check returned by the bank (insufficient funds).'
    events.push({
      id: `fev_${charge.id}_demo-returned-check`,
      recordType: 'charge',
      recordId: charge.id,
      kind: 'payment-voided',
      actor: 'user',
      title: 'Payment voided',
      description: `${check.reference} was voided.`,
      reason: check.voidReason,
      amountCents: check.amountCents,
      paymentId: check.id,
      demo: true,
      createdAt: now,
    })
    pay(charge, check.amountCents, addDays(check.receivedOn, 6), 'bank-transfer', 9)
  }

  const lease = db.leases
    .filter((entry) => db.finance.demoScope.leaseIds.includes(entry.id) && entry.status === 'active')
    .sort((a, b) => a.id.localeCompare(b.id))[0]
  if (lease) {
    const issuedOn = firstDayOf(addPeriods(today.slice(0, 7), -2))
    const voided: Charge = {
      id: `chg_demo_void_${lease.id}`,
      reference: nextReference(db, 'income'),
      category: 'parking',
      source: 'manual',
      leaseId: lease.id,
      propertyId: lease.propertyId,
      unitId: lease.unitId,
      description: 'Guest parking permit',
      amountCents: 2500,
      issuedOn,
      dueDate: issuedOn,
      voidedAt: now,
      voidReason: 'Added to the wrong tenant.',
      voidedBy: 'user',
      demo: true,
      createdAt: now,
    }
    db.charges.push(voided)
    events.push({
      id: `fev_${voided.id}_demo-void`,
      recordType: 'charge',
      recordId: voided.id,
      kind: 'voided',
      actor: 'user',
      title: 'Charge voided',
      description: 'The charge no longer counts towards the balance.',
      reason: voided.voidReason,
      demo: true,
      createdAt: now,
    })
  }
  db.financeEvents.push(...events)
}
