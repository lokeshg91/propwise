import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, Info, LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
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
import { SLA_HOURS } from '@/data/domain/maintenance-rules'
import { isServiceError, type RequestFormOptions } from '@/data/services'
import { UNIT_STATUS_LABELS } from '@/features/properties/lib/property-meta'
import { PRIORITY_LABELS } from '@/features/maintenance/lib/maintenance-meta'
import { CATEGORY_LABELS, SOURCE_LABELS } from '@/features/maintenance/lib/request-meta'
import {
  createRequestSchema,
  DESCRIPTION_LIMIT,
  REQUEST_FIELD_MAP,
  type RequestFormDraft,
  type RequestFormValues,
} from '@/features/maintenance/lib/request-schema'
import { defaultVisitTime, formatDuration } from '@/features/maintenance/lib/request-time'
import { CurrencyInput } from '@/features/maintenance/components/currency-input'
import { VendorSelect } from '@/features/maintenance/components/vendor-select'
import { toNullableNumber } from '@/lib/form-schema'
import { cn } from '@/lib/utils'
import { MAINTENANCE_PRIORITIES, REQUEST_CATEGORIES, REQUEST_SOURCES } from '@/types'

export type RequestFormMode =
  | { kind: 'create' }
  /** Location can't change once a vendor was assigned or the unit was taken offline. */
  | { kind: 'edit'; locationLocked: boolean }

interface RequestFormProps {
  mode: RequestFormMode
  options: RequestFormOptions
  defaultValues: RequestFormDraft
  submitLabel: string
  cancelHref: string
  onSubmit: (values: RequestFormValues) => Promise<void>
}

export function RequestForm({ mode, options, defaultValues, submitLabel, cancelHref, onSubmit }: RequestFormProps) {
  const units = useMemo(() => options.properties.flatMap((property) => property.units), [options])
  const schema = useMemo(
    () =>
      createRequestSchema({
        vendors: options.vendors,
        canTakeOffline: (unitId) => units.find((unit) => unit.id === unitId)?.offlineBlockedReason === null,
      }),
    [options.vendors, units],
  )
  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting, isDirty, submitCount },
  } = useForm<RequestFormDraft, unknown, RequestFormValues>({ resolver: zodResolver(schema), defaultValues, mode: 'onTouched' })

  const [propertyId, locationType, unitId, source, priority, category, assignNow, description, takeUnitOffline] = useWatch({
    control,
    name: ['propertyId', 'locationType', 'unitId', 'source', 'priority', 'category', 'assignNow', 'description', 'takeUnitOffline'],
  })
  const property = options.properties.find((entry) => entry.id === propertyId)
  const unit = property?.units.find((entry) => entry.id === unitId)
  const prefix = property?.type === 'commercial' ? 'Suite' : 'Unit'
  const isEdit = mode.kind === 'edit'
  const locationLocked = mode.kind === 'edit' && mode.locationLocked
  const errorCount = Object.keys(errors).filter((key) => key !== 'root').length

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (error) {
      const field = isServiceError(error) && error.field ? REQUEST_FIELD_MAP[error.field] : undefined
      if (field) setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
      else setError('root', { message: error instanceof Error ? error.message : 'Something went wrong. Try again.' })
    }
  })

  const resetUnitDependants = () => {
    setValue('tenantId', '', { shouldDirty: true })
    setValue('takeUnitOffline', false, { shouldDirty: true })
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6">
      {submitCount > 0 && (errorCount > 0 || errors.root) ? <ErrorSummary errors={errors} count={errorCount} /> : null}

      <FormSection title="Issue" description="What needs fixing and how urgent it is.">
        <FormField label="Title" required error={errors.title?.message}>
          {(field) => <Input {...field} {...register('title')} placeholder="e.g. Leaking kitchen faucet" autoComplete="off" />}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <Controller
            control={control}
            name="category"
            render={({ field, fieldState }) => (
              <FormField label="Category" required error={fieldState.error?.message}>
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {REQUEST_CATEGORIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {CATEGORY_LABELS[value]}
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
            name="priority"
            render={({ field, fieldState }) => (
              <FormField
                label="Priority"
                required
                error={fieldState.error?.message}
                hint={`Resolve within ${formatDuration(SLA_HOURS[priority])}${isEdit ? ' of the request date' : ''}`}
              >
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[...MAINTENANCE_PRIORITIES].reverse().map((value) => (
                        <SelectItem key={value} value={value}>
                          {PRIORITY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />
        </div>
        <FormField
          label="Description"
          error={errors.description?.message}
          hint="What happened, where exactly, and anything the vendor should know."
          labelAside={
            <span className={cn('text-caption tabular-nums', description.length > DESCRIPTION_LIMIT ? 'text-danger' : 'text-muted-foreground')} aria-live="polite">
              {description.length}/{DESCRIPTION_LIMIT}
            </span>
          }
        >
          {(field) => <Textarea {...field} {...register('description')} rows={4} />}
        </FormField>
      </FormSection>

      <FormSection
        title="Location"
        description={locationLocked ? 'Locked because a vendor was assigned or the unit was taken offline.' : 'A unit, or a common area such as a lobby or parking lot.'}
      >
        <Controller
          control={control}
          name="propertyId"
          render={({ field, fieldState }) => (
            <FormField label="Property" required error={fieldState.error?.message}>
              {(aria) => (
                <Select
                  value={field.value}
                  disabled={locationLocked}
                  onValueChange={(value) => {
                    field.onChange(value)
                    setValue('unitId', '', { shouldDirty: true })
                    resetUnitDependants()
                  }}
                >
                  <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full sm:w-96">
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {options.properties.map((entry) => (
                      <SelectItem key={entry.id} value={entry.id}>
                        {entry.name}
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
          name="locationType"
          render={({ field }) => (
            <fieldset disabled={locationLocked}>
              <legend className="mb-2 text-label text-foreground">Where</legend>
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  resetUnitDependants()
                  if (value === 'area') setValue('source', source === 'tenant' ? 'staff' : source, { shouldDirty: true })
                }}
                aria-label="Where"
                className="grid gap-3 sm:grid-cols-2"
              >
                {(
                  [
                    { value: 'unit', label: `A ${prefix.toLowerCase()}` },
                    { value: 'area', label: 'A common area' },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`location-${option.value}`}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-body font-medium text-foreground transition-colors hover:bg-muted/50',
                      field.value === option.value && 'border-primary bg-accent/50 ring-1 ring-primary',
                      locationLocked && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <RadioGroupItem id={`location-${option.value}`} value={option.value} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </fieldset>
          )}
        />
        {locationType === 'unit' ? (
          <Controller
            control={control}
            name="unitId"
            render={({ field, fieldState }) => (
              <FormField
                label={prefix}
                required
                error={fieldState.error?.message}
                hint={unit ? `Currently ${UNIT_STATUS_LABELS[unit.status].toLowerCase()}` : undefined}
              >
                {(aria) => (
                  <Select
                    value={field.value}
                    disabled={!property || locationLocked}
                    onValueChange={(value) => {
                      field.onChange(value)
                      resetUnitDependants()
                      // Suggest the current tenant when a tenant reported it.
                      const next = property?.units.find((entry) => entry.id === value)
                      const current = next?.tenants.find((tenant) => tenant.current)
                      if (source === 'tenant' && current) setValue('tenantId', current.id, { shouldDirty: true })
                    }}
                  >
                    <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full sm:w-96">
                      <SelectValue placeholder={property ? `Select ${prefix.toLowerCase()}` : 'Choose a property first'} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {property?.units.map((entry) => (
                        <SelectItem key={entry.id} value={entry.id}>
                          {prefix} {entry.number}
                          <span className="text-muted-foreground"> · {UNIT_STATUS_LABELS[entry.status]}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />
        ) : (
          <FormField label="Area" required error={errors.area?.message}>
            {(field) => <Input {...field} {...register('area')} disabled={locationLocked} placeholder="e.g. Lobby, Parking garage, Roof" className="sm:w-96" />}
          </FormField>
        )}

        {!isEdit && locationType === 'unit' && unit ? (
          <Controller
            control={control}
            name="takeUnitOffline"
            render={({ field, fieldState }) => {
              const blocked = unit.offlineBlockedReason
              return (
                <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/40 p-4">
                  <label className={cn('flex w-fit items-center gap-3 text-body font-medium text-foreground', blocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}>
                    <Switch checked={field.value} onCheckedChange={field.onChange} disabled={blocked !== null} ref={field.ref} aria-describedby="offline-hint" />
                    Take {prefix.toLowerCase()} {unit.number} offline while the work is done
                  </label>
                  <p id="offline-hint" className={cn('text-caption', fieldState.error ? 'text-danger' : 'text-muted-foreground')}>
                    {fieldState.error?.message ??
                      (blocked
                        ? `Not available: ${blocked.replace(/\.$/, '')}. Occupied and reserved units are never changed by maintenance.`
                        : takeUnitOffline
                          ? 'The unit will be marked Under maintenance and can’t be leased until you return it to Vacant.'
                          : 'Optional. Marks the vacant unit as Under maintenance so it isn’t leased meanwhile.')}
                  </p>
                </div>
              )
            }}
          />
        ) : null}
      </FormSection>

      <FormSection title="Reported by" description="Who raised the issue and how to get access.">
        <Controller
          control={control}
          name="source"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-label text-foreground">Source</legend>
              <RadioGroup
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value)
                  if (value !== 'tenant') setValue('tenantId', '', { shouldDirty: true })
                  else {
                    const current = unit?.tenants.find((tenant) => tenant.current)
                    if (current) setValue('tenantId', current.id, { shouldDirty: true })
                  }
                }}
                aria-label="Source"
                className="grid gap-3 sm:grid-cols-3"
              >
                {REQUEST_SOURCES.map((value) => {
                  const disabled = value === 'tenant' && locationType !== 'unit'
                  return (
                    <label
                      key={value}
                      htmlFor={`source-${value}`}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-body font-medium text-foreground transition-colors hover:bg-muted/50',
                        field.value === value && 'border-primary bg-accent/50 ring-1 ring-primary',
                        disabled && 'cursor-not-allowed opacity-60 hover:bg-card',
                      )}
                    >
                      <RadioGroupItem id={`source-${value}`} value={value} disabled={disabled} />
                      {SOURCE_LABELS[value]}
                    </label>
                  )
                })}
              </RadioGroup>
            </fieldset>
          )}
        />
        {source === 'tenant' && locationType === 'unit' ? (
          <Controller
            control={control}
            name="tenantId"
            render={({ field, fieldState }) => (
              <FormField
                label="Tenant"
                required
                error={fieldState.error?.message}
                hint={unit && unit.tenants.length === 0 ? 'Nobody has leased this unit yet.' : 'Tenants who have leased this unit'}
              >
                {(aria) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={!unit || unit.tenants.length === 0}>
                    <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full sm:w-96">
                      <SelectValue placeholder={unit ? 'Select tenant' : 'Choose a unit first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {unit?.tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                          <span className="text-muted-foreground"> · {tenant.current ? 'Current tenant' : 'Past tenant'}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </FormField>
            )}
          />
        ) : null}
        {locationType === 'unit' ? (
          <Controller
            control={control}
            name="permissionToEnter"
            render={({ field }) => (
              <label className="flex w-fit cursor-pointer items-center gap-3 text-body font-medium text-foreground">
                <Switch checked={field.value} onCheckedChange={field.onChange} onBlur={field.onBlur} ref={field.ref} />
                Permission to enter when nobody is home
              </label>
            )}
          />
        ) : null}
        <FormField label="Access notes" error={errors.accessNotes?.message} hint="Optional. Pets, preferred visit times or where to collect keys.">
          {(field) => <Input {...field} {...register('accessNotes')} placeholder="e.g. Call ahead; dog in the unit" autoComplete="off" />}
        </FormField>
      </FormSection>

      {!isEdit ? (
        <FormSection title="Vendor" description="Optional. Assign now to schedule the visit, or later from the request page.">
          <Controller
            control={control}
            name="assignNow"
            render={({ field }) => (
              <label className="flex w-fit cursor-pointer items-center gap-3 text-body font-medium text-foreground">
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked)
                    if (checked) setValue('scheduledFor', defaultVisitTime(), { shouldDirty: true })
                  }}
                  ref={field.ref}
                />
                Assign a vendor now
              </label>
            )}
          />
          {assignNow ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Controller
                control={control}
                name="vendorId"
                render={({ field, fieldState }) => (
                  <FormField label="Vendor" required error={fieldState.error?.message} className="sm:col-span-2 lg:col-span-1">
                    {(aria) => (
                      <VendorSelect
                        vendors={options.vendors}
                        category={category}
                        value={field.value}
                        onValueChange={field.onChange}
                        onBlur={field.onBlur}
                        triggerRef={field.ref}
                        aria={aria}
                      />
                    )}
                  </FormField>
                )}
              />
              <FormField label="Visit" error={errors.scheduledFor?.message} hint="Optional">
                {(field) => <Input {...field} {...register('scheduledFor')} type="datetime-local" />}
              </FormField>
              <FormField label="Estimate" error={errors.estimatedCost?.message} hint="Optional. Not an invoice.">
                {(field) => <CurrencyInput {...field} {...register('estimatedCost', { setValueAs: toNullableNumber })} />}
              </FormField>
            </div>
          ) : null}
        </FormSection>
      ) : (
        <p className="flex items-start gap-2 text-caption text-muted-foreground">
          <Info className="mt-px size-4 shrink-0" aria-hidden="true" />
          Status and vendor are changed from the request page, so every change is recorded in its activity.
        </p>
      )}

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

function ErrorSummary({ errors, count }: { errors: FieldErrors<RequestFormDraft>; count: number }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-body font-medium">
        {errors.root?.message ?? `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before saving.`}
      </p>
    </div>
  )
}
