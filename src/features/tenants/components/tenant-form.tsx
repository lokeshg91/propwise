import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CircleAlert, LoaderCircle, UserRound } from 'lucide-react'
import { type ComponentProps, useMemo } from 'react'
import { Controller, type FieldErrors, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { addDays, addMonths, todayIso } from '@/data/domain/dates'
import { US_STATES } from '@/data/reference/us-states'
import { type AssignableProperty, isServiceError, MAX_DEPOSIT_MULTIPLE } from '@/data/services'
import { UNIT_TYPE_LABELS } from '@/features/properties/lib/property-meta'
import { TENANT_KIND_LABELS, unitPrefixFor } from '@/features/tenants/lib/tenant-meta'
import {
  createTenantSchema,
  SERVICE_FIELD_MAP,
  type TenantFormDraft,
  type TenantFormValues,
} from '@/features/tenants/lib/tenant-schema'
import { useFormat } from '@/hooks/use-format'
import { toNullableNumber } from '@/lib/form-schema'
import { cn } from '@/lib/utils'
import { TENANT_KINDS } from '@/types'

const KIND_ICONS = { individual: UserRound, business: Building2 } as const
const NOTES_LIMIT = 500

export type TenantFormMode =
  /** New tenant: a lease is required. */
  | { kind: 'create' }
  /** Existing tenant with an active or pending lease. */
  | { kind: 'edit-current'; leaseStatus: 'active' | 'pending' }
  /** Past tenant: a new lease is optional. */
  | { kind: 'edit-past' }

interface TenantFormProps {
  mode: TenantFormMode
  defaultValues: TenantFormDraft
  assignable: AssignableProperty[]
  submitLabel: string
  cancelHref: string
  onSubmit: (values: TenantFormValues) => Promise<void>
}

export function TenantForm({ mode, defaultValues, assignable, submitLabel, cancelHref, onSubmit }: TenantFormProps) {
  const { amount: formatCurrency } = useFormat()
  const schema = useMemo(() => createTenantSchema({ requireLease: mode.kind !== 'edit-past' }), [mode.kind])
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    getValues,
    formState: { errors, isSubmitting, isDirty, submitCount, dirtyFields },
  } = useForm<TenantFormDraft, unknown, TenantFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  })

  const [kind, hasEmergencyContact, assignLease, propertyId, unitId, leaseStatus, notes] = useWatch({
    control,
    name: ['kind', 'hasEmergencyContact', 'assignLease', 'propertyId', 'unitId', 'leaseStatus', 'notes'],
  })
  const property = assignable.find((entry) => entry.id === propertyId)
  const unit = property?.units.find((entry) => entry.id === unitId)
  const errorCount = Object.keys(errors).filter((key) => key !== 'root').length
  const isEdit = mode.kind !== 'create'
  const lockedActive = mode.kind === 'edit-current' && mode.leaseStatus === 'active'
  const leaseOpen = mode.kind !== 'edit-past' || assignLease

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (error) {
      const field = isServiceError(error) && error.field ? SERVICE_FIELD_MAP[error.field] : undefined
      if (field) setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
      else setError('root', { message: error instanceof Error ? error.message : 'Something went wrong. Try again.' })
    }
  })

  const selectUnit = (nextUnitId: string) => {
    setValue('unitId', nextUnitId, { shouldDirty: true, shouldValidate: submitCount > 0 })
    const next = property?.units.find((entry) => entry.id === nextUnitId)
    // Prefill rent and deposit from the unit's asking rent unless the user typed their own.
    if (next && (!dirtyFields.monthlyRent || getValues('monthlyRent') === null)) {
      setValue('monthlyRent', next.rent, { shouldDirty: true })
      if (!dirtyFields.securityDeposit) setValue('securityDeposit', next.rent, { shouldDirty: true })
    }
  }

  const selectLeaseStatus = (next: 'active' | 'pending') => {
    setValue('leaseStatus', next, { shouldDirty: true })
    const today = todayIso()
    const start = getValues('startDate')
    // Move the dates to a sensible default for the new status.
    if (next === 'pending' && (!start || start <= today)) {
      const nextStart = addDays(today, 14)
      setValue('startDate', nextStart, { shouldDirty: true })
      setValue('endDate', addDays(addMonths(nextStart, 12), -1), { shouldDirty: true })
    } else if (next === 'active' && start > today) {
      setValue('startDate', today, { shouldDirty: true })
      setValue('endDate', addDays(addMonths(today, 12), -1), { shouldDirty: true })
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6">
      {submitCount > 0 && (errorCount > 0 || errors.root) ? <ErrorSummary errors={errors} count={errorCount} /> : null}

      <FormSection title="Tenant details" description="Who is renting and how to reach them.">
        <Controller
          control={control}
          name="kind"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-label text-foreground">Tenant type</legend>
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Tenant type" className="grid gap-3 sm:grid-cols-2">
                {TENANT_KINDS.map((value) => {
                  const Icon = KIND_ICONS[value]
                  const id = `tenant-kind-${value}`
                  return (
                    <label
                      key={value}
                      htmlFor={id}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-body font-medium text-foreground transition-colors hover:bg-muted/50',
                        field.value === value && 'border-primary bg-accent/50 ring-1 ring-primary',
                      )}
                    >
                      <RadioGroupItem id={id} value={value} />
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {TENANT_KIND_LABELS[value]}
                    </label>
                  )
                })}
              </RadioGroup>
            </fieldset>
          )}
        />
        <FormField label={kind === 'business' ? 'Business name' : 'Full name'} required error={errors.name?.message}>
          {(field) => (
            <Input
              {...field}
              {...register('name')}
              placeholder={kind === 'business' ? 'e.g. Kestrel Labs' : 'e.g. Leah Novak'}
              autoComplete={kind === 'business' ? 'organization' : 'name'}
            />
          )}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Email" required error={errors.email?.message}>
            {(field) => <Input {...field} {...register('email')} type="email" autoComplete="email" placeholder="name@example.com" />}
          </FormField>
          <FormField label="Phone" required error={errors.phone?.message}>
            {(field) => <Input {...field} {...register('phone')} type="tel" autoComplete="tel" placeholder="(512) 555-0134" />}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Mailing address" description="Where notices and statements are sent.">
        <FormField label="Street address" required error={errors.street?.message}>
          {(field) => <Input {...field} {...register('street')} autoComplete="street-address" placeholder="e.g. 410 Harbor Way, Unit 204" />}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-[1fr_12rem_10rem]">
          <FormField label="City" required error={errors.city?.message}>
            {(field) => <Input {...field} {...register('city')} autoComplete="address-level2" />}
          </FormField>
          <Controller
            control={control}
            name="state"
            render={({ field, fieldState }) => (
              <FormField label="State" required error={fieldState.error?.message}>
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {US_STATES.map((state) => (
                        <SelectItem key={state.code} value={state.code}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />
          <FormField label="ZIP code" required error={errors.postalCode?.message}>
            {(field) => <Input {...field} {...register('postalCode')} inputMode="numeric" autoComplete="postal-code" placeholder="e.g. 78704" />}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Emergency contact" description="Optional. Someone to call if the tenant can’t be reached.">
        <Controller
          control={control}
          name="hasEmergencyContact"
          render={({ field }) => (
            <label className="flex w-fit cursor-pointer items-center gap-3 text-body font-medium text-foreground">
              <Switch checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
              Add an emergency contact
            </label>
          )}
        />
        {hasEmergencyContact ? (
          <div className="grid gap-5 sm:grid-cols-3">
            <FormField label="Contact name" required error={errors.emergencyName?.message}>
              {(field) => <Input {...field} {...register('emergencyName')} autoComplete="off" />}
            </FormField>
            <FormField label="Contact phone" required error={errors.emergencyPhone?.message}>
              {(field) => <Input {...field} {...register('emergencyPhone')} type="tel" autoComplete="off" />}
            </FormField>
            <FormField label="Relationship" required error={errors.emergencyRelationship?.message}>
              {(field) => <Input {...field} {...register('emergencyRelationship')} placeholder="e.g. Parent" autoComplete="off" />}
            </FormField>
          </div>
        ) : null}
      </FormSection>

      <FormSection
        title="Lease and unit"
        description={
          mode.kind === 'edit-past'
            ? 'This tenant has no current lease. Start a new one to move them into a unit.'
            : 'Only vacant units without another active or pending lease are listed.'
        }
      >
        {mode.kind === 'edit-past' ? (
          <Controller
            control={control}
            name="assignLease"
            render={({ field }) => (
              <label className="flex w-fit cursor-pointer items-center gap-3 text-body font-medium text-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
                Start a new lease
              </label>
            )}
          />
        ) : null}

        {leaseOpen ? (
          <>
            {assignable.length === 0 ? (
              <p role="status" className="rounded-lg border border-warning/30 bg-warning/10 px-3 py-2.5 text-body text-warning dark:bg-warning/15">
                No units are available right now. Vacate a unit or add units to a property first.
              </p>
            ) : null}
            <div className="grid gap-5 sm:grid-cols-2">
              <Controller
                control={control}
                name="propertyId"
                render={({ field, fieldState }) => (
                  <FormField label="Property" required error={fieldState.error?.message}>
                    {(aria) => (
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value)
                          setValue('unitId', '', { shouldDirty: true })
                        }}
                      >
                        <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue placeholder="Select property" />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {assignable.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {entry.name}
                              <span className="text-muted-foreground"> · {entry.units.length} available</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />
              <Controller
                control={control}
                name="unitId"
                render={({ field, fieldState }) => (
                  <FormField
                    label="Unit"
                    required
                    error={fieldState.error?.message}
                    hint={unit ? `${UNIT_TYPE_LABELS[unit.type]} · Floor ${unit.floor} · asking ${formatCurrency(unit.rent)}/mo` : undefined}
                  >
                    {(aria) => (
                      <Select value={field.value} onValueChange={selectUnit} disabled={!property}>
                        <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                          <SelectValue placeholder={property ? 'Select unit' : 'Choose a property first'} />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {property?.units.map((entry) => (
                            <SelectItem key={entry.id} value={entry.id}>
                              {unitPrefixFor(property.type)} {entry.number}
                              <span className="text-muted-foreground"> · {UNIT_TYPE_LABELS[entry.type]}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />
            </div>

            <Controller
              control={control}
              name="leaseStatus"
              render={({ field }) => (
                <fieldset>
                  <legend className="mb-2 text-label text-foreground">Move-in</legend>
                  <RadioGroup value={field.value} onValueChange={(value) => selectLeaseStatus(value === 'pending' ? 'pending' : 'active')} aria-label="Move-in" className="grid gap-3 sm:grid-cols-2">
                    {(
                      [
                        { value: 'active', title: 'Moved in', description: 'The lease has started and the unit is occupied.' },
                        { value: 'pending', title: 'Future move-in', description: 'Signed lease; the unit is reserved until move-in.' },
                      ] as const
                    ).map((option) => {
                      const id = `lease-status-${option.value}`
                      const disabled = option.value === 'pending' && lockedActive
                      return (
                        <label
                          key={option.value}
                          htmlFor={id}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50',
                            field.value === option.value && 'border-primary bg-accent/50 ring-1 ring-primary',
                            disabled && 'cursor-not-allowed opacity-60 hover:bg-card',
                          )}
                        >
                          <RadioGroupItem id={id} value={option.value} disabled={disabled} className="mt-0.5" />
                          <span className="flex flex-col gap-0.5">
                            <span className="text-body font-medium text-foreground">{option.title}</span>
                            <span className="text-caption text-muted-foreground">
                              {disabled ? 'Not available once the tenant has moved in.' : option.description}
                            </span>
                          </span>
                        </label>
                      )
                    })}
                  </RadioGroup>
                </fieldset>
              )}
            />

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Lease start" required error={errors.startDate?.message} hint={leaseStatus === 'pending' ? 'Move-in date' : undefined}>
                {(field) => <Input {...field} {...register('startDate')} type="date" />}
              </FormField>
              <FormField label="Lease end" required error={errors.endDate?.message}>
                {(field) => <Input {...field} {...register('endDate')} type="date" />}
              </FormField>
            </div>
            <div className="grid gap-5 sm:grid-cols-3">
              <FormField label="Monthly rent" required error={errors.monthlyRent?.message}>
                {(field) => <CurrencyInput {...field} {...register('monthlyRent', { setValueAs: toNullableNumber })} />}
              </FormField>
              <FormField
                label="Security deposit"
                required
                error={errors.securityDeposit?.message}
                hint={`Up to ${MAX_DEPOSIT_MULTIPLE}× monthly rent`}
              >
                {(field) => <CurrencyInput {...field} {...register('securityDeposit', { setValueAs: toNullableNumber })} />}
              </FormField>
              <FormField label="Rent due day" required error={errors.paymentDueDay?.message} hint="Day of the month (1–28)">
                {(field) => (
                  <Input {...field} {...register('paymentDueDay', { setValueAs: toNullableNumber })} type="number" inputMode="numeric" min={1} max={28} />
                )}
              </FormField>
            </div>
          </>
        ) : null}
      </FormSection>

      <FormSection title="Notes" description="Internal notes for your team. Not shared with the tenant.">
        <FormField
          label="Notes"
          error={errors.notes?.message}
          labelAside={
            <span className={cn('text-caption tabular-nums', notes.length > NOTES_LIMIT ? 'text-danger' : 'text-muted-foreground')} aria-live="polite">
              {notes.length}/{NOTES_LIMIT}
            </span>
          }
        >
          {(field) => <Textarea {...field} {...register('notes')} rows={3} />}
        </FormField>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="outline" size="lg" asChild>
          <Link to={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || (isEdit && !isDirty)}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function CurrencyInput(props: ComponentProps<typeof Input>) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground" aria-hidden="true">
        $
      </span>
      <Input {...props} type="number" inputMode="decimal" min={0} step="any" className="pl-7" />
    </div>
  )
}

function ErrorSummary({ errors, count }: { errors: FieldErrors<TenantFormDraft>; count: number }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-body font-medium">
        {errors.root?.message ?? `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before saving.`}
      </p>
    </div>
  )
}
