import { CircleAlert, CircleCheck, Download, LoaderCircle, TriangleAlert } from 'lucide-react'

import { FormField } from '@/components/forms/form-field'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { currencyName, RECORD_TYPE_LABELS, RECORD_TYPES, regionName, totalOf, type BackupInspection, type WorkspaceCounts } from '@/data/services'
import { type DownloadedBackup } from '@/features/settings/hooks/use-backup-download'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

/** Records per type, split into the sample records and the ones created in the app. */
export function RecordCountsTable({ counts, caption }: { counts: WorkspaceCounts; caption: string }) {
  const { number } = useFormat()
  return (
    <Table aria-label={caption}>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-0">Records</TableHead>
          <TableHead className="text-right">Sample</TableHead>
          <TableHead className="pr-0 text-right">Created by you</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {RECORD_TYPES.filter((type) => counts.sample[type] + counts.user[type] > 0).map((type) => (
          <TableRow key={type}>
            <TableCell className="pl-0">{RECORD_TYPE_LABELS[type]}</TableCell>
            <TableCell className="text-right tabular-nums">{number(counts.sample[type])}</TableCell>
            <TableCell className={cn('pr-0 text-right tabular-nums', counts.user[type] > 0 && 'font-semibold text-foreground')}>{number(counts.user[type])}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell className="pl-0 font-semibold">Total</TableCell>
          <TableCell className="text-right font-semibold tabular-nums">{number(totalOf(counts.sample))}</TableCell>
          <TableCell className="pr-0 text-right font-semibold tabular-nums">{number(totalOf(counts.user))}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}

/** What a backup file holds and whether it can be restored. */
export function InspectionSummary({ inspection, fileName }: { inspection: BackupInspection; fileName?: string }) {
  const { dateTime, number } = useFormat()
  return (
    <div className="flex flex-col gap-3">
      {inspection.restorable ? (
        <p role="status" className="flex items-start gap-2 rounded-lg border border-success/30 bg-success/10 p-3 text-body text-success dark:bg-success/15">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">This backup can be restored.</span>{' '}
            <span className="text-foreground/80">It passed the format, version, upgrade, Finance integrity and storage checks.</span>
          </span>
        </p>
      ) : (
        <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 p-3 text-body text-danger dark:bg-danger/15">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-medium">This file can’t be restored.</p>
            {inspection.problems.map((problem) => (
              <p key={problem} className="text-foreground/80">
                {problem}
              </p>
            ))}
          </div>
        </div>
      )}
      {inspection.warnings.map((warning) => (
        <p key={warning} className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-body text-warning dark:bg-warning/15">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="text-foreground/80">{warning}</span>
        </p>
      ))}
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-body sm:grid-cols-[auto_1fr]">
        {fileName ? (
          <>
            <dt className="text-muted-foreground">File</dt>
            <dd className="min-w-0 break-all text-foreground">{fileName}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Made</dt>
        <dd className="text-foreground">{inspection.exportedAt ? dateTime(inspection.exportedAt) : 'Unknown'}</dd>
        <dt className="text-muted-foreground">Propwise version</dt>
        <dd className="text-foreground">{inspection.appVersion ?? 'Unknown'}</dd>
        <dt className="text-muted-foreground">Saved-data version</dt>
        <dd className="text-foreground">
          {inspection.savedDataVersion ?? 'Unknown'}
          {inspection.needsUpgrade ? <span className="text-muted-foreground"> · upgraded to the current version when restored</span> : null}
        </dd>
        {inspection.settings ? (
          <>
            <dt className="text-muted-foreground">Currency and region</dt>
            <dd className="text-foreground">
              {currencyName(inspection.settings.currency)} ({inspection.settings.currency}) · {regionName(inspection.settings.locale)}
            </dd>
          </>
        ) : null}
        {inspection.source === 'sample' ? (
          <>
            <dt className="text-muted-foreground">Contents</dt>
            <dd className="text-foreground">The sample workspace (nothing had been saved yet)</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">File size</dt>
        <dd className="text-foreground tabular-nums">{number(Math.round(inspection.fileChars / 1024))} KB</dd>
      </dl>
      {inspection.counts ? <RecordCountsTable counts={inspection.counts} caption="Records in this backup" /> : null}
    </div>
  )
}

/** The required "download a backup of the current workspace" step in the restore and reset dialogs. */
export function BackupStep({
  step,
  downloaded,
  error,
  pending,
  onDownload,
  disabled,
}: {
  /** Step number inside a dialog; omitted for the standalone backup action. */
  step?: number
  downloaded: DownloadedBackup | null
  error: string | null
  pending: boolean
  onDownload: () => void
  disabled?: boolean
}) {
  const { time } = useFormat()
  return (
    <section aria-label={step ? `Step ${step}: back up the current workspace` : 'Back up this workspace'} className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-label text-foreground">{step ? `${step}. Download a backup of this workspace` : 'Download a backup of this workspace'}</p>
          <p className="text-caption text-muted-foreground">{step ? 'Required. Keep the file: it’s how you get this data back.' : 'Saved as a .json file by your browser. Nothing changes in the workspace.'}</p>
        </div>
        <Button type="button" variant={downloaded ? 'outline' : 'default'} onClick={onDownload} disabled={pending || disabled} className="shrink-0">
          {pending ? <LoaderCircle className="animate-spin" data-icon="inline-start" /> : <Download data-icon="inline-start" />}
          {downloaded ? 'Download again' : 'Download backup'}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="flex items-start gap-2 text-caption font-medium text-danger">
          <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden="true" />
          {error}
        </p>
      ) : null}
      {downloaded ? (
        <div role="status" className="flex flex-col gap-1 text-caption">
          <p className="flex items-start gap-1.5 font-medium text-success">
            <CircleCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            Downloaded {downloaded.fileName} at {time(downloaded.at)}.
          </p>
          {downloaded.inspection.restorable ? (
            <p className="text-muted-foreground">Checked: this file can be restored.</p>
          ) : (
            <p className="text-warning">
              This file keeps your saved data exactly as stored, but this version can’t restore it: {downloaded.inspection.problems[0] ?? 'it didn’t pass the checks.'} Keep it anyway.
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}

/** Typed confirmation, e.g. RESET. Matching is exact (capitals). */
export function ConfirmWordField({ step, word, value, onChange, disabled }: { step: number; word: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const matches = value.trim() === word
  return (
    <section aria-label={`Step ${step}: confirm`} className="flex flex-col gap-2 rounded-lg border border-border p-4">
      <FormField label={`${step}. Type ${word} to confirm`} hint={matches ? 'Confirmed.' : `Type ${word} in capital letters.`}>
        {(field) => <Input {...field} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="off" spellCheck={false} disabled={disabled} className="max-w-56 font-mono" />}
      </FormField>
    </section>
  )
}
