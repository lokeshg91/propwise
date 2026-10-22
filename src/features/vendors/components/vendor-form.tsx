import { zodResolver } from '@hookform/resolvers/zod'
import { CircleAlert, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Controller, type FieldErrors, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { FormSection } from '@/components/forms/form-section'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { type VendorConflicts, type VendorMatch } from '@/data/domain/vendor-rules'
import {
  checkVendorDuplicates,
  isServiceError,
  isVendorDuplicateError,
  isVendorOpenJobsError,
  VENDOR_LIMITS,
  type VendorSaveOptions,
  type VendorWorkOrder,
} from '@/data/services'
import { CATEGORY_ICONS, CATEGORY_LABELS } from '@/features/maintenance/lib/request-meta'
import { ConfirmDialog, OpenJobsList, VendorMatchList } from '@/features/vendors/components/vendor-dialogs'
import { VENDOR_FIELD_MAP, vendorSchema, type VendorFormDraft, type VendorFormValues } from '@/features/vendors/lib/vendor-schema'
import { cn } from '@/lib/utils'
import { REQUEST_CATEGORIES } from '@/types'

interface VendorFormProps {
  /** The vendor being edited (excluded from duplicate checks), or undefined when adding. */
  vendorId?: string
  vendorName?: string
  defaultValues: VendorFormDraft
  submitLabel: string
  cancelHref: string
  /** Saves; may throw duplicate or open-jobs errors, which the form turns into confirmations. */
  onSubmit: (values: VendorFormValues, options: VendorSaveOptions) => Promise<void>
}

type Pending =
  | { kind: 'phone'; matches: VendorMatch[]; values: VendorFormValues; options: VendorSaveOptions }
  | { kind: 'open-jobs'; jobs: VendorWorkOrder[]; values: VendorFormValues; options: VendorSaveOptions }
  | null

const EMPTY_CONFLICTS: VendorConflicts = { blocking: [], warnings: [] }

export function VendorForm({ vendorId, vendorName, defaultValues, submitLabel, cancelHref, onSubmit }: VendorFormProps) {
  const isEdit = vendorId !== undefined
  const {
    register,
    control,
    handleSubmit,
    setError,
    getValues,
    formState: { errors, isSubmitting, isDirty, submitCount },
  } = useForm<VendorFormDraft, unknown, VendorFormValues>({ resolver: zodResolver(vendorSchema), defaultValues, mode: 'onTouched' })
  const [conflicts, setConflicts] = useState<VendorConflicts>(EMPTY_CONFLICTS)
  const [pending, setPending] = useState<Pending>(null)
  const [notes, status] = useWatch({ control, name: ['notes', 'status'] })
  const errorCount = Object.keys(errors).filter((key) => key !== 'root').length

  /** Checks name, email and phone against other vendors as the user leaves those fields. */
  const refreshConflicts = async () => {
    const { name, email, phone } = getValues()
    if (!name.trim() && !email.trim() && !phone.trim()) return setConflicts(EMPTY_CONFLICTS)
    setConflicts(await checkVendorDuplicates({ name, email, phone }, vendorId))
  }
  const matchesFor = (field: VendorMatch['field']) =>
    (field === 'phone' ? conflicts.warnings : conflicts.blocking).filter((match) => match.field === field)

  const save = async (values: VendorFormValues, options: VendorSaveOptions) => {
    try {
      await onSubmit(values, options)
      setPending(null)
    } catch (error) {
      if (isVendorDuplicateError(error)) {
        if (error.requiresConfirmation) {
          setPending({ kind: 'phone', matches: error.matches, values, options })
          return
        }
        setPending(null)
        setConflicts((current) => ({ ...current, blocking: error.matches }))
        setError(error.field === 'email' ? 'email' : 'name', { message: error.message }, { shouldFocus: true })
        return
      }
      if (isVendorOpenJobsError(error)) {
        setPending({ kind: 'open-jobs', jobs: error.openWorkOrders, values, options })
        return
      }
      setPending(null)
      const field = isServiceError(error) && error.field ? VENDOR_FIELD_MAP[error.field] : undefined
      if (field) setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
      else setError('root', { message: error instanceof Error ? error.message : 'Something went wrong. Try again.' })
    }
  }

  const submit = handleSubmit((values) => save(values, {}))

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-6">
      {submitCount > 0 && (errorCount > 0 || errors.root) ? <ErrorSummary errors={errors} count={errorCount} /> : null}

      <FormSection title="Business" description="How the vendor appears when assigning work orders.">
        <FormField label="Vendor name" required error={errors.name?.message}>
          {(field) => (
            <Input {...field} {...register('name', { onBlur: () => void refreshConflicts() })} placeholder="e.g. BlueLine Plumbing" autoComplete="organization" />
          )}
        </FormField>
        {matchesFor('name').length > 0 ? (
          <DuplicateNotice tone="danger" text="A vendor with this name already exists. Open it instead of adding a duplicate:" matches={matchesFor('name')} />
        ) : null}
        <FormField label="Company / legal name" error={errors.company?.message} hint="Optional. Leave blank if it’s the same as the vendor name.">
          {(field) => <Input {...field} {...register('company')} placeholder="e.g. BlueLine Plumbing LLC" autoComplete="off" />}
        </FormField>
        <Controller
          control={control}
          name="status"
          render={({ field }) => (
            <fieldset>
              <legend className="mb-2 text-label text-foreground">Status</legend>
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Status" className="grid gap-3 sm:grid-cols-2">
                {(
                  [
                    { value: 'active', title: 'Active', note: 'Can be assigned to new work orders.' },
                    { value: 'inactive', title: 'Inactive', note: 'Kept for history; can’t take new work orders.' },
                  ] as const
                ).map((option) => (
                  <label
                    key={option.value}
                    htmlFor={`vendor-status-${option.value}`}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50',
                      field.value === option.value && 'border-primary bg-accent/50 ring-1 ring-primary',
                    )}
                  >
                    <RadioGroupItem id={`vendor-status-${option.value}`} value={option.value} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="text-body font-medium text-foreground">{option.title}</span>
                      <span className="text-caption text-muted-foreground">{option.note}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
              {isEdit && status === 'inactive' && defaultValues.status === 'active' ? (
                <p className="mt-2 text-caption text-muted-foreground">If {vendorName ?? 'the vendor'} has open jobs, you’ll see them and confirm before saving. Those jobs stay with the vendor.</p>
              ) : null}
            </fieldset>
          )}
        />
      </FormSection>

      <FormSection title="Contact" description="Who to call and where work orders are sent.">
        <FormField label="Contact person" required error={errors.contactName?.message}>
          {(field) => <Input {...field} {...register('contactName')} placeholder="e.g. Marco Ruiz" autoComplete="name" />}
        </FormField>
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <FormField label="Email" required error={errors.email?.message}>
              {(field) => (
                <Input {...field} {...register('email', { onBlur: () => void refreshConflicts() })} type="email" autoComplete="email" placeholder="service@vendor.com" />
              )}
            </FormField>
            {matchesFor('email').length > 0 ? (
              <DuplicateNotice tone="danger" text="This email belongs to:" matches={matchesFor('email')} />
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <FormField label="Phone" required error={errors.phone?.message}>
              {(field) => (
                <Input {...field} {...register('phone', { onBlur: () => void refreshConflicts() })} type="tel" autoComplete="tel" placeholder="(512) 555-0134" />
              )}
            </FormField>
            {matchesFor('phone').length > 0 ? (
              <DuplicateNotice tone="warning" text="Same phone number as the vendor below. You’ll be asked to confirm when saving:" matches={matchesFor('phone')} />
            ) : null}
          </div>
        </div>
      </FormSection>

      <FormSection title="Services" description="Trades the vendor offers. They’re recommended first for matching requests.">
        <Controller
          control={control}
          name="categories"
          render={({ field, fieldState }) => (
            <fieldset aria-describedby={fieldState.error ? 'vendor-categories-error' : undefined} aria-invalid={Boolean(fieldState.error)}>
              <legend className="mb-2 text-label text-foreground">
                Service categories
                <span className="ml-1 text-danger" aria-hidden="true">
                  *
                </span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {REQUEST_CATEGORIES.map((category) => {
                  const Icon = CATEGORY_ICONS[category]
                  const checked = field.value.includes(category)
                  const id = `vendor-category-${category}`
                  return (
                    <label
                      key={category}
                      htmlFor={id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-body text-foreground transition-colors hover:bg-muted/50',
                        checked && 'border-primary bg-accent/50 ring-1 ring-primary',
                      )}
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(value) =>
                          field.onChange(value === true ? REQUEST_CATEGORIES.filter((entry) => entry === category || field.value.includes(entry)) : field.value.filter((entry) => entry !== category))
                        }
                        onBlur={field.onBlur}
                      />
                      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                      {CATEGORY_LABELS[category]}
                    </label>
                  )
                })}
              </div>
              {fieldState.error ? (
                <p id="vendor-categories-error" className="mt-2 flex items-start gap-1.5 text-caption font-medium text-danger">
                  <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                  {fieldState.error.message}
                </p>
              ) : null}
            </fieldset>
          )}
        />
      </FormSection>

      <FormSection title="Notes" description="Internal notes for your team. Not shared with the vendor.">
        <FormField
          label="Notes"
          error={errors.notes?.message}
          labelAside={
            <span className={cn('text-caption tabular-nums', notes.length > VENDOR_LIMITS.notes ? 'text-danger' : 'text-muted-foreground')} aria-live="polite">
              {notes.length}/{VENDOR_LIMITS.notes}
            </span>
          }
        >
          {(field) => <Textarea {...field} {...register('notes')} rows={4} placeholder="e.g. 24/7 emergency line, preferred for water heaters" />}
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

      <ConfirmDialog
        open={pending?.kind === 'phone'}
        onOpenChange={(open) => !open && setPending(null)}
        title="Same phone number"
        description="Another vendor already uses this phone number. Check it isn’t the same business before saving. Vendors are never merged automatically."
        confirmLabel="Save anyway"
        cancelLabel="Go back"
        onConfirm={() => (pending ? save(pending.values, { ...pending.options, acknowledgePhoneMatch: true }) : undefined)}
      >
        {pending?.kind === 'phone' ? <VendorMatchList matches={pending.matches} /> : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={pending?.kind === 'open-jobs'}
        onOpenChange={(open) => !open && setPending(null)}
        title={`Deactivate ${vendorName ?? 'vendor'}?`}
        description={(() => {
          const count = pending?.kind === 'open-jobs' ? pending.jobs.length : 0
          return `${count} open ${count === 1 ? 'work order stays' : 'work orders stay'} with the vendor and can still be completed or reassigned. No new work orders can be assigned while inactive.`
        })()}
        confirmLabel="Save and deactivate"
        cancelLabel="Keep active"
        destructive
        onConfirm={() => (pending ? save(pending.values, { ...pending.options, confirmOpenJobs: true }) : undefined)}
      >
        {pending?.kind === 'open-jobs' ? <OpenJobsList jobs={pending.jobs} /> : null}
      </ConfirmDialog>
    </form>
  )
}

function DuplicateNotice({ tone, text, matches }: { tone: 'danger' | 'warning'; text: string; matches: VendorMatch[] }) {
  const Icon = tone === 'danger' ? CircleAlert : TriangleAlert
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border p-3 text-caption',
        tone === 'danger' ? 'border-danger/30 bg-danger/10 text-danger dark:bg-danger/15' : 'border-warning/30 bg-warning/10 text-warning dark:bg-warning/15',
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="font-medium">{text}</p>
        <VendorMatchList matches={matches} />
      </div>
    </div>
  )
}

function ErrorSummary({ errors, count }: { errors: FieldErrors<VendorFormDraft>; count: number }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-body font-medium">
        {errors.root?.message ?? `Please fix ${count} ${count === 1 ? 'field' : 'fields'} before saving.`}
      </p>
    </div>
  )
}
