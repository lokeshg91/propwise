import { LoaderCircle } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface StaffConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  /** Optional reason saved in the member's activity. */
  withNote?: { label: string; placeholder: string }
  onConfirm: (note: string) => Promise<void> | void
  /** Hide the confirm button when the change isn't allowed (the description says why). */
  hideConfirm?: boolean
}

/** Confirms a staff change. A failure shows in the dialog and nothing changes. */
export function StaffConfirmDialog({ open, onOpenChange, ...props }: StaffConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">{open ? <Body {...props} onCancel={() => onOpenChange(false)} /> : null}</DialogContent>
    </Dialog>
  )
}

function Body({ title, description, confirmLabel, cancelLabel = 'Cancel', destructive = false, withNote, onConfirm, onCancel, hideConfirm = false }: Omit<StaffConfirmDialogProps, 'open' | 'onOpenChange'> & { onCancel: () => void }) {
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        setPending(true)
        setError(null)
        void Promise.resolve()
          .then(() => onConfirm(note))
          .catch((caught: unknown) => {
            setError(caught instanceof Error ? caught.message : 'Something went wrong. Try again.')
            setPending(false)
          })
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
      {withNote ? (
        <FormField label={withNote.label} hint="Optional. Saved in the activity history.">
          {(field) => <Input {...field} value={note} onChange={(event) => setNote(event.target.value)} placeholder={withNote.placeholder} maxLength={200} />}
        </FormField>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
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
