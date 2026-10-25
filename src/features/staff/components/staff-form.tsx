import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, ExternalLink, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, type FieldErrors, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { ROLE_DESCRIPTIONS, ROLE_LABELS, STAFF_LIMITS } from '@/data/domain/staff-rules'
import { findStaffByEmail, isServiceError, type StaffProperty } from '@/data/services'
import { SelectField } from '@/features/finance/components/form-parts'
import { staffSchema, type StaffFormValues } from '@/features/staff/lib/staff-schema'
import { cn } from '@/lib/utils'
import { STAFF_ROLES, type StaffRole } from '@/types'

const FIELDS = new Set<keyof StaffFormValues>(['name', 'email', 'phone', 'jobTitle', 'role', 'propertyIds'])
const linkClass = 'inline-flex items-center gap-1 rounded-sm font-medium underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50'

interface StaffFormProps {
  /** The member being edited (excluded from the email check), or undefined when adding. */
  staffId?: string
  defaultValues: StaffFormValues
  propertyOptions: StaffProperty[]
  submitLabel: string
  cancelHref: string
  /** Set on your own record: the role can't change, and the contact fields are your profile. */
  isSelf?: boolean
  onSubmit: (values: StaffFormValues) => Promise<void>
}

export function StaffForm({ staffId, defaultValues, propertyOptions, submitLabel, cancelHref, isSelf = false, onSubmit }: StaffFormProps) {
  const isEdit = staffId !== undefined
  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting, isDirty, submitCount },
  } = useForm<StaffFormValues>({ resolver: zodResolver(staffSchema), defaultValues, mode: 'onTouched' })
  const [emailTaken, setEmailTaken] = useState<{ id: string; name: string } | null>(null)
  const role = useWatch({ control, name: 'role' })
  const errorCount = Object.keys(errors).filter((key) => key !== 'root').length

  const checkEmail = async () => {
    const email = getValues('email')
    setEmailTaken(email.trim() ? await findStaffByEmail(email, staffId) : null)
  }

  const submit = handleSubmit(async (values) => {
    if (emailTaken) {
      setError('email', { message: `${emailTaken.name} already uses this email address.` }, { shouldFocus: true })
      return
    }
    try {
      await onSubmit(values)
    } catch (error) {
      const field = isServiceError(error) && error.field && FIELDS.has(error.field as keyof StaffFormValues) ? (error.field as keyof StaffFormValues) : undefined
      const message = error instanceof Error ? error.message : 'Something went wrong. Try again.'
      if (field) setError(field, { message }, { shouldFocus: field !== 'propertyIds' && field !== 'role' })
      else setError('root', { message })
    }
  })

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6">
      {submitCount > 0 && (errorCount > 0 || errors.root) ? <ErrorSummary errors={errors} count={errorCount} /> : null}

      <FormSection title="Person" description={isSelf ? 'This is you. These details are your profile, so the header and the Account page show them too.' : 'How the team member appears in Propwise.'}>
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField label="Full name" required error={errors.name?.message}>
            {(field) => <Input {...field} {...register('name')} autoComplete="off" placeholder="e.g. Sam Rivera" maxLength={STAFF_LIMITS.name + 20} />}
          </FormField>
          <FormField label="Job title" required error={errors.jobTitle?.message}>
            {(field) => <Input {...field} {...register('jobTitle')} autoComplete="off" placeholder="e.g. Property Manager" maxLength={STAFF_LIMITS.jobTitle + 20} />}
          </FormField>
          <FormField label="Email" required error={errors.email?.message} hint="Each team member needs their own email address. Demo: no invitation is sent.">
            {(field) => (
              <Input
                {...field}
                {...register('email', { onBlur: () => void checkEmail(), onChange: () => setEmailTaken(null) })}
                type="email"
                inputMode="email"
                autoComplete="off"
                placeholder="name@example.com"
                maxLength={STAFF_LIMITS.email + 20}
              />
            )}
          </FormField>
          <FormField label="Phone" error={errors.phone?.message} hint="Optional.">
            {(field) => <Input {...field} {...register('phone')} type="tel" inputMode="tel" autoComplete="off" placeholder="(512) 555-0134" maxLength={STAFF_LIMITS.phone + 10} />}
          </FormField>
        </div>
        {emailTaken && !errors.email ? (
          <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger/10 p-3 text-caption text-danger dark:bg-danger/15">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-medium">This email address is already used by </span>
              <Link to={`/staff/${emailTaken.id}`} target="_blank" rel="noreferrer" className={linkClass}>
                {emailTaken.name}
                <ExternalLink className="size-3.5" aria-hidden="true" />
                <span className="sr-only">(opens in a new tab)</span>
              </Link>
              . Use a different one.
            </p>
          </div>
        ) : null}
      </FormSection>

      <FormSection title="Role" description="What this person does. Roles are a reference in this demo: access isn’t enforced.">
        <Controller
          control={control}
          name="role"
          render={({ field, fieldState }) => (
            <SelectField
              label="Role"
              required
              value={field.value}
              onChange={(value) => field.onChange(value as StaffRole)}
              placeholder="Choose a role"
              disabled={isSelf}
              error={fieldState.error?.message}
              hint={isSelf ? 'You can’t change your own role. Ask another Owner or Admin.' : ROLE_DESCRIPTIONS[role]}
              options={STAFF_ROLES.map((value) => ({ value, label: ROLE_LABELS[value] }))}
            />
          )}
        />
      </FormSection>

      <FormSection title="Properties" description="Properties this person looks after. Owners and admins usually cover the whole portfolio and need no assignments.">
        <Controller
          control={control}
          name="propertyIds"
          render={({ field, fieldState }) => {
            const selected = new Set(field.value)
            const toggle = (id: string, on: boolean) => field.onChange(propertyOptions.map((property) => property.id).filter((value) => (value === id ? on : selected.has(value))))
            return (
              <fieldset aria-describedby={fieldState.error ? 'staff-properties-error' : undefined}>
                <legend className="mb-2 flex w-full flex-wrap items-baseline justify-between gap-2 text-label text-foreground">
                  <span>Assigned properties</span>
                  <span className="text-caption font-normal text-muted-foreground" aria-live="polite">
                    {selected.size} of {propertyOptions.length} selected
                  </span>
                </legend>
                {propertyOptions.length === 0 ? (
                  <p className="text-caption text-muted-foreground">No properties yet.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {propertyOptions.map((property) => {
                      const id = `staff-property-${property.id}`
                      return (
                        <label
                          key={property.id}
                          htmlFor={id}
                          className={cn('flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:bg-muted/50', selected.has(property.id) && 'border-primary bg-accent/40')}
                        >
                          <Checkbox id={id} checked={selected.has(property.id)} onCheckedChange={(checked) => toggle(property.id, checked === true)} onBlur={field.onBlur} />
                          <span className="min-w-0">
                            <span className="block truncate text-body text-foreground">{property.name}</span>
                            <span className="block text-caption text-muted-foreground capitalize">{property.type}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                {fieldState.error ? (
                  <p id="staff-properties-error" className="mt-2 flex items-start gap-1.5 text-caption font-medium text-danger">
                    <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                    {fieldState.error.message}
                  </p>
                ) : null}
              </fieldset>
            )
          }}
        />
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

function ErrorSummary({ errors, count }: { errors: FieldErrors<StaffFormValues>; count: number }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-body font-medium">{errors.root?.message ?? `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before saving.`}</p>
    </div>
  )
}
