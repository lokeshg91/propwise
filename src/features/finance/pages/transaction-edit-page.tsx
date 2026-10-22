import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { centsToInput, parseMoneyInput } from '@/data/domain/money'
import { FINANCE_LIMITS, isFinanceDuplicateError, isServiceError, updateCharge, updateExpense, type TransactionDetail } from '@/data/services'
import { ActionDialog, DuplicateMatches, type DuplicateMatch } from '@/features/finance/components/action-dialog'
import { ExpenseForm } from '@/features/finance/components/expense-form'
import { FormErrorSummary, FormFooter } from '@/features/finance/components/form-parts'
import { MoneyInput } from '@/features/finance/components/money-input'
import { useMoney } from '@/features/finance/hooks/use-money'
import { toExpenseDraft, toExpenseInput } from '@/features/finance/lib/expense-input'
import { type transactionEditLoader } from '@/features/finance/finance.loaders'

const chargeSchema = z.object({
  payerName: z.string().trim().max(FINANCE_LIMITS.payerName),
  description: z.string().trim().max(FINANCE_LIMITS.description),
  amount: z.string().trim().refine((value) => parseMoneyInput(value) !== null, 'Enter an amount like 1250.00 (up to two decimals)'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter the due date'),
})
type ChargeDraft = z.input<typeof chargeSchema>

export function TransactionEditPage() {
  const { detail, options } = useLoaderData<typeof transactionEditLoader>()
  const navigate = useNavigate()
  const reference = detail.kind === 'income' ? detail.charge.reference : detail.expense.reference
  const id = detail.kind === 'income' ? detail.charge.id : detail.expense.id
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to={`/finance/transactions/${id}`} label={reference} />
        <PageHeader title={`Edit ${reference}`} description="Changes are recorded in the record’s history. Payments are never edited: void and record them again instead." />
      </div>
      {detail.kind === 'income' ? (
        <ChargeEditForm detail={detail} />
      ) : (
        <ExpenseForm
          mode="edit"
          options={options}
          defaultValues={toExpenseDraft(detail.expense)}
          currentVendor={detail.vendor ? { id: detail.vendor.id, name: detail.vendor.name } : undefined}
          cancelHref={`/finance/transactions/${id}`}
          onSave={async (values, acknowledgeDuplicate) => {
            await updateExpense(id, toExpenseInput(values), { acknowledgeDuplicate })
            toast.success(`${reference} saved`)
            await navigate(`/finance/transactions/${id}`)
          }}
        />
      )}
    </PageContainer>
  )
}

function ChargeEditForm({ detail }: { detail: Extract<TransactionDetail, { kind: 'income' }> }) {
  const { charge, state } = detail
  const navigate = useNavigate()
  const money = useMoney()
  const [rootError, setRootError] = useState<{ message: string; matches?: DuplicateMatch[] } | null>(null)
  const [pending, setPending] = useState<ChargeDraft | null>(null)
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ChargeDraft>({
    resolver: zodResolver(chargeSchema),
    defaultValues: { payerName: charge.payerName ?? '', description: charge.description ?? '', amount: centsToInput(charge.amountCents), dueDate: charge.dueDate },
    mode: 'onTouched',
  })

  const save = async (values: ChargeDraft, acknowledgeDuplicate: boolean) => {
    await updateCharge(
      charge.id,
      { description: values.description, amountCents: parseMoneyInput(values.amount) ?? 0, dueDate: values.dueDate, ...(charge.leaseId ? {} : { payerName: values.payerName }) },
      { acknowledgeDuplicate },
    )
    toast.success(`${charge.reference} saved`)
    await navigate(`/finance/transactions/${charge.id}`)
  }

  const onSubmit = handleSubmit(async (values) => {
    setRootError(null)
    try {
      await save(values, false)
    } catch (error) {
      if (isFinanceDuplicateError(error) && error.requiresConfirmation) return setPending(values)
      const field = isServiceError(error) && error.field === 'amountCents' ? 'amount' : isServiceError(error) && (error.field === 'dueDate' || error.field === 'payerName' || error.field === 'description') ? error.field : undefined
      if (field) setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
      else setRootError({ message: error instanceof Error ? error.message : 'Something went wrong. Try again.' })
    }
  })

  return (
    <>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-6">
        {rootError ? <FormErrorSummary message={rootError.message} /> : null}
        <FormSection title="Charge" description={state.paidCents > 0 ? `${money(state.paidCents)} is already paid, so the amount can’t go below that.` : 'Nothing has been paid yet.'}>
          {charge.leaseId ? null : (
            <FormField label="Payer name" required error={errors.payerName?.message}>
              {(field) => <Input {...field} {...register('payerName')} />}
            </FormField>
          )}
          <FormField label="Description" error={errors.description?.message}>
            {(field) => <Textarea {...field} {...register('description')} rows={2} />}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Amount" required error={errors.amount?.message}>
              {(field) => <MoneyInput {...field} {...register('amount')} />}
            </FormField>
            <FormField label="Due date" required error={errors.dueDate?.message}>
              {(field) => <Input {...field} {...register('dueDate')} type="date" min={charge.issuedOn} />}
            </FormField>
          </div>
        </FormSection>
        <FormFooter cancelHref={`/finance/transactions/${charge.id}`} submitLabel="Save changes" submitting={isSubmitting} disabled={!isDirty} />
      </form>
      {pending ? (
        <ActionDialog title="Possible duplicate" description="Another charge has the same payer, category, amount and due date." submitLabel="Save anyway" onClose={() => setPending(null)} onSubmit={() => save(pending, true)}>
          {rootError?.matches ? <DuplicateMatches matches={rootError.matches} /> : null}
        </ActionDialog>
      ) : null}
    </>
  )
}
