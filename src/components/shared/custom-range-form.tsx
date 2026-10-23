import { useState } from 'react'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { customRangeErrors, type CustomRangeErrors } from '@/data/domain/report-range'

/**
 * From/To dates with inline validation (valid dates, from ≤ to, at most five
 * years, inclusive). Used by Reports and Finance Transactions.
 */
export function CustomRangeForm({
  initial,
  initialError,
  onApply,
  onCancel,
}: {
  initial: { from: string; to: string }
  initialError: string | null
  onApply: (range: { kind: 'custom'; from: string; to: string }) => void
  onCancel?: () => void
}) {
  const [from, setFrom] = useState(initial.from)
  const [to, setTo] = useState(initial.to)
  const [errors, setErrors] = useState<CustomRangeErrors>(initialError ? { to: initialError } : {})
  return (
    <form
      noValidate
      aria-label="Custom range"
      className="flex flex-col gap-3 sm:flex-row sm:items-start"
      onSubmit={(event) => {
        event.preventDefault()
        const found = customRangeErrors(from, to)
        setErrors(found)
        if (!found.from && !found.to) onApply({ kind: 'custom', from, to })
      }}
    >
      <FormField label="From" error={errors.from} className="sm:w-48">
        {(field) => <Input {...field} type="date" value={from} onChange={(event) => setFrom(event.target.value)} />}
      </FormField>
      <FormField label="To" error={errors.to} hint="Up to 5 years. Dates are inclusive." className="sm:w-56">
        {(field) => <Input {...field} type="date" value={to} onChange={(event) => setTo(event.target.value)} />}
      </FormField>
      <div className="flex gap-2 sm:pt-7">
        <Button type="submit">Apply</Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </form>
  )
}
