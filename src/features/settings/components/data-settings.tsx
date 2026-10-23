import { FileUp, HardDrive, History, RotateCcw, Upload } from 'lucide-react'
import { useRef, useState, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { StatusAlert } from '@/components/shared/status-alert'
import { Button } from '@/components/ui/button'
import { inspectBackup, totalOf, type BackupInspection, type WorkspaceSettings, type WorkspaceSummary } from '@/data/services'
import { getStorageStatus, STORAGE_THRESHOLDS, subscribeStorageStatus } from '@/data/store/demo-store'
import { BackupStep, InspectionSummary, RecordCountsTable } from '@/features/settings/components/backup-parts'
import { ResetDialog } from '@/features/settings/components/reset-dialog'
import { RestoreDialog } from '@/features/settings/components/restore-dialog'
import { SaveError, SettingsCard } from '@/features/settings/components/settings-card'
import { SETTINGS_TAB_LABELS } from '@/features/settings/lib/settings-tabs'
import { useBackupDownload } from '@/features/settings/hooks/use-backup-download'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

/** Largest backup file read; anything bigger can't fit in this browser's storage anyway. */
const MAX_FILE_BYTES = 20 * 1024 * 1024

/** Data & storage: usage, backup, check and restore a backup, full reset and the settings history. */
export function DataSettings({ settings, summary, onChanged }: { settings: WorkspaceSettings; summary: WorkspaceSummary; onChanged: () => void }) {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <StorageCard summary={summary} />
      <BackupCard />
      <RestoreCard onChanged={onChanged} />
      <SettingsHistory settings={settings} />
      <ResetCard summary={summary} onChanged={onChanged} />
    </div>
  )
}

function StorageCard({ summary }: { summary: WorkspaceSummary }) {
  const status = useSyncExternalStore(subscribeStorageStatus, getStorageStatus, getStorageStatus)
  const { number } = useFormat()
  const percent = Math.min(status.usage * 100, 100)
  const tone = status.level === 'critical' ? 'bg-danger' : status.level === 'warning' ? 'bg-warning' : 'bg-primary'
  const records = summary.counts ? totalOf(summary.counts.sample) + totalOf(summary.counts.user) : null
  return (
    <SettingsCard title="Browser storage" description="Propwise keeps everything in this browser. Nothing is uploaded.">
      {status.mode === 'suspended' ? (
        <StatusAlert tone="danger" icon={HardDrive} title="Read-only session">
          Your saved data couldn’t be upgraded, so nothing is saved in this session. Download a backup to keep it, then restore a backup or reset the workspace.
        </StatusAlert>
      ) : null}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-h2 text-foreground tabular-nums">{Math.round(percent)}%</span>
          <span className="text-caption text-muted-foreground tabular-nums">
            {number(status.usedChars)} of {number(status.limitChars)} characters
          </span>
        </div>
        <div
          role="meter"
          aria-label="Browser storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-valuetext={`${Math.round(percent)}% used`}
          className="relative h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn('h-full rounded-full transition-[width]', tone)} style={{ width: `${percent}%` }} />
          {[STORAGE_THRESHOLDS.warning, STORAGE_THRESHOLDS.critical, STORAGE_THRESHOLDS.refuse].map((mark) => (
            <span key={mark} className="absolute inset-y-0 w-px bg-foreground/30" style={{ left: `${mark * 100}%` }} aria-hidden="true" />
          ))}
        </div>
        <p className="text-caption text-muted-foreground">
          A notice appears at {STORAGE_THRESHOLDS.warning * 100}% and {STORAGE_THRESHOLDS.critical * 100}%. Saving stops at {STORAGE_THRESHOLDS.refuse * 100}%, so a save never fails half-way.
        </p>
      </div>
      {records !== null ? <p className="text-body text-muted-foreground">{number(records)} records in this workspace.</p> : null}
    </SettingsCard>
  )
}

function BackupCard() {
  const backup = useBackupDownload()
  return (
    <SettingsCard
      title="Backup"
      description="Downloads a JSON file with your saved data exactly as stored, plus the Propwise and saved-data versions. The file stays with you; keep it somewhere safe."
    >
      <BackupStep
        downloaded={backup.downloaded}
        error={backup.error}
        pending={backup.pending}
        onDownload={() => {
          if (backup.download()) toast.success('Backup downloaded', { description: 'Nothing in the workspace changed.' })
        }}
      />
      <p className="text-caption text-muted-foreground">To check a file you downloaded earlier, use Restore from backup below: it shows what the file holds before anything changes.</p>
    </SettingsCard>
  )
}

function RestoreCard({ onChanged }: { onChanged: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<{ name: string; text: string; inspection: BackupInspection } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [restoring, setRestoring] = useState(false)

  const choose = async (chosen: File | undefined) => {
    if (!chosen) return
    setError(null)
    setFile(null)
    if (chosen.size > MAX_FILE_BYTES) {
      setError('This file is too large to be a Propwise backup that fits in this browser.')
      return
    }
    setReading(true)
    try {
      const text = await chosen.text()
      setFile({ name: chosen.name, text, inspection: inspectBackup(text) })
    } catch {
      setError('The file couldn’t be read.')
    } finally {
      setReading(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <SettingsCard
      title="Restore from backup"
      description="Choose a Propwise backup file to check what it holds. Checking changes nothing; restoring replaces the whole workspace in this browser, after you back up the current one."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input ref={input} type="file" accept=".json,application/json" className="sr-only" aria-label="Backup file" onChange={(event) => void choose(event.target.files?.[0])} />
        <Button type="button" variant="outline" onClick={() => input.current?.click()} disabled={reading}>
          <FileUp data-icon="inline-start" />
          {reading ? 'Checking…' : file ? 'Choose another file' : 'Choose backup file'}
        </Button>
        <p className="text-caption text-muted-foreground">Backups from Propwise 0.7 and later are upgraded when restored.</p>
      </div>
      <SaveError message={error} />
      {file ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border p-4">
          <InspectionSummary inspection={file.inspection} fileName={file.name} />
          {file.inspection.restorable ? (
            <Button type="button" variant="destructive" className="self-start" onClick={() => setRestoring(true)}>
              <Upload data-icon="inline-start" />
              Restore this backup…
            </Button>
          ) : null}
        </div>
      ) : null}
      {file && restoring ? (
        <RestoreDialog
          text={file.text}
          fileName={file.name}
          inspection={file.inspection}
          onClose={() => setRestoring(false)}
          onRestored={(result) => {
            setRestoring(false)
            setFile(null)
            toast.success('Workspace restored', {
              description: `${totalOf(result.counts.sample) + totalOf(result.counts.user)} records${result.restoredFromVersion !== null && result.restoredFromVersion < 6 ? `, upgraded from saved-data version ${result.restoredFromVersion}` : ''}.`,
            })
            onChanged()
          }}
        />
      ) : null}
    </SettingsCard>
  )
}

function ResetCard({ summary, onChanged }: { summary: WorkspaceSummary; onChanged: () => void }) {
  const [open, setOpen] = useState(false)
  const { number } = useFormat()
  const created = summary.counts ? totalOf(summary.counts.user) : null
  return (
    <SettingsCard tone="danger" title="Reset workspace" description="Deletes everything in this browser, including records you created, and restores the original sample workspace.">
      {summary.counts ? (
        <details className="group rounded-lg border border-border p-4">
          <summary className="cursor-pointer text-body font-medium text-foreground">
            What’s in this workspace: {number(totalOf(summary.counts.sample))} sample records, {number(created ?? 0)} created by you
          </summary>
          <div className="mt-3">
            <RecordCountsTable counts={summary.counts} caption="Records in this workspace" />
          </div>
        </details>
      ) : (
        <p className="text-body text-muted-foreground">Records can’t be counted in a read-only session.</p>
      )}
      <Button type="button" variant="destructive" className="self-start" onClick={() => setOpen(true)}>
        <RotateCcw data-icon="inline-start" />
        Reset workspace…
      </Button>
      {open ? (
        <ResetDialog
          summary={summary}
          onClose={() => setOpen(false)}
          onReset={() => {
            setOpen(false)
            toast.success('Workspace reset', { description: 'The sample workspace is saved. Your backup file has your previous data.' })
            onChanged()
          }}
        />
      ) : null}
    </SettingsCard>
  )
}

function SettingsHistory({ settings }: { settings: WorkspaceSettings }) {
  const { dateTime } = useFormat()
  return (
    <SettingsCard title="Settings history" description="Every settings change in this workspace, newest first. Entries keep the values as they read at the time.">
      {settings.events.length === 0 ? (
        <EmptyState size="sm" icon={History} title="No changes yet" description="Changes to currency, region, payment terms, the report period and rules appear here." />
      ) : (
        <ol aria-label="Settings history" className="flex flex-col divide-y divide-border">
          {settings.events.map((event) => (
            <li key={event.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-body font-medium text-foreground">
                  {event.title} <span className="text-caption font-normal text-muted-foreground">· {SETTINGS_TAB_LABELS[event.section]}</span>
                </p>
                <time dateTime={event.createdAt} className="text-caption text-muted-foreground">
                  {dateTime(event.createdAt)}
                </time>
              </div>
              {event.before !== undefined || event.after !== undefined ? (
                <p className="text-body text-foreground/85">
                  <span className="text-muted-foreground">{event.before ?? '—'}</span>
                  <span className="mx-1.5 text-muted-foreground" aria-hidden="true">
                    →
                  </span>
                  <span className="sr-only">changed to</span>
                  {event.after ?? '—'}
                </p>
              ) : null}
              <p className="text-caption text-muted-foreground">{event.description}</p>
            </li>
          ))}
        </ol>
      )}
    </SettingsCard>
  )
}
