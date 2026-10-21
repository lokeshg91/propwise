import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, CircleAlert, Home, LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, type FieldErrors, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { US_STATES } from '@/data/reference/us-states'
import { isServiceError } from '@/data/services'
import {
  PROPERTY_STATUS_DESCRIPTIONS,
  PROPERTY_STATUS_LABELS,
  PROPERTY_TYPE_DESCRIPTIONS,
  PROPERTY_TYPE_LABELS,
} from '@/features/properties/lib/property-meta'
import {
  createPropertySchema,
  MAX_TOTAL_UNITS,
  type PropertyFormDraft,
  type PropertyFormValues,
} from '@/features/properties/lib/property-schema'
import { toNullableNumber } from '@/lib/form-schema'
import { cn } from '@/lib/utils'
import { PROPERTY_STATUSES, PROPERTY_TYPES } from '@/types'

const TYPE_ICONS = { residential: Home, commercial: Building2 } as const
const DESCRIPTION_LIMIT = 500

interface PropertyFormProps {
  defaultValues: PropertyFormDraft
  /** Units already added to the property (edit mode). */
  minTotalUnits?: number
  submitLabel: string
  cancelHref: string
  onSubmit: (values: PropertyFormValues) => Promise<void>
}

export function PropertyForm({ defaultValues, minTotalUnits = 0, submitLabel, cancelHref, onSubmit }: PropertyFormProps) {
  const schema = useMemo(() => createPropertySchema({ minTotalUnits }), [minTotalUnits])
  const form = useForm<PropertyFormDraft, unknown, PropertyFormValues>({
    resolver: zodResolver(schema),
    defaultValues,
    mode: 'onTouched',
  })
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting, isDirty, submitCount },
  } = form

  const description = useWatch({ control, name: 'description' })
  const errorCount = Object.keys(errors).filter((key) => key !== 'root').length

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit(values)
    } catch (error) {
      if (isServiceError(error) && error.field && error.field in values) {
        setError(error.field as keyof PropertyFormValues, { message: error.message }, { shouldFocus: true })
      } else {
        setError('root', { message: error instanceof Error ? error.message : 'Something went wrong. Try again.' })
      }
    }
  })

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6">
      {submitCount > 0 && (errorCount > 0 || errors.root) ? (
        <ErrorSummary errors={errors} count={errorCount} />
      ) : null}

      <FormSection title="Basic information" description="How the property appears across Propwise.">
        <FormField label="Property name" required error={errors.name?.message}>
          {(field) => <Input {...field} {...register('name')} placeholder="e.g. Juniper Commons" autoComplete="off" />}
        </FormField>

        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-label text-foreground">
                Property type
                <span className="ml-2 text-danger" aria-hidden="true">
                  *
                </span>
              </legend>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                aria-label="Property type"
                className="grid gap-3 sm:grid-cols-2"
              >
                {PROPERTY_TYPES.map((type) => {
                  const Icon = TYPE_ICONS[type]
                  const id = `property-type-${type}`
                  return (
                    <label
                      key={type}
                      htmlFor={id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50',
                        field.value === type && 'border-primary bg-accent/50 ring-1 ring-primary',
                      )}
                    >
                      <RadioGroupItem id={id} value={type} className="mt-0.5" />
                      <span className="flex flex-1 flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-body font-medium text-foreground">
                          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                          {PROPERTY_TYPE_LABELS[type]}
                        </span>
                        <span className="text-caption text-muted-foreground">{PROPERTY_TYPE_DESCRIPTIONS[type]}</span>
                      </span>
                    </label>
                  )
                })}
              </RadioGroup>
            </fieldset>
          )}
        />

        <Controller
          control={control}
          name="status"
          render={({ field, fieldState }) => (
            <FormField label="Status" required error={fieldState.error?.message} hint={PROPERTY_STATUS_DESCRIPTIONS[field.value]}>
              {(aria) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full sm:w-72">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROPERTY_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {PROPERTY_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
      </FormSection>

      <FormSection title="Location" description="The property's street address.">
        <FormField label="Street address" required error={errors.street?.message}>
          {(field) => <Input {...field} {...register('street')} placeholder="e.g. 18 Juniper Way" autoComplete="street-address" />}
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
            {(field) => (
              <Input {...field} {...register('postalCode')} inputMode="numeric" autoComplete="postal-code" placeholder="e.g. 78704" />
            )}
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Size and details" description="Unit-level details can be added from the Units tab later.">
        <div className="grid gap-5 sm:grid-cols-3">
          <FormField
            label="Total units"
            required
            error={errors.totalUnits?.message}
            hint={minTotalUnits > 0 ? `At least ${minTotalUnits} (units already added)` : 'Apartments or leasable suites'}
          >
            {(field) => (
              <Input
                {...field}
                {...register('totalUnits', { setValueAs: toNullableNumber })}
                type="number"
                inputMode="numeric"
                min={Math.max(1, minTotalUnits)}
                max={MAX_TOTAL_UNITS}
              />
            )}
          </FormField>
          <FormField label="Year built" error={errors.yearBuilt?.message} hint="Optional">
            {(field) => (
              <Input {...field} {...register('yearBuilt', { setValueAs: toNullableNumber })} type="number" inputMode="numeric" placeholder="2015" />
            )}
          </FormField>
          <FormField label="Building area (sq ft)" error={errors.areaSqft?.message} hint="Optional">
            {(field) => (
              <Input {...field} {...register('areaSqft', { setValueAs: toNullableNumber })} type="number" inputMode="numeric" placeholder="45000" />
            )}
          </FormField>
        </div>
        <FormField
          label="Description"
          error={errors.description?.message}
          hint="Amenities, location highlights or notes for your team."
          labelAside={
            <span
              className={cn(
                'text-caption tabular-nums',
                description.length > DESCRIPTION_LIMIT ? 'text-danger' : 'text-muted-foreground',
              )}
              aria-live="polite"
            >
              {description.length}/{DESCRIPTION_LIMIT}
            </span>
          }
        >
          {(field) => <Textarea {...field} {...register('description')} rows={4} />}
        </FormField>
      </FormSection>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 lg:-mx-8 lg:px-8">
        <Button variant="outline" size="lg" asChild>
          <Link to={cancelHref}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting || (!isDirty && minTotalUnits > 0)}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          {isSubmitting ? 'Saving…' : submitLabel}
        </Button>
      </div>
    </form>
  )
}

function ErrorSummary({ errors, count }: { errors: FieldErrors<PropertyFormDraft>; count: number }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="text-body">
        <p className="font-medium">
          {errors.root?.message ?? `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before saving.`}
        </p>
      </div>
    </div>
  )
}
