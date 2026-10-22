import { parseMoneyInput } from '@/data/domain/money'
import { type ExpenseInput } from '@/data/services'
import { type ExpenseDraft, type ExpenseValues } from '@/features/finance/lib/finance-schemas'
import { type Expense } from '@/types'

export function toExpenseInput(values: ExpenseValues): ExpenseInput {
  const estimate = values.estimate ? parseMoneyInput(values.estimate) : null
  return {
    category: values.category,
    ...(values.payee === 'vendor' ? { vendorId: values.vendorId } : { payeeName: values.payeeName }),
    propertyId: values.propertyId,
    ...(values.unitId ? { unitId: values.unitId } : {}),
    description: values.description,
    ...(values.invoiceNumber ? { invoiceNumber: values.invoiceNumber } : {}),
    ...(estimate !== null ? { estimatedCents: estimate } : {}),
    amountCents: parseMoneyInput(values.amount) ?? 0,
    billDate: values.billDate,
    dueDate: values.dueDate,
  }
}

export function toExpenseDraft(expense: Expense): ExpenseDraft {
  return {
    payee: expense.vendorId ? 'vendor' : 'other',
    vendorId: expense.vendorId ?? '',
    payeeName: expense.payeeName ?? '',
    propertyId: expense.propertyId,
    unitId: expense.unitId ?? '',
    category: expense.category,
    description: expense.description,
    invoiceNumber: expense.invoiceNumber ?? '',
    estimate: expense.estimatedCents !== undefined ? (expense.estimatedCents / 100).toFixed(2) : '',
    amount: (expense.amountCents / 100).toFixed(2),
    billDate: expense.billDate,
    dueDate: expense.dueDate,
    paid: false,
    paidOn: expense.billDate,
    method: 'bank-transfer',
    paymentRef: '',
  }
}
