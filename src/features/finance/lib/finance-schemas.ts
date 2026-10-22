import { z } from 'zod'

import { addDays, todayIso } from '@/data/domain/dates'
import { periodOf } from '@/data/domain/finance-schedule'
import { parseMoneyInput } from '@/data/domain/money'
import { FINANCE_LIMITS } from '@/data/services'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, RECURRING_CATEGORIES } from '@/types'

/** A typed amount; the services check the same limits again on save. */
const amount = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter the ${label}`)
    .refine((value) => parseMoneyInput(value) !== null, 'Enter an amount like 1250.00 (up to two decimals)')
const optionalAmount = z
  .string()
  .trim()
  .refine((value) => value === '' || parseMoneyInput(value) !== null, 'Enter an amount like 1250.00 (up to two decimals)')
const date = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `Enter the ${label}`)

/* ------------------------------------------------------------------ income */

export const incomeSchema = z
  .object({
    payer: z.enum(['tenant', 'other']),
    propertyId: z.string().min(1, 'Choose a property'),
    leaseId: z.string(),
    payerName: z.string().trim().max(FINANCE_LIMITS.payerName, `Keep it under ${FINANCE_LIMITS.payerName} characters`),
    unitId: z.string(),
    category: z.enum(RECURRING_CATEGORIES),
    description: z.string().trim().max(FINANCE_LIMITS.description, `Keep it under ${FINANCE_LIMITS.description} characters`),
    amount: amount('amount'),
    dueDate: date('due date'),
    repeat: z.boolean(),
    startPeriod: z.string(),
    endPeriod: z.string(),
    received: z.boolean(),
    receivedOn: z.string(),
    method: z.enum(PAYMENT_METHODS),
    externalRef: z.string().trim().max(40),
  })
  .superRefine((values, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
    if (values.payer === 'tenant' && !values.leaseId) issue('leaseId', 'Choose the tenant')
    if (values.payer === 'other' && values.payerName.length < 2) issue('payerName', 'Enter who pays')
    if (values.repeat) {
      if (values.payer !== 'tenant') issue('repeat', 'Recurring charges are for tenants only')
      if (values.description.length < 2) issue('description', 'Describe the recurring charge, e.g. Reserved parking space')
      if (!/^\d{4}-\d{2}$/.test(values.startPeriod) || values.startPeriod < periodOf(todayIso())) issue('startPeriod', 'Start this month or later')
      if (values.endPeriod && values.endPeriod < values.startPeriod) issue('endPeriod', 'The last month can’t be before the first')
    }
    if (values.received && !values.repeat) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.receivedOn)) issue('receivedOn', 'Enter the date it was received')
      else if (values.receivedOn > todayIso()) issue('receivedOn', 'The payment date can’t be in the future')
    }
  })

export type IncomeDraft = z.input<typeof incomeSchema>
export type IncomeValues = z.output<typeof incomeSchema>

export function emptyIncome(options: { propertyId?: string; leaseId?: string } = {}): IncomeDraft {
  const today = todayIso()
  return {
    payer: 'tenant',
    propertyId: options.propertyId ?? '',
    leaseId: options.leaseId ?? '',
    payerName: '',
    unitId: '',
    category: 'parking',
    description: '',
    amount: '',
    dueDate: today,
    repeat: false,
    startPeriod: periodOf(today),
    endPeriod: '',
    received: false,
    receivedOn: today,
    method: 'bank-transfer',
    externalRef: '',
  }
}

/* ----------------------------------------------------------------- expense */

export const expenseSchema = z
  .object({
    payee: z.enum(['vendor', 'other']),
    vendorId: z.string(),
    payeeName: z.string().trim().max(FINANCE_LIMITS.payerName, `Keep it under ${FINANCE_LIMITS.payerName} characters`),
    propertyId: z.string().min(1, 'Choose a property'),
    unitId: z.string(),
    category: z.enum(EXPENSE_CATEGORIES),
    description: z.string().trim().min(2, 'Describe the bill').max(FINANCE_LIMITS.description, `Keep it under ${FINANCE_LIMITS.description} characters`),
    invoiceNumber: z.string().trim().max(40),
    estimate: optionalAmount,
    amount: amount('amount'),
    billDate: date('bill date'),
    dueDate: date('due date'),
    paid: z.boolean(),
    paidOn: z.string(),
    method: z.enum(PAYMENT_METHODS),
    paymentRef: z.string().trim().max(40),
  })
  .superRefine((values, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message })
    if (values.payee === 'vendor' && !values.vendorId) issue('vendorId', 'Choose the vendor')
    if (values.payee === 'other' && values.payeeName.length < 2) issue('payeeName', 'Enter who is paid')
    if (values.dueDate < values.billDate) issue('dueDate', 'The due date can’t be before the bill date')
    if (values.paid) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(values.paidOn)) issue('paidOn', 'Enter the date it was paid')
      else if (values.paidOn > todayIso()) issue('paidOn', 'The payment date can’t be in the future')
      else if (values.paidOn < values.billDate) issue('paidOn', 'The payment date can’t be before the bill date')
    }
  })

export type ExpenseDraft = z.input<typeof expenseSchema>
export type ExpenseValues = z.output<typeof expenseSchema>

export function emptyExpense(termsDays: number, options: { propertyId?: string; vendorId?: string } = {}): ExpenseDraft {
  const today = todayIso()
  return {
    payee: 'vendor',
    vendorId: options.vendorId ?? '',
    payeeName: '',
    propertyId: options.propertyId ?? '',
    unitId: '',
    category: 'maintenance',
    description: '',
    invoiceNumber: '',
    estimate: '',
    amount: '',
    billDate: today,
    dueDate: addDays(today, termsDays),
    paid: false,
    paidOn: today,
    method: 'bank-transfer',
    paymentRef: '',
  }
}
