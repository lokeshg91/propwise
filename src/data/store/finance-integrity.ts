import { isActivePayment } from '@/data/domain/finance-rules'
import { isValidCents, toCents } from '@/data/domain/money'
import { type DemoDatabase } from '@/data/store/demo-store'
import { REFERENCE_PREFIX, type ReferenceSeries, workOrderBillId } from '@/data/store/finance-reconcile'

/**
 * Finance invariants. Run by the migration before it saves anything, by the
 * tests after every scenario and by browser QA. Problems are reported, never
 * "fixed" here: changing financial records is a decision for a person.
 */
export function checkFinanceIntegrity(db: DemoDatabase): string[] {
  const issues: string[] = []
  const fail = (message: string) => issues.push(message)

  const properties = new Map(db.properties.map((property) => [property.id, property]))
  const units = new Map(db.units.map((unit) => [unit.id, unit]))
  const leases = new Set(db.leases.map((lease) => lease.id))
  const vendors = new Set(db.vendors.map((vendor) => vendor.id))
  const workOrders = new Map(db.workOrders.map((order) => [order.id, order]))
  const recurring = new Set(db.recurringCharges.map((entry) => entry.id))

  const unique = (name: string, ids: string[]) => {
    const seen = new Set<string>()
    for (const id of ids) {
      if (seen.has(id)) fail(`${name}: duplicate id ${id}`)
      seen.add(id)
    }
  }
  unique('charges', db.charges.map((charge) => charge.id))
  unique('payments', db.payments.map((payment) => payment.id))
  unique('expenses', db.expenses.map((expense) => expense.id))
  unique('recurringCharges', db.recurringCharges.map((entry) => entry.id))
  unique('financeEvents', db.financeEvents.map((event) => event.id))
  unique('charge references', db.charges.map((charge) => charge.reference))
  unique('payment references', db.payments.map((payment) => payment.reference))
  unique('expense references', db.expenses.map((expense) => expense.reference))

  const place = (label: string, propertyId: string, unitId: string | undefined) => {
    if (!properties.has(propertyId)) fail(`${label}: unknown property ${propertyId}`)
    if (unitId !== undefined) {
      const unit = units.get(unitId)
      if (!unit) fail(`${label}: unknown unit ${unitId}`)
      else if (unit.propertyId !== propertyId) fail(`${label}: unit ${unitId} isn't in property ${propertyId}`)
    }
  }

  const charges = new Map(db.charges.map((charge) => [charge.id, charge]))
  const feesByParent = new Map<string, number>()
  for (const charge of db.charges) {
    const label = `charge ${charge.id}`
    if (!isValidCents(charge.amountCents)) fail(`${label}: invalid amount ${charge.amountCents}`)
    place(label, charge.propertyId, charge.unitId)
    if (charge.leaseId && !leases.has(charge.leaseId)) fail(`${label}: unknown lease ${charge.leaseId}`)
    if (!charge.leaseId && !charge.payerName) fail(`${label}: no lease or payer`)
    if (charge.category === 'rent' && charge.source !== 'lease') fail(`${label}: rent must come from a lease`)
    if (charge.source === 'lease' && charge.id !== `chg_${charge.leaseId}_${charge.period}`) fail(`${label}: unexpected id for a lease charge`)
    if (charge.recurringId && !recurring.has(charge.recurringId)) fail(`${label}: unknown schedule ${charge.recurringId}`)
    if (charge.parentChargeId && !charges.has(charge.parentChargeId)) fail(`${label}: unknown parent charge`)
    if (charge.parentChargeId) {
      if (charge.category !== 'late-fee') fail(`${label}: only late fees have a parent charge`)
      if (charges.get(charge.parentChargeId)?.category !== 'rent') fail(`${label}: late fee on a charge that isn't rent`)
      const count = (feesByParent.get(charge.parentChargeId) ?? 0) + 1
      feesByParent.set(charge.parentChargeId, count)
      if (count === 2) fail(`charge ${charge.parentChargeId}: more than one late-fee record`)
    }
    if (charge.dueDate < charge.issuedOn && charge.source !== 'lease' && charge.source !== 'recurring') fail(`${label}: due before issue date`)
    if (charge.voidedAt && !charge.voidReason) fail(`${label}: voided without a reason`)
  }

  const paidByCharge = new Map<string, number>()
  for (const payment of db.payments) {
    const label = `payment ${payment.id}`
    const charge = charges.get(payment.chargeId)
    if (!charge) {
      fail(`${label}: unknown charge ${payment.chargeId}`)
      continue
    }
    if (!isValidCents(payment.amountCents)) fail(`${label}: invalid amount`)
    if (payment.voidedAt && !payment.voidReason) fail(`${label}: voided without a reason`)
    if (isActivePayment(payment)) {
      paidByCharge.set(charge.id, (paidByCharge.get(charge.id) ?? 0) + payment.amountCents)
      if (charge.voidedAt) fail(`${label}: active payment on a void charge`)
    }
  }
  for (const [chargeId, paid] of paidByCharge) {
    const charge = charges.get(chargeId)
    if (charge && paid > charge.amountCents) fail(`charge ${chargeId}: overpaid (${paid} > ${charge.amountCents})`)
  }

  const billsPerOrder = new Map<string, number>()
  for (const expense of db.expenses) {
    const label = `expense ${expense.id}`
    if (!isValidCents(expense.amountCents)) fail(`${label}: invalid amount`)
    place(label, expense.propertyId, expense.unitId)
    if (expense.vendorId && !vendors.has(expense.vendorId)) fail(`${label}: unknown vendor ${expense.vendorId}`)
    if (!expense.vendorId && !expense.payeeName) fail(`${label}: no payee`)
    if (expense.dueDate < expense.billDate) fail(`${label}: due before bill date`)
    if (expense.paidOn && expense.paidOn < expense.billDate) fail(`${label}: paid before bill date`)
    if (expense.voidedAt && !expense.voidReason) fail(`${label}: voided without a reason`)
    if (expense.source === 'work-order') {
      const order = expense.workOrderId ? workOrders.get(expense.workOrderId) : undefined
      if (!order) {
        fail(`${label}: unknown work order ${expense.workOrderId}`)
        continue
      }
      billsPerOrder.set(order.id, (billsPerOrder.get(order.id) ?? 0) + 1)
      if (expense.id !== workOrderBillId(order.id)) fail(`${label}: unexpected id for a work-order bill`)
      if (order.status !== 'completed') fail(`${label}: work order ${order.id} isn't completed`)
      if (order.actualCost === null || expense.amountCents !== toCents(order.actualCost)) fail(`${label}: amount differs from work order ${order.id}`)
      if (expense.voidedAt) fail(`${label}: work-order bills can't be void`)
    }
  }
  for (const [orderId, count] of billsPerOrder) if (count > 1) fail(`work order ${orderId}: ${count} bills`)
  const expenseIds = new Set(db.expenses.map((expense) => expense.id))
  for (const order of db.workOrders) {
    if (order.status === 'completed' && order.actualCost !== null && !expenseIds.has(workOrderBillId(order.id))) fail(`work order ${order.id}: no bill`)
  }

  for (const entry of db.recurringCharges) if (!leases.has(entry.leaseId)) fail(`schedule ${entry.id}: unknown lease ${entry.leaseId}`)

  const records = new Set([...charges.keys(), ...expenseIds, ...recurring])
  for (const event of db.financeEvents) {
    if (!records.has(event.recordId)) fail(`event ${event.id}: unknown record ${event.recordId}`)
    if ((event.kind === 'auto-voided' || event.kind === 'auto-adjusted') && (event.actor !== 'system' || !event.reason)) {
      fail(`event ${event.id}: automatic change without a system reason`)
    }
  }

  const series: Array<[ReferenceSeries, string[]]> = [
    ['income', db.charges.map((charge) => charge.reference)],
    ['payment', db.payments.map((payment) => payment.reference)],
    ['expense', db.expenses.map((expense) => expense.reference)],
  ]
  for (const [name, references] of series) {
    const highest = Math.max(0, ...references.map((reference) => Number(reference.slice(REFERENCE_PREFIX[name].length + 1))))
    if (db.sequences[name] <= highest) fail(`sequence ${name} (${db.sequences[name]}) isn't ahead of ${highest}`)
  }

  return issues
}

export function assertFinanceIntegrity(db: DemoDatabase): void {
  const issues = checkFinanceIntegrity(db)
  if (issues.length > 0) throw new Error(`Finance integrity check failed:\n${issues.slice(0, 20).join('\n')}`)
}
