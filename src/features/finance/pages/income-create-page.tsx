import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { INCOME_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { parseMoneyInput } from '@/data/domain/money'
import { createCharge, createRecurringCharge, isFinanceDuplicateError, isServiceError } from '@/data/services'
import { ActionDialog, DuplicateMatches, type DuplicateMatch } from '@/features/finance/components/action-dialog'
import { ChoiceCards, FormErrorSummary, FormFooter, SelectField } from '@/features/finance/components/form-parts'
import { MoneyInput } from '@/features/finance/components/money-input'
import { useMoney } from '@/features/finance/hooks/use-money'
import { emptyIncome, incomeSchema, type IncomeDraft, type IncomeValues } from '@/features/finance/lib/finance-schemas'
import { type financeFormLoader } from '@/features/finance/finance.loaders'
import { useFormat } from '@/hooks/use-format'
import { PAYMENT_METHODS, RECURRING_CATEGORIES } from '@/types'

const FIELD_MAP: Record<string, keyof IncomeDraft> = {
  leaseId: 'leaseId',
  propertyId: 'propertyId',
  unitId: 'unitId',
  payerName: 'payerName',
  category: 'category',
  description: 'description',
  amountCents: 'amount',
  dueDate: 'dueDate',
  receivedOn: 'receivedOn',
  method: 'method',
  startPeriod: 'startPeriod',
  endPeriod: 'endPeriod',
}

export function IncomeCreatePage() {
  const { month: formatMonth } = useFormat()
  const options = useLoaderData<typeof financeFormLoader>()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const money = useMoney()
  const presetLease = options.leases.find((lease) => lease.id === params.get('leaseId'))
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, submitCount },
  } = useForm<IncomeDraft, unknown, IncomeValues>({
    resolver: zodResolver(incomeSchema),
    defaultValues: emptyIncome({ propertyId: presetLease?.propertyId ?? params.get('propertyId') ?? '', leaseId: presetLease?.id ?? '' }),
    mode: 'onTouched',
  })
  const [payer, propertyId, repeat, received, amount] = useWatch({ control, name: ['payer', 'propertyId', 'repeat', 'received', 'amount'] })
  const [rootError, setRootError] = useState<{ message: string; matches?: DuplicateMatch[] } | null>(null)
  const [pending, setPending] = useState<{ values: IncomeValues; message: string; matches: DuplicateMatch[] } | null>(null)
  const leases = options.leases.filter((lease) => lease.propertyId === propertyId)
  const property = options.properties.find((entry) => entry.id === propertyId)
  const cents = parseMoneyInput(amount)

  const save = async (values: IncomeValues, acknowledgeDuplicate: boolean) => {
    const amountCents = parseMoneyInput(values.amount) ?? 0
    if (values.repeat) {
      await createRecurringCharge({
        leaseId: values.leaseId,
        category: values.category,
        description: values.description,
        amountCents,
        startPeriod: values.startPeriod,
        ...(values.endPeriod ? { endPeriod: values.endPeriod } : {}),
      })
      toast.success('Recurring charge set up', { description: `${money(amountCents)} a month from ${formatMonth(values.startPeriod, 'long')}.` })
      await navigate(`/finance/transactions?q=${encodeURIComponent(values.description)}&range=all`)
      return
    }
    const charge = await createCharge(
      {
        ...(values.payer === 'tenant' ? { leaseId: values.leaseId } : { propertyId: values.propertyId, payerName: values.payerName, ...(values.unitId ? { unitId: values.unitId } : {}) }),
        category: values.category,
        description: values.description,
        amountCents,
        dueDate: values.dueDate,
      },
      { acknowledgeDuplicate, ...(values.received ? { receivedNow: { receivedOn: values.receivedOn, method: values.method, externalRef: values.externalRef } } : {}) },
    )
    toast.success(`${charge.reference} added`, { description: values.received ? 'Recorded as received.' : `${money(amountCents)} due ${values.dueDate}.` })
    await navigate(`/finance/transactions/${charge.id}`)
  }

  const onSubmit = handleSubmit(async (values) => {
    setRootError(null)
    try {
      await save(values, false)
    } catch (error) {
      if (isFinanceDuplicateError(error) && error.requiresConfirmation) return setPending({ values, message: error.message, matches: error.matches })
      const field = isServiceError(error) && error.field ? FIELD_MAP[error.field] : undefined
      if (field) setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
      else setRootError({ message: error instanceof Error ? error.message : 'Something went wrong. Try again.', ...(isFinanceDuplicateError(error) ? { matches: error.matches } : {}) })
    }
  })

  const errorCount = Object.keys(errors).length
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to="/finance/transactions" label="Transactions" />
        <PageHeader title="Add income" description="Bill a tenant or record other income. Rent is billed from leases automatically; late fees are added from an overdue rent charge." />
      </div>
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-6">
        {rootError ? (
          <div className="flex flex-col gap-2">
            <FormErrorSummary message={rootError.message} />
            {rootError.matches ? <DuplicateMatches matches={rootError.matches} /> : null}
          </div>
        ) : submitCount > 0 && errorCount > 0 ? (
          <FormErrorSummary message={`Please fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'} before saving.`} />
        ) : null}

        <FormSection title="Payer" description="A tenant on a lease, or anyone else (for example a laundry operator).">
          <Controller
            control={control}
            name="payer"
            render={({ field }) => (
              <ChoiceCards
                legend="Who pays"
                name="income-payer"
                value={field.value}
                onChange={(value) => {
                  field.onChange(value)
                  if (value === 'other') setValue('repeat', false)
                }}
                options={[
                  { value: 'tenant', title: 'Tenant', note: 'Billed to a lease; shows on the tenant’s payments.' },
                  { value: 'other', title: 'Other payer', note: 'Property income not tied to a lease.' },
                ]}
              />
            )}
          />
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
                  setValue('leaseId', '')
                  setValue('unitId', '')
                }}
                options={options.properties.map((entry) => ({ value: entry.id, label: entry.name }))}
                placeholder="Choose a property"
                error={errors.propertyId?.message}
              />
            )}
          />
          {payer === 'tenant' ? (
            <Controller
              control={control}
              name="leaseId"
              render={({ field }) => (
                <SelectField
                  label="Tenant"
                  required
                  value={field.value}
                  onChange={field.onChange}
                  disabled={!propertyId}
                  options={leases.map((lease) => ({ value: lease.id, label: `${lease.tenantName} · ${lease.unitLabel}${lease.current ? '' : ` (${lease.status})`}` }))}
                  placeholder={propertyId ? 'Choose the tenant' : 'Choose a property first'}
                  error={errors.leaseId?.message}
                />
              )}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Payer name" required error={errors.payerName?.message}>
                {(field) => <Input {...field} {...register('payerName')} placeholder="e.g. Brightwash Laundry Services" />}
              </FormField>
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
                    placeholder="Optional"
                    hint="Optional."
                  />
                )}
              />
            </div>
          )}
        </FormSection>

        <FormSection title="Charge" description="What is owed and when.">
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
                  options={RECURRING_CATEGORIES.map((category) => ({ value: category, label: INCOME_CATEGORY_LABELS[category] }))}
                  placeholder="Choose a category"
                  error={errors.category?.message}
                />
              )}
            />
            <FormField label="Amount" required error={errors.amount?.message}>
              {(field) => <MoneyInput {...field} {...register('amount')} placeholder="0.00" />}
            </FormField>
          </div>
          <FormField label="Description" error={errors.description?.message} hint={repeat ? 'Required for recurring charges.' : 'Optional.'}>
            {(field) => <Textarea {...field} {...register('description')} rows={2} placeholder="e.g. Reserved parking space B12" />}
          </FormField>
          {payer === 'tenant' ? (
            <label className="flex cursor-pointer items-center gap-3 text-body text-foreground">
              <Controller
                control={control}
                name="repeat"
                render={({ field }) => (
                  <Switch
                    checked={field.value}
                    onCheckedChange={(checked) => {
                      field.onChange(checked)
                      if (checked) setValue('received', false)
                    }}
                  />
                )}
              />
              Repeat every month
            </label>
          ) : null}
          {repeat ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="First month" required error={errors.startPeriod?.message} hint="Billed on the lease’s rent due day.">
                {(field) => <Input {...field} {...register('startPeriod')} type="month" />}
              </FormField>
              <FormField label="Last month" error={errors.endPeriod?.message} hint="Optional. It also stops when the lease ends.">
                {(field) => <Input {...field} {...register('endPeriod')} type="month" />}
              </FormField>
            </div>
          ) : (
            <FormField label="Due date" required error={errors.dueDate?.message}>
              {(field) => <Input {...field} {...register('dueDate')} type="date" className="sm:max-w-60" />}
            </FormField>
          )}
        </FormSection>

        {repeat ? null : (
          <FormSection title="Payment" description="Record the money now if it has already been received.">
            <label className="flex cursor-pointer items-center gap-3 text-body text-foreground">
              <Controller control={control} name="received" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
              Already received{cents ? ` (${money(cents)} in full)` : ''}
            </label>
            {received ? (
              <div className="grid gap-5 sm:grid-cols-3">
                <FormField label="Received on" required error={errors.receivedOn?.message}>
                  {(field) => <Input {...field} {...register('receivedOn')} type="date" />}
                </FormField>
                <Controller
                  control={control}
                  name="method"
                  render={({ field }) => (
                    <SelectField label="Method" required value={field.value} onChange={field.onChange} options={PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] }))} placeholder="Method" />
                  )}
                />
                <FormField label="Reference" hint="Optional.">
                  {(field) => <Input {...field} {...register('externalRef')} />}
                </FormField>
              </div>
            ) : null}
          </FormSection>
        )}

        <FormFooter cancelHref="/finance/transactions" submitLabel={repeat ? 'Set up recurring charge' : 'Add income'} submitting={isSubmitting} />
      </form>

      {pending ? (
        <ActionDialog
          title="Possible duplicate"
          description={`${pending.message} Check it isn’t the same charge before saving.`}
          submitLabel="Save anyway"
          onClose={() => setPending(null)}
          onSubmit={async () => {
            await save(pending.values, true)
            setPending(null)
          }}
        >
          <DuplicateMatches matches={pending.matches} />
        </ActionDialog>
      ) : null}
    </PageContainer>
  )
}
