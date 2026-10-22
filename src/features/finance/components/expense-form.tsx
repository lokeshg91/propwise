import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { addDays } from '@/data/domain/dates'
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { isFinanceDuplicateError, isServiceError, type FinanceFormOptions } from '@/data/services'
import { ActionDialog, DuplicateMatches, type DuplicateMatch } from '@/features/finance/components/action-dialog'
import { ChoiceCards, FormErrorSummary, FormFooter, SelectField } from '@/features/finance/components/form-parts'
import { MoneyInput } from '@/features/finance/components/money-input'
import { expenseSchema, type ExpenseDraft, type ExpenseValues } from '@/features/finance/lib/finance-schemas'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from '@/types'

const FIELD_MAP: Record<string, keyof ExpenseDraft> = {
  vendorId: 'vendorId',
  payeeName: 'payeeName',
  propertyId: 'propertyId',
  unitId: 'unitId',
  category: 'category',
  description: 'description',
  invoiceNumber: 'invoiceNumber',
  estimatedCents: 'estimate',
  amountCents: 'amount',
  billDate: 'billDate',
  dueDate: 'dueDate',
  paidOn: 'paidOn',
  method: 'method',
}

interface ExpenseFormProps {
  options: FinanceFormOptions
  defaultValues: ExpenseDraft
  /** Edit mode hides "Already paid" (use Mark as paid on the bill) and keeps Save disabled until something changes. */
  mode: 'create' | 'edit'
  /** Extra vendor offered on edit when the bill's vendor has since become inactive. */
  currentVendor?: { id: string; name: string }
  cancelHref: string
  onSave: (values: ExpenseValues, acknowledgeDuplicate: boolean) => Promise<void>
}

/** Bill form. Nothing is shown as saved until the service has stored it. */
export function ExpenseForm({ options, defaultValues, mode, currentVendor, cancelHref, onSave }: ExpenseFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting, submitCount, isDirty, dirtyFields },
  } = useForm<ExpenseDraft, unknown, ExpenseValues>({ resolver: zodResolver(expenseSchema), defaultValues, mode: 'onTouched' })
  const [payee, propertyId, paid] = useWatch({ control, name: ['payee', 'propertyId', 'paid'] })
  const [rootError, setRootError] = useState<{ message: string; matches?: DuplicateMatch[] } | null>(null)
  const [pending, setPending] = useState<{ values: ExpenseValues; message: string; matches: DuplicateMatch[] } | null>(null)
  const property = options.properties.find((entry) => entry.id === propertyId)
  const vendors = currentVendor && !options.vendors.some((vendor) => vendor.id === currentVendor.id) ? [...options.vendors, { ...currentVendor, name: `${currentVendor.name} (inactive)` }] : options.vendors

  const onSubmit = handleSubmit(async (values) => {
    setRootError(null)
    try {
      await onSave(values, false)
    } catch (error) {
      if (isFinanceDuplicateError(error) && error.requiresConfirmation) return setPending({ values, message: error.message, matches: error.matches })
      const field = isServiceError(error) && error.field ? FIELD_MAP[error.field] : undefined
      if (field) setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
      if (!field || isFinanceDuplicateError(error)) {
        setRootError({ message: error instanceof Error ? error.message : 'Something went wrong. Try again.', ...(isFinanceDuplicateError(error) ? { matches: error.matches } : {}) })
      }
    }
  })

  const errorCount = Object.keys(errors).length
  return (
    <>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-6">
        {rootError ? (
          <div className="flex flex-col gap-2">
            <FormErrorSummary message={rootError.message} />
            {rootError.matches ? <DuplicateMatches matches={rootError.matches} /> : null}
          </div>
        ) : submitCount > 0 && errorCount > 0 ? (
          <FormErrorSummary message={`Please fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'} before saving.`} />
        ) : null}

        <FormSection title="Payee" description="A vendor in Propwise, or anyone else (utilities, insurer, tax office).">
          <Controller
            control={control}
            name="payee"
            render={({ field }) => (
              <ChoiceCards
                legend="Paid to"
                name="expense-payee"
                value={field.value}
                onChange={field.onChange}
                options={[
                  { value: 'vendor', title: 'Vendor', note: 'Active vendors from the Vendors module.' },
                  { value: 'other', title: 'Other payee', note: 'Anyone who isn’t a vendor in Propwise.' },
                ]}
              />
            )}
          />
          {payee === 'vendor' ? (
            <Controller
              control={control}
              name="vendorId"
              render={({ field }) => (
                <SelectField
                  label="Vendor"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={vendors.map((vendor) => ({ value: vendor.id, label: vendor.name }))}
                  placeholder="Choose a vendor"
                  error={errors.vendorId?.message}
                  hint="Inactive vendors can’t get new bills."
                />
              )}
            />
          ) : (
            <FormField label="Payee name" required error={errors.payeeName?.message}>
              {(field) => <Input {...field} {...register('payeeName')} placeholder="e.g. Larkspur Power & Water" />}
            </FormField>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="propertyId"
              render={({ field }) => (
                <SelectField
                  label="Property"
                  required
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value)
                    setValue('unitId', '')
                  }}
                  options={options.properties.map((entry) => ({ value: entry.id, label: entry.name }))}
                  placeholder="Choose a property"
                  error={errors.propertyId?.message}
                />
              )}
            />
            <Controller
              control={control}
              name="unitId"
              render={({ field }) => (
                <SelectField
                  label="Unit"
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!property}
                  options={(property?.units ?? []).map((unit) => ({ value: unit.id, label: unit.label }))}
                  placeholder="Whole property"
                  hint="Optional."
                />
              )}
            />
          </div>
        </FormSection>

        <FormSection title="Bill" description="Amounts in the Finance currency. Bills are paid in full.">
          <div className="grid gap-5 sm:grid-cols-2">
            <Controller
              control={control}
              name="category"
              render={({ field }) => (
                <SelectField
                  label="Category"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  options={EXPENSE_CATEGORIES.map((category) => ({ value: category, label: EXPENSE_CATEGORY_LABELS[category] }))}
                  placeholder="Choose a category"
                  error={errors.category?.message}
                />
              )}
            />
            <FormField label="Invoice number" error={errors.invoiceNumber?.message} hint="Optional. The same number can’t be recorded twice for one payee.">
              {(field) => <Input {...field} {...register('invoiceNumber')} />}
            </FormField>
          </div>
          <FormField label="Description" required error={errors.description?.message}>
            {(field) => <Textarea {...field} {...register('description')} rows={2} placeholder="e.g. Common-area electricity, October" />}
          </FormField>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Amount" required error={errors.amount?.message}>
              {(field) => <MoneyInput {...field} {...register('amount')} placeholder="0.00" />}
            </FormField>
            <FormField label="Estimate" error={errors.estimate?.message} hint="Optional. Used to compare actual and estimated cost.">
              {(field) => <MoneyInput {...field} {...register('estimate')} placeholder="0.00" />}
            </FormField>
            <FormField label="Bill date" required error={errors.billDate?.message}>
              {(field) => (
                <Input
                  {...field}
                  {...register('billDate', {
                    onChange: () => {
                      // Keep the default payment terms until the due date is changed by hand.
                      if (!dirtyFields.dueDate) setValue('dueDate', addDays(getValues('billDate'), options.settings.paymentTermsDays))
                    },
                  })}
                  type="date"
                />
              )}
            </FormField>
            <FormField label="Due date" required error={errors.dueDate?.message} hint={`Defaults to ${options.settings.paymentTermsDays} days after the bill date.`}>
              {(field) => <Input {...field} {...register('dueDate')} type="date" />}
            </FormField>
          </div>
        </FormSection>

        {mode === 'create' ? (
          <FormSection title="Payment" description="Record the payment now if the bill is already paid.">
            <label className="flex cursor-pointer items-center gap-3 text-body text-foreground">
              <Controller control={control} name="paid" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              Already paid
            </label>
            {paid ? (
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField label="Paid on" required error={errors.paidOn?.message}>
                  {(field) => <Input {...field} {...register('paidOn')} type="date" />}
                </FormField>
                <Controller
                  control={control}
                  name="method"
                  render={({ field }) => (
                    <SelectField label="Method" required value={field.value} onChange={field.onChange} options={PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))} placeholder="Method" />
                  )}
                />
                <FormField label="Payment reference" hint="Optional.">
                  {(field) => <Input {...field} {...register('paymentRef')} />}
                </FormField>
              </div>
            ) : null}
          </FormSection>
        ) : null}

        <FormFooter cancelHref={cancelHref} submitLabel={mode === 'create' ? 'Add bill' : 'Save changes'} submitting={isSubmitting} disabled={mode === 'edit' && !isDirty} />
      </form>
      {pending ? (
        <ActionDialog
          title="Possible duplicate"
          description={`${pending.message} Check it isn’t the same bill before saving.`}
          submitLabel="Save anyway"
          onClose={() => setPending(null)}
          onSubmit={async () => {
            await onSave(pending.values, true)
            setPending(null)
          }}
        >
          <DuplicateMatches matches={pending.matches} />
        </ActionDialog>
      ) : null}
    </>
  )
}
