import { CircleAlert, LoaderCircle } from 'lucide-react'
import { type ReactNode } from 'react'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

/** Two or three large radio options, e.g. "Tenant" or "Other payer". */
export function ChoiceCards<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
}: {
  legend: string
  name: string
  value: T
  onChange: (value: T) => void
  options: ReadonlyArray<{ value: T; title: string; note: string }>
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-label text-foreground">{legend}</legend>
      <RadioGroup value={value} onValueChange={(next) => onChange(next as T)} aria-label={legend} className="grid gap-3 sm:grid-cols-2">
        {options.map((option) => (
          <label
            key={option.value}
            htmlFor={`${name}-${option.value}`}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-muted/50',
              value === option.value && 'border-primary bg-accent/50 ring-1 ring-primary',
            )}
          >
            <RadioGroupItem id={`${name}-${option.value}`} value={option.value} className="mt-0.5" />
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-foreground">{option.title}</span>
              <span className="text-caption text-muted-foreground">{option.note}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
    </fieldset>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
  placeholder,
  error,
  hint,
  required,
  disabled,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
  placeholder: string
  error?: string
  hint?: ReactNode
  required?: boolean
  disabled?: boolean
}) {
  return (
    <FormField label={label} required={required} error={error} hint={hint}>
      {(field) => (
        <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger {...field} className="w-full">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  )
}

export function FormErrorSummary({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-danger/30 bg-danger/10 p-4 text-danger dark:bg-danger/15">
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="text-body font-medium">{message}</p>
    </div>
  )
}

export function FormFooter({ cancelHref, submitLabel, submitting, disabled }: { cancelHref: string; submitLabel: string; submitting: boolean; disabled?: boolean }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-border bg-background/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:flex-row sm:justify-end sm:px-6 lg:-mx-8 lg:px-8">
      <Button variant="outline" size="lg" asChild>
        <Link to={cancelHref}>Cancel</Link>
      </Button>
      <Button type="submit" size="lg" disabled={submitting || disabled}>
        {submitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
        {submitting ? 'Saving…' : submitLabel}
      </Button>
    </div>
  )
}
