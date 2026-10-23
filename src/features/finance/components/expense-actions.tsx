import { useState } from 'react'

import { FormField } from '@/components/forms/form-field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { todayIso } from '@/data/domain/dates'
import { markExpensePaid, markExpenseUnpaid, updateExpense, voidExpense } from '@/data/services'
import { ActionDialog } from '@/features/finance/components/action-dialog'
import { type ActionProps, MethodSelect } from '@/features/finance/components/income-actions'
import { useMoney } from '@/features/finance/hooks/use-money'
import { useFormat } from '@/hooks/use-format'
import { type Expense, type PaymentMethod } from '@/types'

export function MarkPaidDialog({ expense, onClose, onDone }: ActionProps & { expense: Expense }) {
  const money = useMoney()
  const [paidOn, setPaidOn] = useState(todayIso())
  const [method, setMethod] = useState<PaymentMethod>('bank-transfer')
  const [paymentRef, setPaymentRef] = useState('')
  return (
    <ActionDialog
      title={`Mark ${expense.reference} as paid`}
      description={`${money(expense.amountCents)} in full. Bills are paid in full in this release; Propwise only records it.`}
      submitLabel="Mark as paid"
      onClose={onClose}
      onSubmit={async () => {
        await markExpensePaid(expense.id, { paidOn, method, paymentRef })
        onDone(`${expense.reference} marked as paid`)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Paid on" required>
          {(field) => <Input {...field} type="date" value={paidOn} min={expense.billDate} max={todayIso()} onChange={(event) => setPaidOn(event.target.value)} />}
        </FormField>
        <MethodSelect value={method} onChange={setMethod} />
      </div>
      <FormField label="Payment reference" hint="e.g. ACH or check number (optional).">
        {(field) => <Input {...field} value={paymentRef} maxLength={40} onChange={(event) => setPaymentRef(event.target.value)} />}
      </FormField>
    </ActionDialog>
  )
}

export function MarkUnpaidDialog({ expense, onClose, onDone }: ActionProps & { expense: Expense }) {
  const { date: formatDate } = useFormat()
  const [reason, setReason] = useState('')
  return (
    <ActionDialog
      title={`Mark ${expense.reference} as unpaid?`}
      description={`The payment on ${expense.paidOn ? formatDate(expense.paidOn) : '—'} is removed from this bill and recorded in its history.`}
      submitLabel="Mark as unpaid"
      destructive
      submitDisabled={reason.trim().length < 2}
      onClose={onClose}
      onSubmit={async () => {
        await markExpenseUnpaid(expense.id, reason)
        onDone(`${expense.reference} marked as unpaid`)
      }}
    >
      <FormField label="Reason" required hint="Saved in the bill’s history.">
        {(field) => <Textarea {...field} value={reason} rows={2} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Payment was returned" />}
      </FormField>
    </ActionDialog>
  )
}

export function VoidExpenseDialog({ expense, onClose, onDone }: ActionProps & { expense: Expense }) {
  const [reason, setReason] = useState('')
  const blocked =
    expense.source === 'work-order' ? 'Bills from work orders can’t be voided: the cost belongs to the work order.' : expense.paidOn ? 'Mark the bill as unpaid before voiding it.' : null
  return (
    <ActionDialog
      title={`Void ${expense.reference}?`}
      description={blocked ?? 'The bill stops counting towards expenses. It stays in the history with your reason.'}
      submitLabel="Void bill"
      destructive
      submitDisabled={blocked !== null || reason.trim().length < 2}
      onClose={onClose}
      onSubmit={async () => {
        await voidExpense(expense.id, reason)
        onDone(`${expense.reference} voided`)
      }}
    >
      {blocked ? null : (
        <FormField label="Reason" required hint="Saved in the bill’s history.">
          {(field) => <Textarea {...field} value={reason} rows={2} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Entered twice" />}
        </FormField>
      )}
    </ActionDialog>
  )
}

/** Work-order bills: only the due date can change (the amount belongs to the work order). */
export function ChangeDueDateDialog({ expense, onClose, onDone }: ActionProps & { expense: Expense }) {
  const { date: formatDate } = useFormat()
  const [dueDate, setDueDate] = useState(expense.dueDate)
  return (
    <ActionDialog
      title={`Change the due date of ${expense.reference}`}
      description="The amount and vendor come from the work order and stay as they are."
      submitLabel="Save due date"
      submitDisabled={dueDate === expense.dueDate || dueDate < expense.billDate}
      onClose={onClose}
      onSubmit={async () => {
        await updateExpense(expense.id, {
          category: expense.category,
          ...(expense.vendorId ? { vendorId: expense.vendorId } : { payeeName: expense.payeeName ?? '' }),
          propertyId: expense.propertyId,
          ...(expense.unitId ? { unitId: expense.unitId } : {}),
          description: expense.description,
          amountCents: expense.amountCents,
          billDate: expense.billDate,
          dueDate,
        })
        onDone(`Due date of ${expense.reference} changed to ${formatDate(dueDate)}`)
      }}
    >
      <FormField label="Due date" required hint={`On or after the bill date (${formatDate(expense.billDate)}).`}>
        {(field) => <Input {...field} type="date" value={dueDate} min={expense.billDate} onChange={(event) => setDueDate(event.target.value)} />}
      </FormField>
    </ActionDialog>
  )
}
