import { LoaderCircle, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { restoreBackup, type BackupInspection, type WorkspaceChangeResult } from '@/data/services'
import { BackupStep, ConfirmWordField, InspectionSummary } from '@/features/settings/components/backup-parts'
import { SaveError } from '@/features/settings/components/settings-card'
import { useBackupDownload } from '@/features/settings/hooks/use-backup-download'

const WORD = 'RESTORE'

/**
 * Restore from a backup file. The current workspace must be backed up first
 * and the user types RESTORE. The restore checks the file again in full and
 * replaces the workspace in one save; until that save has succeeded nothing
 * changes and no success message appears.
 */
export function RestoreDialog({
  text,
  fileName,
  inspection,
  onClose,
  onRestored,
}: {
  text: string
  fileName: string
  inspection: BackupInspection
  onClose: () => void
  onRestored: (result: WorkspaceChangeResult) => void
}) {
  const backup = useBackupDownload()
  const [word, setWord] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = backup.downloaded !== null && word.trim() === WORD && inspection.restorable

  const restore = async () => {
    setPending(true)
    setError(null)
    try {
      const result = await restoreBackup(text)
      onRestored(result)
    } catch (caught) {
      setError(`Nothing was changed. ${caught instanceof Error ? caught.message : String(caught)}`)
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Restore from backup</DialogTitle>
          <DialogDescription>Replaces everything in this browser with the backup: properties, tenants, leases, maintenance, vendors, Finance records, staff, workspace settings and your profile.</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-body text-warning dark:bg-warning/15">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="text-foreground/85">
            <span className="font-medium text-foreground">Everything currently in this browser will be replaced</span>, including records you created. Back it up first so you can return to it. Your theme and sidebar stay as they are.
          </p>
        </div>
        <InspectionSummary inspection={inspection} fileName={fileName} />
        <BackupStep step={1} downloaded={backup.downloaded} error={backup.error} pending={backup.pending} onDownload={backup.download} disabled={pending} />
        <ConfirmWordField step={2} word={WORD} value={word} onChange={setWord} disabled={pending} />
        <SaveError message={error} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={!ready || pending} onClick={() => void restore()}>
            {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : null}
            {pending ? 'Restoring…' : 'Replace workspace with backup'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
