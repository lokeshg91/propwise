import { isActivePayment } from '@/data/domain/finance-rules'
import { inWindow, type FinanceSnapshot, type PropertyScope } from '@/data/domain/finance-summary'
import { type ReportMonth, type ReportWindow } from '@/data/domain/report-range'
import { type ExpenseCategory, type IncomeCategory } from '@/types'

/**
 * Income & Expense (cash basis). Headline figures are money collected and
 * paid in the period; billed (charges by due date) and incurred (bills by
 * bill date) are shown alongside, never added into net cash flow. Voided
 * charges, payments and bills are excluded. Amounts are integer cents.
 *
 * With the "All records" source this equals Finance's `totalsFor` and
 * `monthlyTrend` for the same window and properties (tested).
 */

/** Which records a report counts: everything, the sample records only, or records created in the app. */
export type RecordSource = 'all' | 'sample' | 'user'

export const matchesSource = (source: RecordSource, record: { demo?: true }) => source === 'all' || (source === 'sample') === (record.demo === true)

export interface CashFigures {
  collectedCents: number
  paidCents: number
  netCashFlowCents: number
  billedCents: number
  incurredCents: number
}

export interface IncomeExpenseMonth extends CashFigures {
  month: ReportMonth
}

export interface IncomeCategoryRow {
  category: IncomeCategory
  collectedCents: number
  billedCents: number
}

export interface ExpenseCategoryRow {
  category: ExpenseCategory
  paidCents: number
  incurredCents: number
}

export interface IncomeExpenseReport {
  totals: CashFigures
  months: IncomeExpenseMonth[]
  income: IncomeCategoryRow[]
  expenses: ExpenseCategoryRow[]
  /** Records counted, for the "includes sample records" notice. */
  counted: { records: number; sample: number }
}

const emptyFigures = (): CashFigures => ({ collectedCents: 0, paidCents: 0, netCashFlowCents: 0, billedCents: 0, incurredCents: 0 })
const inScope = (scope: PropertyScope, propertyId: string) => scope === null || scope.has(propertyId)

export function incomeExpenseReport(snapshot: FinanceSnapshot, window: Pick<ReportWindow, 'from' | 'to' | 'months'>, scope: PropertyScope, source: RecordSource): IncomeExpenseReport {
  const totals = emptyFigures()
  const months = window.months.map((month) => ({ month, ...emptyFigures() }))
  const monthOf = (date: string | undefined) => (date === undefined ? undefined : months.find((entry) => date >= entry.month.from && date <= entry.month.to))
  const income = new Map<IncomeCategory, IncomeCategoryRow>()
  const expenses = new Map<ExpenseCategory, ExpenseCategoryRow>()
  const incomeRow = (category: IncomeCategory) => income.get(category) ?? income.set(category, { category, collectedCents: 0, billedCents: 0 }).get(category)!
  const expenseRow = (category: ExpenseCategory) => expenses.get(category) ?? expenses.set(category, { category, paidCents: 0, incurredCents: 0 }).get(category)!
  const counted = { records: 0, sample: 0 }
  const count = (record: { demo?: true }) => {
    counted.records += 1
    if (record.demo) counted.sample += 1
  }

  const charges = new Map(snapshot.charges.map((charge) => [charge.id, charge]))
  // Collected: active payments received in the period, on charges that aren't void.
  for (const payment of snapshot.payments) {
    if (!isActivePayment(payment) || !matchesSource(source, payment) || !inWindow(payment.receivedOn, window)) continue
    const charge = charges.get(payment.chargeId)
    if (!charge || charge.voidedAt || !inScope(scope, charge.propertyId)) continue
    count(payment)
    totals.collectedCents += payment.amountCents
    incomeRow(charge.category).collectedCents += payment.amountCents
    const month = monthOf(payment.receivedOn)
    if (month) month.collectedCents += payment.amountCents
  }
  // Billed: non-void charges by due date.
  for (const charge of snapshot.charges) {
    if (charge.voidedAt || !matchesSource(source, charge) || !inScope(scope, charge.propertyId) || !inWindow(charge.dueDate, window)) continue
    count(charge)
    totals.billedCents += charge.amountCents
    incomeRow(charge.category).billedCents += charge.amountCents
    const month = monthOf(charge.dueDate)
    if (month) month.billedCents += charge.amountCents
  }
  // Paid (by paid date) and incurred (by bill date): non-void bills.
  for (const expense of snapshot.expenses) {
    if (expense.voidedAt || !matchesSource(source, expense) || !inScope(scope, expense.propertyId)) continue
    const paid = inWindow(expense.paidOn, window)
    const incurred = inWindow(expense.billDate, window)
    if (paid || incurred) count(expense)
    if (paid) {
      totals.paidCents += expense.amountCents
      expenseRow(expense.category).paidCents += expense.amountCents
      const month = monthOf(expense.paidOn)
      if (month) month.paidCents += expense.amountCents
    }
    if (incurred) {
      totals.incurredCents += expense.amountCents
      expenseRow(expense.category).incurredCents += expense.amountCents
      const month = monthOf(expense.billDate)
      if (month) month.incurredCents += expense.amountCents
    }
  }
  totals.netCashFlowCents = totals.collectedCents - totals.paidCents
  for (const month of months) month.netCashFlowCents = month.collectedCents - month.paidCents

  return {
    totals,
    months,
    income: [...income.values()].sort((a, b) => b.collectedCents - a.collectedCents || b.billedCents - a.billedCents),
    expenses: [...expenses.values()].sort((a, b) => b.paidCents - a.paidCents || b.incurredCents - a.incurredCents),
    counted,
  }
}
