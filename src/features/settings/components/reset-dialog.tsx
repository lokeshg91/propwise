import { LoaderCircle, OctagonAlert } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { resetWorkspaceData, totalOf, type WorkspaceChangeResult, type WorkspaceSummary } from '@/data/services'
import { BackupStep, ConfirmWordField, RecordCountsTable } from '@/features/settings/components/backup-parts'
import { SaveError } from '@/features/settings/components/settings-card'
import { useBackupDownload } from '@/features/settings/hooks/use-backup-download'
import { useFormat } from '@/hooks/use-format'

const WORD = 'RESET'

/**
 * Full workspace reset. Shows what will be deleted (sample and created
 * records), requires a backup download, then the word RESET. Success is
 * shown only once the fresh sample workspace is saved; on failure nothing
 * changes.
 */
export function ResetDialog({ summary, onClose, onReset }: { summary: WorkspaceSummary; onClose: () => void; onReset: (result: WorkspaceChangeResult) => void }) {
  const backup = useBackupDownload()
  const [word, setWord] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { number } = useFormat()
  const ready = backup.downloaded !== null && word.trim() === WORD
  const created = summary.counts ? totalOf(summary.counts.user) : null

  const reset = async () => {
    setPending(true)
    setError(null)
    try {
      onReset(await resetWorkspaceData())
    } catch (caught) {
      setError(`Nothing was deleted. ${caught instanceof Error ? caught.message : String(caught)}`)
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reset the whole workspace?</DialogTitle>
          <DialogDescription>Deletes every record in this browser and restores the original sample workspace.</DialogDescription>
        </DialogHeader>
        <div role="note" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-body text-danger dark:bg-danger/15">
          <OctagonAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div className="flex flex-col gap-1 text-foreground/85">
            <p>
              <span className="font-medium text-danger">All data in this browser will be deleted</span>, including properties, units, tenants, leases, maintenance requests and work orders, vendors, charges,
              payments, bills, recurring charges, activity history and workspace settings (currency, region, payment terms, rule versions).
            </p>
            <p>
              {created === null
                ? 'Your saved data couldn’t be read in this session, so its records can’t be counted. They are in the backup below.'
                : created > 0
                  ? `This includes ${number(created)} ${created === 1 ? 'record' : 'records'} you created. They can’t be recovered without a backup.`
                  : 'Changes you made to sample records are lost too.'}{' '}
              Your theme and sidebar preferences are kept.
            </p>
          </div>
        </div>
        {summary.counts ? <RecordCountsTable counts={summary.counts} caption="Records that will be deleted" /> : null}
        <BackupStep step={1} downloaded={backup.downloaded} error={backup.error} pending={backup.pending} onDownload={backup.download} disabled={pending} />
        <ConfirmWordField step={2} word={WORD} value={word} onChange={setWord} disabled={pending} />
        <SaveError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!ready || pending} onClick={() => void reset()}>
            {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {pending ? 'Resetting…' : 'Delete everything and reset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
