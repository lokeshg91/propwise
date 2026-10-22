import { CircleAlert, ExternalLink, LoaderCircle, TriangleAlert } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { isFinanceDuplicateError } from '@/data/services'

export interface DuplicateMatch {
  id: string
  reference: string
}

/** Links to records that look like duplicates, opening in a new tab so the form isn't lost. */
export function DuplicateMatches({ matches }: { matches: DuplicateMatch[] }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {matches.map((match) => (
        <li key={match.id}>
          <Link to={`/finance/transactions/${match.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline">
            {match.reference}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

interface ActionDialogProps {
  title: string
  description: ReactNode
  children?: ReactNode
  submitLabel: string
  destructive?: boolean
  submitDisabled?: boolean
  onClose: () => void
  /** Saves. Throw to keep the dialog open with the error; a possible duplicate asks for confirmation first. */
  onSubmit: (acknowledgeDuplicate: boolean) => Promise<void>
}

/**
 * Dialog for one Finance action. Nothing changes on screen until the save
 * has succeeded: errors (including storage failures) stay in the dialog and
 * no success message is shown.
 */
export function ActionDialog({ title, description, children, submitLabel, destructive = false, submitDisabled = false, onClose, onSubmit }: ActionDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{ message: string; matches?: DuplicateMatch[] } | null>(null)
  const [duplicate, setDuplicate] = useState<{ message: string; matches: DuplicateMatch[] } | null>(null)

  const submit = async () => {
    setPending(true)
    setError(null)
    try {
      await onSubmit(duplicate !== null)
    } catch (caught) {
      if (isFinanceDuplicateError(caught) && caught.requiresConfirmation && !duplicate) setDuplicate({ message: caught.message, matches: caught.matches })
      else setError({ message: caught instanceof Error ? caught.message : 'Something went wrong. Try again.', ...(isFinanceDuplicateError(caught) ? { matches: caught.matches } : {}) })
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-lg">
        <form
          noValidate
          className="flex flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {error ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-body text-danger dark:bg-danger/15">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-1">
                <p>{error.message}</p>
                {error.matches?.length ? <DuplicateMatches matches={error.matches} /> : null}
              </div>
            </div>
          ) : null}
          {duplicate ? (
            <div role="status" className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-body text-warning dark:bg-warning/15">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-1">
                <p className="font-medium">Possible duplicate</p>
                <p className="text-foreground/80">{duplicate.message} Check it isn’t the same record, then save anyway.</p>
                <DuplicateMatches matches={duplicate.matches} />
              </div>
            </div>
          ) : null}
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending || submitDisabled}>
              {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
              {duplicate ? 'Save anyway' : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
