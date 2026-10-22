import { type AgingBucket, type ChargeStatus, type ExpenseStatus } from '@/data/domain/finance-rules'
import { type FinanceRange } from '@/data/domain/finance-summary'
import { type ExpenseCategory, type IncomeCategory, type PaymentMethod } from '@/types'

/** Display labels shared by services (history text) and the Finance UI. */

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  rent: 'Rent',
  'late-fee': 'Late fee',
  parking: 'Parking',
  'service-charge': 'Service charge (CAM)',
  'utility-recovery': 'Utility recovery',
  'other-income': 'Other income',
}

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  maintenance: 'Maintenance',
  utilities: 'Utilities',
  insurance: 'Insurance',
  'property-tax': 'Property tax',
  'management-fee': 'Management fee',
  cleaning: 'Cleaning',
  landscaping: 'Landscaping',
  security: 'Security',
  'pest-control': 'Pest control',
  supplies: 'Supplies',
  'other-expense': 'Other expense',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  'bank-transfer': 'Bank transfer',
  card: 'Card',
  check: 'Check',
  cash: 'Cash',
  other: 'Other',
}

export const CHARGE_STATUS_LABELS: Record<ChargeStatus, string> = {
  pending: 'Pending',
  'partially-paid': 'Partially paid',
  overdue: 'Overdue',
  paid: 'Paid',
  void: 'Void',
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  pending: 'Pending',
  overdue: 'Overdue',
  paid: 'Paid',
  void: 'Void',
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  current: 'Due today',
  '1-30': '1–30 days',
  '31-60': '31–60 days',
  '61-90': '61–90 days',
  '90+': '90+ days',
}

export const FINANCE_RANGE_LABELS: Record<FinanceRange, string> = {
  'this-month': 'This month',
  '3m': 'Last 3 months',
  '6m': 'Last 6 months',
  '12m': 'Last 12 months',
  ytd: 'Year to date',
}
