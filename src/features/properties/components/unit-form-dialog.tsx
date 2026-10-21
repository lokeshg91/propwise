import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createUnit, isServiceError, updateUnit } from '@/data/services'
import { UNIT_STATUS_LABELS, UNIT_TYPE_LABELS, unitLabel, unitTypesFor } from '@/features/properties/lib/property-meta'
import { createUnitSchema, toUnitInput, type UnitFormDraft, type UnitFormValues } from '@/features/properties/lib/unit-schema'
import { toNullableNumber } from '@/lib/form-schema'
import { cn } from '@/lib/utils'
import { type Property, UNIT_STATUSES, type Unit } from '@/types'

export type UnitDialogState = { mode: 'create' } | { mode: 'edit'; unit: Unit } | null

interface UnitFormDialogProps {
  property: Property
  state: UnitDialogState
  onOpenChange: (open: boolean) => void
  /** Called after a successful save, e.g. to reload data. */
  onSaved: () => void
}

/** Add or edit a unit. Mounted fresh each time it opens so defaults reset. */
export function UnitFormDialog({ property, state, onOpenChange, onSaved }: UnitFormDialogProps) {
  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-xl">
        {state ? (
          <UnitForm
            key={state.mode === 'edit' ? state.unit.id : 'new'}
            property={property}
            unit={state.mode === 'edit' ? state.unit : null}
            onCancel={() => onOpenChange(false)}
            onSaved={onSaved}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function defaultsFor(property: Property, unit: Unit | null): UnitFormDraft {
  if (unit) {
    return {
      number: unit.number,
      type: unit.type,
      floor: unit.floor,
      areaSqft: unit.areaSqft,
      rent: unit.rent,
      status: unit.status,
      tenantName: unit.tenantName ?? '',
      leaseEndDate: unit.leaseEndDate ?? '',
    }
  }
  return {
    number: '',
    type: unitTypesFor(property.type)[0] ?? 'office',
    floor: 1,
    areaSqft: null,
    rent: null,
    status: 'vacant',
    tenantName: '',
    leaseEndDate: '',
  }
}

function UnitForm({
  property,
  unit,
  onCancel,
  onSaved,
}: {
  property: Property
  unit: Unit | null
  onCancel: () => void
  onSaved: () => void
}) {
  const schema = useMemo(() => createUnitSchema(property.type), [property.type])
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UnitFormDraft, unknown, UnitFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(property, unit),
    mode: 'onTouched',
  })
  const status = useWatch({ control, name: 'status' })
  const occupied = status === 'occupied'
  const prefix = property.type === 'residential' ? 'Unit' : 'Suite'

  const submit = handleSubmit(async (values) => {
    try {
      const saved = unit ? await updateUnit(unit.id, toUnitInput(values)) : await createUnit(property.id, toUnitInput(values))
      toast.success(unit ? 'Unit updated' : 'Unit added', {
        description: `${unitLabel(property.type, saved.number)} at ${property.name} was saved.`,
      })
      onSaved()
    } catch (error) {
      if (isServiceError(error) && error.field === 'number') {
        setError('number', { message: error.message }, { shouldFocus: true })
      } else {
        setError('root', { message: error instanceof Error ? error.message : 'Could not save the unit.' })
      }
    }
  })

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{unit ? `Edit ${unitLabel(property.type, unit.number)}` : 'Add unit'}</DialogTitle>
        <DialogDescription>
          {unit ? 'Update the unit details and occupancy.' : `Add a ${prefix.toLowerCase()} to ${property.name}.`}
        </DialogDescription>
      </DialogHeader>

      {errors.root ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
          {errors.root.message}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label={`${prefix} number`} required error={errors.number?.message}>
          {(field) => <Input {...field} {...register('number')} placeholder="e.g. 204" autoComplete="off" />}
        </FormField>
        <Controller
          control={control}
          name="type"
          render={({ field, fieldState }) => (
            <FormField label="Unit type" required error={fieldState.error?.message}>
              {(aria) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {unitTypesFor(property.type).map((type) => (
                      <SelectItem key={type} value={type}>
                        {UNIT_TYPE_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
        <FormField label="Floor" required error={errors.floor?.message}>
          {(field) => <Input {...field} {...register('floor', { setValueAs: toNullableNumber })} type="number" inputMode="numeric" />}
        </FormField>
        <FormField label="Size (sq ft)" required error={errors.areaSqft?.message}>
          {(field) => (
            <Input {...field} {...register('areaSqft', { setValueAs: toNullableNumber })} type="number" inputMode="numeric" placeholder="750" />
          )}
        </FormField>
        <FormField
          label={occupied ? 'Monthly rent' : 'Asking rent'}
          required
          error={errors.rent?.message}
          hint={occupied ? 'Rent in the current lease' : 'Advertised rent while available'}
          className="sm:col-span-2"
        >
          {(field) => (
            <div className="relative sm:max-w-60">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-body text-muted-foreground" aria-hidden="true">
                $
              </span>
              <Input
                {...field}
                {...register('rent', { setValueAs: toNullableNumber })}
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                className="pl-7"
              />
            </div>
          )}
        </FormField>
      </div>

      <Controller
        control={control}
        name="status"
        render={({ field }) => (
          <fieldset>
            <legend className="mb-2 text-label text-foreground">Occupancy</legend>
            <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Occupancy" className="grid gap-2 sm:grid-cols-3">
              {UNIT_STATUSES.map((value) => {
                const id = `unit-status-${value}`
                return (
                  <label
                    key={value}
                    htmlFor={id}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-body font-medium text-foreground transition-colors hover:bg-muted/50',
                      field.value === value && 'border-primary bg-accent/50 ring-1 ring-primary',
                    )}
                  >
                    <RadioGroupItem id={id} value={value} />
                    {UNIT_STATUS_LABELS[value]}
                  </label>
                )
              })}
            </RadioGroup>
          </fieldset>
        )}
      />

      {occupied ? (
        <div className="grid gap-4 rounded-lg border border-border bg-muted/40 p-4 sm:grid-cols-2">
          <FormField label="Tenant name" required error={errors.tenantName?.message}>
            {(field) => <Input {...field} {...register('tenantName')} placeholder={property.type === 'residential' ? 'e.g. Leah Novak' : 'e.g. Kestrel Labs'} />}
          </FormField>
          <FormField label="Lease end date" error={errors.leaseEndDate?.message} hint="Optional">
            {(field) => <Input {...field} {...register('leaseEndDate')} type="date" />}
          </FormField>
        </div>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          {unit ? 'Save unit' : 'Add unit'}
        </Button>
      </DialogFooter>
    </form>
  )
}
