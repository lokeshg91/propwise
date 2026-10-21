export const PAYMENT_STATUSES = ['paid', 'scheduled', 'pending', 'overdue'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export interface RentPayment {
  id: string
  tenantName: string
  propertyId: string
  unit: string
  /** Amount due in USD. */
  amount: number
  /** ISO date (YYYY-MM-DD). */
  dueDate: string
  /** True when the tenant pays automatically on the due date. */
  autopay: boolean
  paidAt: string | null
}
