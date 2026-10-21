import { zodResolver } from '@hookform/resolvers/zod'
import { LoaderCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Controller, type FieldValues, type Path, type UseFormSetError, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { todayIso, toIsoDate } from '@/data/domain/dates'
import { REOPEN_WINDOW_DAYS, type RequestAction } from '@/data/domain/maintenance-rules'
import {
  assignVendor,
  cancelRequest,
  completeRequest,
  holdRequest,
  isServiceError,
  reassignVendor,
  reopenRequest,
  type RequestDetail,
  rescheduleWorkOrder,
  resumeRequest,
  startWork,
} from '@/data/services'
import { CurrencyInput } from '@/features/maintenance/components/currency-input'
import { VendorSelect } from '@/features/maintenance/components/vendor-select'
import { locationLabel } from '@/features/maintenance/lib/request-list'
import { HOLD_REASON_LABELS } from '@/features/maintenance/lib/request-meta'
import { defaultVisitTime, formatDateTime, toDateTimeLocal } from '@/features/maintenance/lib/request-time'
import { formatDate } from '@/lib/format'
import { toNullableNumber } from '@/lib/form-schema'
import { cn } from '@/lib/utils'
import { HOLD_REASONS, type HoldReason, type Vendor } from '@/types'

interface RequestActionDialogProps {
  action: RequestAction | null
  detail: RequestDetail
  vendors: Vendor[]
  onOpenChange: (open: boolean) => void
  onDone: () => void
}

/**
 * Every status change goes through one of these dialogs. The service checks
 * the same lifecycle rules again, so a stale page can't skip a step.
 */
export function RequestActionDialog({ action, detail, vendors, onOpenChange, onDone }: RequestActionDialogProps) {
  const close = () => onOpenChange(false)
  const props = { detail, vendors, onCancel: close, onDone }
  return (
    <Dialog open={action !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {action === 'assign' || action === 'reassign' ? <AssignForm {...props} reassign={action === 'reassign'} /> : null}
        {action === 'reschedule' ? <RescheduleForm {...props} /> : null}
        {action === 'hold' ? <HoldForm {...props} /> : null}
        {action === 'complete' ? <CompleteForm {...props} /> : null}
        {action === 'cancel' ? <CancelForm {...props} /> : null}
        {action === 'reopen' ? <ReopenForm {...props} /> : null}
        {action === 'start' || action === 'resume' ? <ConfirmStep {...props} action={action} /> : null}
      </DialogContent>
    </Dialog>
  )
}

interface StepProps {
  detail: RequestDetail
  vendors: Vendor[]
  onCancel: () => void
  onDone: () => void
}

/* ---------------------------------------------------------------- helpers */

function RootError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
      {message}
    </p>
  )
}

function Footer({ onCancel, pending, label, cancelLabel = 'Cancel', destructive = false }: { onCancel: () => void; pending: boolean; label: string; cancelLabel?: string; destructive?: boolean }) {
  return (
    <DialogFooter>
      <Button type="button" variant="outline" onClick={onCancel}>
        {cancelLabel}
      </Button>
      <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
        {label}
      </Button>
    </DialogFooter>
  )
}

/** Maps a service error onto a field, or the dialog's root error. */
function applyError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]) {
  const message = error instanceof Error ? error.message : 'Something went wrong. Try again.'
  if (isServiceError(error) && error.field && fields.includes(error.field)) {
    setError(error.field as Path<T>, { message }, { shouldFocus: true })
  } else {
    setError('root' as Path<T>, { message })
  }
}

const unitName = (detail: RequestDetail) => locationLabel(detail)

/* ------------------------------------------------------------ assign etc. */

const assignSchema = z.object({
  vendorId: z.string().min(1, 'Choose a vendor'),
  scheduledFor: z.string().refine((value) => value === '' || !Number.isNaN(Date.parse(value)), 'Enter a valid date and time'),
  estimatedCost: z.number({ error: 'Enter the estimate as a number' }).min(0, 'The estimate can’t be negative').nullable(),
  notes: z.string().trim().max(300, 'Keep notes under 300 characters'),
  reason: z.string().trim().max(200, 'Keep the reason under 200 characters'),
})
type AssignValues = z.infer<typeof assignSchema>

function AssignForm({ detail, vendors, onCancel, onDone, reassign }: StepProps & { reassign: boolean }) {
  const current = detail.activeWorkOrder
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AssignValues>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      vendorId: '',
      scheduledFor: reassign && current?.scheduledFor ? toDateTimeLocal(current.scheduledFor) : defaultVisitTime(),
      estimatedCost: reassign ? (current?.estimatedCost ?? null) : null,
      notes: '',
      reason: '',
    },
  })

  const submit = handleSubmit(async (values) => {
    // Inactive vendors are also rejected by the service.
    const vendor = vendors.find((entry) => entry.id === values.vendorId)
    if (vendor && !vendor.active) {
      setError('vendorId', { message: `${vendor.name} is inactive and can’t take new work orders.` })
      return
    }
    const input = {
      vendorId: values.vendorId,
      scheduledFor: values.scheduledFor ? new Date(values.scheduledFor).toISOString() : null,
      estimatedCost: values.estimatedCost,
      notes: values.notes,
    }
    try {
      if (reassign) await reassignVendor(detail.request.id, input, values.reason)
      else await assignVendor(detail.request.id, input)
      toast.success(reassign ? 'Vendor reassigned' : 'Vendor assigned', { description: `${vendor?.name ?? 'Vendor'} · ${detail.request.id}` })
      onDone()
    } catch (error) {
      applyError(error, setError, ['vendorId', 'scheduledFor', 'estimatedCost'])
    }
  })

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>{reassign ? 'Reassign vendor' : 'Assign vendor'}</DialogTitle>
        <DialogDescription>
          {reassign
            ? `${detail.vendor?.name ?? 'The current vendor'}’s work order will be cancelled and kept in the history. A new work order is created for the new vendor.`
            : `Create a work order for ${detail.request.title.toLowerCase()} at ${detail.property?.name ?? 'the property'}.`}
        </DialogDescription>
      </DialogHeader>
      <RootError message={errors.root?.message} />
      <Controller
        control={control}
        name="vendorId"
        render={({ field, fieldState }) => (
          <FormField label="Vendor" required error={fieldState.error?.message}>
            {(aria) => (
              <VendorSelect
                vendors={vendors}
                category={detail.request.category}
                value={field.value}
                onValueChange={field.onChange}
                onBlur={field.onBlur}
                triggerRef={field.ref}
                aria={aria}
                excludeId={reassign ? current?.vendorId : undefined}
              />
            )}
          </FormField>
        )}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Visit" error={errors.scheduledFor?.message} hint="Optional">
          {(field) => <Input {...field} {...register('scheduledFor')} type="datetime-local" />}
        </FormField>
        <FormField label="Estimate" error={errors.estimatedCost?.message} hint="Optional. Not an invoice.">
          {(field) => <CurrencyInput {...field} {...register('estimatedCost', { setValueAs: toNullableNumber })} />}
        </FormField>
      </div>
      {reassign ? (
        <FormField label="Reason for reassigning" error={errors.reason?.message} hint="Optional. Shown in the activity history.">
          {(field) => <Input {...field} {...register('reason')} placeholder="e.g. Vendor unavailable this week" />}
        </FormField>
      ) : (
        <FormField label="Notes for the vendor" error={errors.notes?.message} hint="Optional">
          {(field) => <Textarea {...field} {...register('notes')} rows={2} />}
        </FormField>
      )}
      <Footer onCancel={onCancel} pending={isSubmitting} label={reassign ? 'Reassign' : 'Assign vendor'} />
    </form>
  )
}

const rescheduleSchema = z.object({
  scheduledFor: z.string().min(1, 'Choose the new visit date and time').refine((value) => !Number.isNaN(Date.parse(value)), 'Enter a valid date and time'),
})

function RescheduleForm({ detail, onCancel, onDone }: StepProps) {
  const current = detail.activeWorkOrder
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof rescheduleSchema>>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { scheduledFor: current?.scheduledFor ? toDateTimeLocal(current.scheduledFor) : defaultVisitTime() },
  })
  const submit = handleSubmit(async (values) => {
    try {
      await rescheduleWorkOrder(detail.request.id, new Date(values.scheduledFor).toISOString())
      toast.success('Visit rescheduled', { description: formatDateTime(new Date(values.scheduledFor).toISOString()) })
      onDone()
    } catch (error) {
      applyError(error, setError, ['scheduledFor'])
    }
  })
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Reschedule visit</DialogTitle>
        <DialogDescription>New visit time for {detail.vendor?.name ?? 'the vendor'}.</DialogDescription>
      </DialogHeader>
      <RootError message={errors.root?.message} />
      <FormField label="Visit" required error={errors.scheduledFor?.message}>
        {(field) => <Input {...field} {...register('scheduledFor')} type="datetime-local" />}
      </FormField>
      <Footer onCancel={onCancel} pending={isSubmitting} label="Save visit" />
    </form>
  )
}

/* ------------------------------------------------------------------- hold */

const holdSchema = z.object({
  reason: z.enum(HOLD_REASONS, { error: 'Choose a reason' }),
  note: z.string().trim().max(200, 'Keep the note under 200 characters'),
})

function HoldForm({ detail, onCancel, onDone }: StepProps) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof holdSchema>>({ resolver: zodResolver(holdSchema), defaultValues: { reason: 'parts', note: '' } })
  const submit = handleSubmit(async (values) => {
    try {
      await holdRequest(detail.request.id, values.reason as HoldReason, values.note)
      toast.success('Request on hold', { description: HOLD_REASON_LABELS[values.reason] })
      onDone()
    } catch (error) {
      applyError(error, setError, [])
    }
  })
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Put on hold</DialogTitle>
        <DialogDescription>The work order is kept. The resolution target keeps running while the request is on hold.</DialogDescription>
      </DialogHeader>
      <RootError message={errors.root?.message} />
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
                  {HOLD_REASONS.map((reason) => (
                    <SelectItem key={reason} value={reason}>
                      {HOLD_REASON_LABELS[reason]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        )}
      />
      <FormField label="Note" error={errors.note?.message} hint="Optional. Shown on the request.">
        {(field) => <Input {...field} {...register('note')} placeholder="e.g. Valve on back order until Friday" />}
      </FormField>
      <Footer onCancel={onCancel} pending={isSubmitting} label="Put on hold" />
    </form>
  )
}

/* ------------------------------------------------- unit return question */

/**
 * Explicit "Return the unit to Vacant?" question shown when closing a request
 * for a unit under maintenance. There is no default: the user must choose.
 */
function UnitReturnQuestion({
  detail,
  value,
  onChange,
  error,
}: {
  detail: RequestDetail
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const { unitReturn } = detail
  if (!unitReturn.applicable) return null
  const name = unitName(detail)
  if (!unitReturn.allowed) {
    return (
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-caption text-muted-foreground">
        {name} stays under maintenance: {unitReturn.reason ?? 'it can’t be returned right now.'}
      </p>
    )
  }
  return (
    <fieldset aria-describedby={error ? 'unit-return-error' : undefined}>
      <legend className="mb-2 text-label text-foreground">
        {name} is under maintenance. Return it to Vacant?
        <span className="ml-1 text-danger" aria-hidden="true">
          *
        </span>
      </legend>
      <RadioGroup value={value} onValueChange={onChange} aria-label={`Return ${name} to Vacant?`} aria-required className="grid gap-2">
        {(
          [
            { value: 'yes', title: `Yes, return ${name} to Vacant`, note: 'It can be leased again.' },
            { value: 'no', title: 'No, keep it under maintenance', note: 'The unit status stays as it is.' },
          ] as const
        ).map((option) => (
          <label
            key={option.value}
            htmlFor={`unit-return-${option.value}`}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/50',
              value === option.value && 'border-primary bg-accent/50 ring-1 ring-primary',
            )}
          >
            <RadioGroupItem id={`unit-return-${option.value}`} value={option.value} className="mt-0.5" />
            <span className="flex flex-col">
              <span className="text-body font-medium text-foreground">{option.title}</span>
              <span className="text-caption text-muted-foreground">{option.note}</span>
            </span>
          </label>
        ))}
      </RadioGroup>
      {error ? (
        <p id="unit-return-error" className="mt-1.5 text-caption font-medium text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}

/** The answer must be explicit when the question is asked. */
const unitAnswer = (detail: RequestDetail) =>
  z.string().refine((value) => !(detail.unitReturn.applicable && detail.unitReturn.allowed) || value === 'yes' || value === 'no', {
    message: 'Choose whether the unit returns to Vacant',
  })

/* --------------------------------------------------------------- complete */

function completeSchema(detail: RequestDetail) {
  const today = todayIso()
  const orderDate = detail.activeWorkOrder ? toIsoDate(new Date(detail.activeWorkOrder.createdAt)) : today
  return z.object({
    completedOn: z
      .string()
      .min(1, 'Choose the completion date')
      .refine((value) => value <= today, 'The completion date can’t be in the future')
      .refine((value) => value >= orderDate, `The completion date can’t be before the work order (${formatDate(orderDate)})`),
    actualCost: z.number({ error: 'Enter the cost as a number' }).min(0, 'The cost can’t be negative').max(1_000_000, 'The cost looks too large').nullable(),
    notes: z.string().trim().max(500, 'Keep notes under 500 characters'),
    returnUnit: unitAnswer(detail),
  })
}

function CompleteForm({ detail, onCancel, onDone }: StepProps) {
  const schema = completeSchema(detail)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { completedOn: todayIso(), actualCost: detail.activeWorkOrder?.estimatedCost ?? null, notes: '', returnUnit: '' },
  })
  const submit = handleSubmit(async (values) => {
    try {
      await completeRequest(detail.request.id, {
        completedOn: values.completedOn,
        actualCost: values.actualCost,
        notes: values.notes,
        returnUnitToVacant: values.returnUnit === 'yes',
      })
      toast.success('Request completed', {
        description: values.returnUnit === 'yes' ? `${unitName(detail)} is vacant again.` : detail.request.id,
      })
      onDone()
    } catch (error) {
      applyError(error, setError, ['completedOn', 'actualCost'])
    }
  })
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Complete request</DialogTitle>
        <DialogDescription>
          Record the finished work by {detail.vendor?.name ?? 'the vendor'}. The work order keeps its final cost and date.
        </DialogDescription>
      </DialogHeader>
      <RootError message={errors.root?.message} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Completed on" required error={errors.completedOn?.message}>
          {(field) => <Input {...field} {...register('completedOn')} type="date" max={todayIso()} />}
        </FormField>
        <FormField label="Final cost" error={errors.actualCost?.message} hint="Optional. Not an invoice.">
          {(field) => <CurrencyInput {...field} {...register('actualCost', { setValueAs: toNullableNumber })} />}
        </FormField>
      </div>
      <FormField label="Completion notes" error={errors.notes?.message} hint="Optional">
        {(field) => <Textarea {...field} {...register('notes')} rows={2} placeholder="e.g. Replaced the cartridge and tested" />}
      </FormField>
      <Controller
        control={control}
        name="returnUnit"
        render={({ field, fieldState }) => (
          <UnitReturnQuestion detail={detail} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <Footer onCancel={onCancel} pending={isSubmitting} label="Complete request" />
    </form>
  )
}

/* ----------------------------------------------------------------- cancel */

function cancelSchema(detail: RequestDetail) {
  return z.object({
    reason: z.string().trim().min(3, 'Say why the request is cancelled').max(200, 'Keep the reason under 200 characters'),
    returnUnit: unitAnswer(detail),
  })
}

function CancelForm({ detail, onCancel, onDone }: StepProps) {
  const schema = cancelSchema(detail)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { reason: '', returnUnit: '' } })
  const submit = handleSubmit(async (values) => {
    try {
      await cancelRequest(detail.request.id, { reason: values.reason, returnUnitToVacant: values.returnUnit === 'yes' })
      toast.success('Request cancelled', { description: detail.request.id })
      onDone()
    } catch (error) {
      applyError(error, setError, ['reason'])
    }
  })
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Cancel request</DialogTitle>
        <DialogDescription>
          Cancelling is final: the request can’t be reopened or changed afterwards.
          {detail.activeWorkOrder ? ` ${detail.vendor?.name ?? 'The vendor'}’s work order is cancelled and kept in the history.` : ''}
        </DialogDescription>
      </DialogHeader>
      <RootError message={errors.root?.message} />
      <FormField label="Reason" required error={errors.reason?.message}>
        {(field) => <Input {...field} {...register('reason')} placeholder="e.g. Duplicate of MR-2058" />}
      </FormField>
      <Controller
        control={control}
        name="returnUnit"
        render={({ field, fieldState }) => (
          <UnitReturnQuestion detail={detail} value={field.value} onChange={field.onChange} error={fieldState.error?.message} />
        )}
      />
      <Footer onCancel={onCancel} pending={isSubmitting} label="Cancel request" cancelLabel="Keep request" destructive />
    </form>
  )
}

/* ----------------------------------------------------------------- reopen */

const reopenSchema = z.object({ reason: z.string().trim().min(3, 'Say why the request is reopened').max(200, 'Keep the reason under 200 characters') })

function ReopenForm({ detail, onCancel, onDone }: StepProps) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof reopenSchema>>({ resolver: zodResolver(reopenSchema), defaultValues: { reason: '' } })
  const until = detail.request.completedAt ? new Date(Date.parse(detail.request.completedAt) + REOPEN_WINDOW_DAYS * 86_400_000) : null
  const submit = handleSubmit(async (values) => {
    try {
      await reopenRequest(detail.request.id, values.reason)
      toast.success('Request reopened', { description: `${detail.request.id} has a new resolution target.` })
      onDone()
    } catch (error) {
      applyError(error, setError, ['reason'])
    }
  })
  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-5">
      <DialogHeader>
        <DialogTitle>Reopen request</DialogTitle>
        <DialogDescription>
          The request goes back to Open with a new resolution target. The completed work order stays in the history.
          {until ? ` Reopening is possible until ${formatDate(toIsoDate(until))}.` : ''}
        </DialogDescription>
      </DialogHeader>
      <RootError message={errors.root?.message} />
      <FormField label="Reason" required error={errors.reason?.message}>
        {(field) => <Input {...field} {...register('reason')} placeholder="e.g. The leak came back" />}
      </FormField>
      <Footer onCancel={onCancel} pending={isSubmitting} label="Reopen request" />
    </form>
  )
}

/* ---------------------------------------------------------- confirmations */

function ConfirmStep({ detail, onCancel, onDone, action }: StepProps & { action: 'start' | 'resume' }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const copy: Record<typeof action, { title: string; body: ReactNode; label: string; toast: string }> = {
    start: {
      title: 'Start work',
      body: `${detail.vendor?.name ?? 'The vendor'} has started on site. The request moves to In progress.`,
      label: 'Start work',
      toast: 'Work started',
    },
    resume: {
      title: 'Resume work',
      body: `The request goes back to ${detail.request.hold?.from === 'in-progress' ? 'In progress' : 'Scheduled'}.`,
      label: 'Resume',
      toast: 'Work resumed',
    },
  }
  const step = copy[action]

  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await (action === 'start' ? startWork(detail.request.id) : resumeRequest(detail.request.id))
      toast.success(step.toast, { description: detail.request.id })
      onDone()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
      setPending(false)
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void confirm()
      }}
      className="flex flex-col gap-5"
    >
      <DialogHeader>
        <DialogTitle>{step.title}</DialogTitle>
        <DialogDescription>{step.body}</DialogDescription>
      </DialogHeader>
      <RootError message={error ?? undefined} />
      <Footer onCancel={onCancel} pending={pending} label={step.label} />
    </form>
  )
}
