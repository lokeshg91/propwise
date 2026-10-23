import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarClock, LoaderCircle, UserPlus, UserRound, Wrench } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
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
import { type UnitLease } from '@/features/properties/components/unit-columns'
import { UNIT_STATUS_LABELS, UNIT_TYPE_LABELS, unitLabel, unitTypesFor } from '@/features/properties/lib/property-meta'
import { createUnitSchema, toUnitInput, type UnitFormDraft, type UnitFormValues } from '@/features/properties/lib/unit-schema'
import { useFormat } from '@/hooks/use-format'
import { toNullableNumber } from '@/lib/form-schema'
import { cn } from '@/lib/utils'
import { type Property, type Unit, type UnitStatus } from '@/types'

export type UnitDialogState = { mode: 'create' } | { mode: 'edit'; unit: Unit; lease: UnitLease | null } | null

/** Statuses set here; “occupied” only comes from an active lease in the Tenants module. */
const EDITABLE_STATUSES = ['vacant', 'maintenance'] as const satisfies readonly UnitStatus[]

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
            lease={state.mode === 'edit' ? state.lease : null}
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
    }
  }
  return {
    number: '',
    type: unitTypesFor(property.type)[0] ?? 'office',
    floor: 1,
    areaSqft: null,
    rent: null,
    status: 'vacant',
  }
}

function UnitForm({
  property,
  unit,
  lease,
  onCancel,
  onSaved,
}: {
  property: Property
  unit: Unit | null
  lease: UnitLease | null
  onCancel: () => void
  onSaved: () => void
}) {
  const { date: formatDate } = useFormat()
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
  const leased = lease?.status === 'active'
  const reserved = lease?.status === 'pending'
  const prefix = property.type === 'residential' ? 'Unit' : 'Suite'

  const submit = handleSubmit(async (values) => {
    try {
      const saved = unit ? await updateUnit(unit.id, toUnitInput(values)) : await createUnit(property.id, toUnitInput(values))
      toast.success(unit ? 'Unit updated' : 'Unit added', {
        description: `${unitLabel(property.type, saved.number)} at ${property.name} was saved.`,
      })
      onSaved()
    } catch (error) {
      const field = isServiceError(error) ? error.field : undefined
      if (field === 'number' || field === 'rent' || field === 'status') {
        setError(field, { message: error instanceof Error ? error.message : '' }, { shouldFocus: true })
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
          {unit ? 'Update the unit details and availability.' : `Add a ${prefix.toLowerCase()} to ${property.name}.`}
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
          hint={leased ? 'Set by the current lease. Change it from the tenant’s lease.' : 'Advertised rent while available'}
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
                readOnly={leased}
                aria-readonly={leased || undefined}
                className="pl-7 read-only:bg-muted/50 read-only:text-muted-foreground"
              />
            </div>
          )}
        </FormField>
      </div>

      {leased && lease ? (
        <LeasePanel icon={UserRound} title="Occupied" lease={lease}>
          Lease ends {formatDate(lease.endDate)}. To vacate the unit, end the lease from the tenant’s profile.
        </LeasePanel>
      ) : (
        <Controller
          control={control}
          name="status"
          render={({ field, fieldState }) => (
            <fieldset aria-describedby={fieldState.error ? 'unit-status-error' : undefined}>
              <legend className="mb-2 text-label text-foreground">Availability</legend>
              <RadioGroup value={field.value} onValueChange={field.onChange} aria-label="Availability" className="grid gap-2 sm:grid-cols-2">
                {EDITABLE_STATUSES.map((value) => {
                  const id = `unit-status-${value}`
                  const disabled = value === 'maintenance' && reserved
                  return (
                    <label
                      key={value}
                      htmlFor={id}
                      className={cn(
                        'flex cursor-pointer items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-body font-medium text-foreground transition-colors hover:bg-muted/50',
                        field.value === value && 'border-primary bg-accent/50 ring-1 ring-primary',
                        disabled && 'cursor-not-allowed opacity-60 hover:bg-card',
                      )}
                    >
                      <RadioGroupItem id={id} value={value} disabled={disabled} />
                      {UNIT_STATUS_LABELS[value]}
                    </label>
                  )
                })}
              </RadioGroup>
              {fieldState.error ? (
                <p id="unit-status-error" className="mt-1.5 text-caption text-danger">
                  {fieldState.error.message}
                </p>
              ) : null}
            </fieldset>
          )}
        />
      )}

      {reserved && lease ? (
        <LeasePanel icon={CalendarClock} title="Reserved" lease={lease}>
          Pending lease, moving in {formatDate(lease.startDate)}.
        </LeasePanel>
      ) : null}

      {!lease && !occupied ? (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-caption text-muted-foreground">
          <UserPlus className="size-4 shrink-0" aria-hidden="true" />
          {unit && status === 'vacant' ? (
            <>
              Ready to lease?
              <Link
                to={`/tenants/new?propertyId=${property.id}&unitId=${unit.id}`}
                className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Assign a tenant
              </Link>
            </>
          ) : (
            'Tenants and occupancy are managed in the Tenants module.'
          )}
        </p>
      ) : null}

      {unit ? (
        <p className="flex items-center gap-1.5 text-caption text-muted-foreground">
          <Wrench className="size-4 shrink-0" aria-hidden="true" />
          Something needs fixing?
          <Link
            to={`/maintenance/new?propertyId=${property.id}&unitId=${unit.id}`}
            className="rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Report an issue
          </Link>
        </p>
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

function LeasePanel({
  icon: Icon,
  title,
  lease,
  children,
}: {
  icon: typeof UserRound
  title: string
  lease: UnitLease
  children: ReactNode
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border bg-muted/40 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary/15">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 text-caption text-muted-foreground">
        <p className="text-body font-medium text-foreground">
          {title} by{' '}
          <Link
            to={`/tenants/${lease.tenant.id}`}
            className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {lease.tenant.name}
          </Link>
        </p>
        <p className="mt-0.5">{children}</p>
      </div>
    </div>
  )
}
