import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { todayIso } from '@/data/domain/dates'
import { activateLease, cancelLease, endLease, isServiceError } from '@/data/services'
import { LEASE_END_REASON_LABELS } from '@/features/tenants/lib/tenant-meta'
import { useFormat } from '@/hooks/use-format'
import { LEASE_END_REASONS, type Lease } from '@/types'

export type LeaseAction = 'end' | 'cancel' | 'activate'

interface LeaseActionDialogProps {
  action: LeaseAction | null
  lease: Lease
  tenantName: string
  /** e.g. "Harbor View Residences, Unit 204". */
  unitDescription: string
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

/** End, cancel or activate a lease. The only places a unit's occupancy changes. */
export function LeaseActionDialog({ action, lease, tenantName, unitDescription, onOpenChange, onDone }: LeaseActionDialogProps) {
  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {action === 'end' ? (
          <EndLeaseForm lease={lease} tenantName={tenantName} unitDescription={unitDescription} onCancel={() => onOpenChange(false)} onDone={onDone} />
        ) : action ? (
          <ConfirmLeaseChange
            action={action}
            lease={lease}
            tenantName={tenantName}
            unitDescription={unitDescription}
            onCancel={() => onOpenChange(false)}
            onDone={onDone}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function endLeaseSchema(lease: Lease, formatDate: (isoDate: string) => string) {
  const today = todayIso()
  return z.object({
    moveOutDate: z
      .string()
      .min(1, 'Choose the move-out date')
      .refine((value) => value >= lease.startDate, `Move-out can’t be before the lease start (${formatDate(lease.startDate)})`)
      .refine((value) => value <= today, 'Move-out can’t be in the future. End the lease on or after the move-out day.'),
    reason: z.enum(LEASE_END_REASONS, { error: 'Choose a reason' }),
  })
}

type EndLeaseValues = z.infer<ReturnType<typeof endLeaseSchema>>

function EndLeaseForm({
  lease,
  tenantName,
  unitDescription,
  onCancel,
  onDone,
}: {
  lease: Lease
  tenantName: string
  unitDescription: string
  onCancel: () => void
  onDone: () => void
}) {
  const { date: formatDate } = useFormat()
  const today = todayIso()
  const atTermDefault = lease.endDate <= today
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EndLeaseValues>({
    resolver: zodResolver(endLeaseSchema(lease, formatDate)),
    defaultValues: { moveOutDate: today, reason: atTermDefault ? 'moved-out' : 'early-termination' },
    mode: 'onTouched',
  })
  const moveOutDate = useWatch({ control, name: 'moveOutDate' })
  const atTerm = Boolean(moveOutDate) && moveOutDate >= lease.endDate

  const submit = handleSubmit(async (values) => {
    try {
      await endLease(lease.id, values.moveOutDate, values.reason)
      toast.success('Lease ended', { description: `${unitDescription} is now vacant.` })
      onDone()
    } catch (error) {
      if (isServiceError(error) && error.field === 'moveOutDate') setError('moveOutDate', { message: error.message }, { shouldFocus: true })
      else setError('root', { message: error instanceof Error ? error.message : 'Could not end the lease.' })
    }
  })

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>End lease</DialogTitle>
        <DialogDescription>
          Record {tenantName}’s move-out from {unitDescription}. The unit becomes vacant and available to lease.
        </DialogDescription>
      </DialogHeader>
      {errors.root ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
          {errors.root.message}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Move-out date"
          required
          error={errors.moveOutDate?.message}
          hint={atTerm ? 'At or after the lease end: recorded as expired.' : `Before ${formatDate(lease.endDate)}: recorded as terminated early.`}
        >
          {(field) => <Input {...field} {...register('moveOutDate')} type="date" min={lease.startDate} max={today} />}
        </FormField>
        <Controller
          control={control}
          name="reason"
          render={({ field, fieldState }) => (
            <FormField label="Reason" required error={fieldState.error?.message}>
              {(aria) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger {...aria} ref={field.ref} onBlur={field.onBlur} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEASE_END_REASONS.map((reason) => (
                      <SelectItem key={reason} value={reason}>
                        {LEASE_END_REASON_LABELS[reason]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>
          )}
        />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          Keep lease
        </Button>
        <Button type="submit" variant="destructive" disabled={isSubmitting}>
          {isSubmitting ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          End lease
        </Button>
      </DialogFooter>
    </form>
  )
}

const CONFIRM_COPY = {
  cancel: {
    title: 'Cancel pending lease',
    confirm: 'Cancel lease',
    dismiss: 'Keep lease',
    body: (tenant: string, unit: string, lease: Lease, formatDate: (isoDate: string) => string) =>
      `${tenant} won’t move in to ${unit} on ${formatDate(lease.startDate)}. The unit stops being reserved and can be leased to someone else.`,
    toast: 'Pending lease cancelled',
  },
  activate: {
    title: 'Mark as moved in',
    confirm: 'Mark as moved in',
    dismiss: 'Not yet',
    body: (tenant: string, unit: string, lease: Lease, formatDate: (isoDate: string) => string) =>
      `${tenant}’s lease for ${unit} becomes active from ${formatDate(lease.startDate)} and the unit is marked occupied.`,
    toast: 'Tenant moved in',
  },
} as const

function ConfirmLeaseChange({
  action,
  lease,
  tenantName,
  unitDescription,
  onCancel,
  onDone,
}: {
  action: 'cancel' | 'activate'
  lease: Lease
  tenantName: string
  unitDescription: string
  onCancel: () => void
  onDone: () => void
}) {
  const { date: formatDate } = useFormat()
  const copy = CONFIRM_COPY[action]
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await (action === 'cancel' ? cancelLease(lease.id) : activateLease(lease.id))
      toast.success(copy.toast, { description: unitDescription })
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setPending(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>{copy.body(tenantName, unitDescription, lease, formatDate)}</DialogDescription>
      </DialogHeader>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {copy.dismiss}
        </Button>
        <Button type="button" variant={action === 'cancel' ? 'destructive' : 'default'} disabled={pending} onClick={() => void confirm()}>
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
          {copy.confirm}
        </Button>
      </DialogFooter>
    </div>
  )
}
