import { ExternalLink, LoaderCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { type VendorMatch } from '@/data/domain/vendor-rules'
import { type VendorWorkOrder } from '@/data/services'
import { WorkOrderStatusBadge } from '@/features/maintenance/components/request-badges'
import { formatDateTime } from '@/features/maintenance/lib/request-time'
import { VendorStatusBadge } from '@/features/vendors/components/vendor-badges'
import { locationText } from '@/features/vendors/lib/vendor-detail'

const linkClass = 'rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

/** The open work orders affected by a deactivation, each linking to its request. */
export function OpenJobsList({ jobs }: { jobs: VendorWorkOrder[] }) {
  return (
    <ul className="flex max-h-60 flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border" aria-label="Open work orders">
      {jobs.map((entry) => (
        <li key={entry.order.id} className="flex flex-col gap-1 px-3 py-2.5">
          <span className="flex flex-wrap items-center justify-between gap-2">
            {entry.request ? (
              <Link to={`/maintenance/${entry.request.id}`} target="_blank" rel="noreferrer" className={`text-body ${linkClass}`}>
                {entry.request.title}
              </Link>
            ) : (
              <span className="text-body font-medium text-foreground">{entry.order.requestId}</span>
            )}
            <WorkOrderStatusBadge status={entry.order.status} />
          </span>
          <span className="text-caption text-muted-foreground">
            {entry.order.id} · {entry.request?.id} · {locationText(entry)}
            {entry.order.scheduledFor ? ` · visit ${formatDateTime(entry.order.scheduledFor)}` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** Existing vendors that match a name, email or phone, each easy to open (new tab, so the form isn't lost). */
export function VendorMatchList({ matches }: { matches: VendorMatch[] }) {
  const unique = matches.filter((match, index) => matches.findIndex((other) => other.vendor.id === match.vendor.id) === index)
  return (
    <ul className="flex flex-col gap-1.5">
      {unique.map((match) => (
        <li key={match.vendor.id} className="flex flex-wrap items-center gap-2">
          <Link to={`/vendors/${match.vendor.id}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 text-body ${linkClass}`}>
            {match.vendor.name}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
          <VendorStatusBadge active={match.vendor.active} />
        </li>
      ))}
    </ul>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  children?: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /** Optional note saved with the change (e.g. why a vendor is deactivated). */
  withNote?: { label: string; placeholder: string }
  onConfirm: (note: string) => Promise<void> | void
  /** Hide the confirm button (e.g. when the action isn't allowed). */
  hideConfirm?: boolean
  extraAction?: ReactNode
}

/** Shared confirm dialog with an optional note and error handling. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  withNote,
  onConfirm,
  hideConfirm = false,
  extraAction,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        {open ? (
          <ConfirmBody
            title={title}
            description={description}
            confirmLabel={confirmLabel}
            cancelLabel={cancelLabel}
            destructive={destructive}
            withNote={withNote}
            onConfirm={onConfirm}
            onCancel={() => onOpenChange(false)}
            hideConfirm={hideConfirm}
            extraAction={extraAction}
          >
            {children}
          </ConfirmBody>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ConfirmBody({
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  destructive,
  withNote,
  onConfirm,
  onCancel,
  hideConfirm,
  extraAction,
}: Omit<ConfirmDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void; cancelLabel: string }) {
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirm = async () => {
    setPending(true)
    setError(null)
    try {
      await onConfirm(note)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
      setPending(false)
    }
  }

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        void confirm()
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {error ? (
        <p role="alert" className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
          {error}
        </p>
      ) : null}
      {children}
      {withNote ? (
        <FormField label={withNote.label} hint="Optional. Saved in the vendor’s activity.">
          {(field) => <Input {...field} value={note} onChange={(event) => setNote(event.target.value)} placeholder={withNote.placeholder} maxLength={200} />}
        </FormField>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        {extraAction}
        {hideConfirm ? null : (
          <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending}>
            {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {confirmLabel}
          </Button>
        )}
      </DialogFooter>
    </form>
  )
}
