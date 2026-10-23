import { useCallback, useState } from 'react'

import { inspectBackup, prepareBackupDownload, type BackupInspection } from '@/data/services'
import { downloadTextFile } from '@/lib/download'

export interface DownloadedBackup {
  fileName: string
  at: string
  /** The downloaded file, checked on its own: a download alone isn't proof it can be restored. */
  inspection: BackupInspection
}

/**
 * Downloads a backup of this browser's workspace (the saved data exactly as
 * stored) and checks the file that was produced. Nothing in the workspace
 * changes. The browser can't report whether the user kept the file, so the
 * step counts as done once the download was handed to the browser.
 */
export function useBackupDownload() {
  const [downloaded, setDownloaded] = useState<DownloadedBackup | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const download = useCallback(() => {
    setPending(true)
    setError(null)
    try {
      const { fileName, contents, backup } = prepareBackupDownload()
      downloadTextFile(fileName, contents)
      const result = { fileName, at: backup.exportedAt, inspection: inspectBackup(contents) }
      setDownloaded(result)
      return result
    } catch (caught) {
      setDownloaded(null)
      setError(`The backup couldn’t be downloaded: ${caught instanceof Error ? caught.message : String(caught)}`)
      return null
    } finally {
      setPending(false)
    }
  }, [])

  return { downloaded, error, pending, download }
}
