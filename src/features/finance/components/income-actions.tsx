import { useState } from 'react'

import { FormField } from '@/components/forms/form-field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { todayIso } from '@/data/domain/dates'
import { PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { describeLateFeeRule } from '@/data/domain/finance-rules'
import { periodOf } from '@/data/domain/finance-schedule'
import { centsToInput, parseMoneyInput } from '@/data/domain/money'
import { addLateFee, adjustCharge, endRecurringCharge, recordPayment, voidCharge, voidPayment, type TransactionDetail } from '@/data/services'
import { ActionDialog } from '@/features/finance/components/action-dialog'
import { MoneyInput } from '@/features/finance/components/money-input'
import { useMoney } from '@/features/finance/hooks/use-money'
import { useFormat } from '@/hooks/use-format'
import { PAYMENT_METHODS, type Payment, type PaymentMethod, type RecurringCharge } from '@/types'

type IncomeDetailData = Extract<TransactionDetail, { kind: 'income' }>

export interface ActionProps {
  onClose: () => void
  /** Called after a successful save with the confirmation to show. */
  onDone: (message: string) => void
}

export function MethodSelect({ value, onChange }: { value: PaymentMethod; onChange: (method: PaymentMethod) => void }) {
  return (
    <FormField label="Method" required>
      {(field) => (
        <Select value={value} onValueChange={(method) => onChange(method as PaymentMethod)}>
          <SelectTrigger {...field} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAYMENT_METHODS.map((method) => (
              <SelectItem key={method} value={method}>
                {PAYMENT_METHOD_LABELS[method]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  )
}

function ReasonField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <FormField label="Reason" required hint="Saved in the record’s history.">
      {(field) => <Textarea {...field} value={value} onChange={(event) => onChange(event.target.value)} rows={2} maxLength={300} placeholder={placeholder} />}
    </FormField>
  )
}

/** Records money received against one charge (partial payments allowed, never more than the balance). */
export function RecordPaymentDialog({ detail, onClose, onDone }: ActionProps & { detail: Pick<IncomeDetailData, 'charge' | 'state'> }) {
  const money = useMoney()
  const { charge, state } = detail
  const [amount, setAmount] = useState(centsToInput(state.balanceCents))
  const [receivedOn, setReceivedOn] = useState(todayIso())
  const [method, setMethod] = useState<PaymentMethod>('bank-transfer')
  const [externalRef, setExternalRef] = useState('')
  const [note, setNote] = useState('')
  const cents = parseMoneyInput(amount)
  const left = cents === null ? null : state.balanceCents - cents
  const amountError = amount.trim() === '' ? undefined : cents === null ? 'Enter an amount like 1250.00.' : cents > state.balanceCents ? `The balance is ${money(state.balanceCents)}. Credits aren’t supported.` : undefined

  return (
    <ActionDialog
      title={`Record payment for ${charge.reference}`}
      description={`Balance ${money(state.balanceCents)} of ${money(charge.amountCents)}. Propwise only records the payment; it doesn’t move money.`}
      submitLabel="Record payment"
      submitDisabled={cents === null || amountError !== undefined}
      onClose={onClose}
      onSubmit={async (acknowledgeDuplicate) => {
        const payment = await recordPayment(charge.id, { amountCents: cents ?? 0, receivedOn, method, externalRef, note }, { acknowledgeDuplicate })
        onDone(`${payment.reference} recorded: ${money(payment.amountCents)}`)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount" required error={amountError} hint={left !== null && left > 0 ? `Leaves ${money(left)} outstanding.` : left === 0 ? 'Pays the charge in full.' : undefined}>
          {(field) => <MoneyInput {...field} value={amount} onChange={(event) => setAmount(event.target.value)} />}
        </FormField>
        <FormField label="Received on" required>
          {(field) => <Input {...field} type="date" value={receivedOn} max={todayIso()} min={charge.issuedOn} onChange={(event) => setReceivedOn(event.target.value)} />}
        </FormField>
        <MethodSelect value={method} onChange={setMethod} />
        <FormField label="Reference" hint="Check number or bank reference (optional).">
          {(field) => <Input {...field} value={externalRef} maxLength={40} onChange={(event) => setExternalRef(event.target.value)} />}
        </FormField>
      </div>
      <FormField label="Note">
        {(field) => <Textarea {...field} value={note} rows={2} maxLength={300} onChange={(event) => setNote(event.target.value)} />}
      </FormField>
    </ActionDialog>
  )
}

export function VoidPaymentDialog({ payment, onClose, onDone }: ActionProps & { payment: Payment }) {
  const { date: formatDate } = useFormat()
  const money = useMoney()
  const [reason, setReason] = useState('')
  return (
    <ActionDialog
      title={`Void ${payment.reference}?`}
      description={`${money(payment.amountCents)} received on ${formatDate(payment.receivedOn)} will stop counting towards the charge. The payment stays in the history.`}
      submitLabel="Void payment"
      destructive
      submitDisabled={reason.trim().length < 2}
      onClose={onClose}
      onSubmit={async () => {
        await voidPayment(payment.id, reason)
        onDone(`${payment.reference} voided`)
      }}
    >
      <ReasonField value={reason} onChange={setReason} placeholder="e.g. Check returned by the bank" />
    </ActionDialog>
  )
}

export function AdjustChargeDialog({ detail, onClose, onDone }: ActionProps & { detail: IncomeDetailData }) {
  const money = useMoney()
  const { charge, state } = detail
  const [amount, setAmount] = useState(centsToInput(charge.amountCents))
  const [reason, setReason] = useState('')
  const cents = parseMoneyInput(amount)
  const amountError =
    cents === null ? 'Enter an amount like 1250.00.' : cents < state.paidCents ? `Can’t be less than the ${money(state.paidCents)} already paid.` : cents === charge.amountCents ? 'Enter a different amount.' : undefined
  return (
    <ActionDialog
      title={`Adjust ${charge.reference}`}
      description="Change the amount owed, for example for a concession. Automatic updates from the lease stop for this charge."
      submitLabel="Save adjustment"
      submitDisabled={amountError !== undefined || reason.trim().length < 2}
      onClose={onClose}
      onSubmit={async () => {
        await adjustCharge(charge.id, cents ?? 0, reason)
        onDone(`${charge.reference} adjusted to ${money(cents ?? 0)}`)
      }}
    >
      <FormField label="New amount" required error={amount.trim() ? amountError : undefined} hint={`Currently ${money(charge.amountCents)}; ${money(state.paidCents)} paid.`}>
        {(field) => <MoneyInput {...field} value={amount} onChange={(event) => setAmount(event.target.value)} />}
      </FormField>
      <ReasonField value={reason} onChange={setReason} placeholder="e.g. One-month concession agreed" />
    </ActionDialog>
  )
}

export function VoidChargeDialog({ detail, onClose, onDone }: ActionProps & { detail: IncomeDetailData }) {
  const { charge, payments, lateFee } = detail
  const [reason, setReason] = useState('')
  const active = payments.filter((payment) => !payment.voidedAt)
  const blocked = active.length > 0 ? `Void the ${active.length === 1 ? 'payment' : `${active.length} payments`} on this charge first (${active.map((payment) => payment.reference).join(', ')}).` : lateFee ? `Void the late fee ${lateFee.reference} first.` : null
  return (
    <ActionDialog
      title={`Void ${charge.reference}?`}
      description={blocked ?? 'The charge stops counting towards the balance. It stays in the history with your reason.'}
      submitLabel="Void charge"
      destructive
      submitDisabled={blocked !== null || reason.trim().length < 2}
      onClose={onClose}
      onSubmit={async () => {
        await voidCharge(charge.id, reason)
        onDone(`${charge.reference} voided`)
      }}
    >
      {blocked ? null : <ReasonField value={reason} onChange={setReason} placeholder="e.g. Billed to the wrong tenant" />}
    </ActionDialog>
  )
}

/** The amount comes from the central rule and can't be edited. */
export function AddLateFeeDialog({ detail, onClose, onDone }: ActionProps & { detail: IncomeDetailData }) {
  const money = useMoney()
  const { charge, lateFeeAllowed, rule, property } = detail
  return (
    <ActionDialog
      title={`Add a late fee to ${charge.reference}`}
      description={`${property?.type === 'commercial' ? 'Commercial' : 'Residential'} rule: ${money(lateFeeAllowed.suggestedCents)}, due today.`}
      submitLabel={`Add ${money(lateFeeAllowed.suggestedCents)} late fee`}
      submitDisabled={!lateFeeAllowed.allowed}
      onClose={onClose}
      onSubmit={async () => {
        const fee = await addLateFee(charge.id)
        onDone(`${fee.reference} added: ${money(fee.amountCents)} late fee`)
      }}
    >
      <p className="text-caption text-muted-foreground">{describeLateFeeRule(rule, (cents) => money(cents))}</p>
    </ActionDialog>
  )
}

export function EndRecurringDialog({ schedule, onClose, onDone }: ActionProps & { schedule: RecurringCharge }) {
  const [lastPeriod, setLastPeriod] = useState(periodOf(todayIso()))
  return (
    <ActionDialog
      title="End recurring charge"
      description={`${schedule.description}. Months after the last one won’t be billed; unpaid charges for those months are voided automatically with a reason.`}
      submitLabel="End schedule"
      destructive
      onClose={onClose}
      onSubmit={async () => {
        await endRecurringCharge(schedule.id, lastPeriod)
        onDone('Recurring charge ended')
      }}
    >
      <FormField label="Last month billed" required>
        {(field) => <Input {...field} type="month" value={lastPeriod} min={schedule.startPeriod} onChange={(event) => setLastPeriod(event.target.value)} />}
      </FormField>
    </ActionDialog>
  )
}

