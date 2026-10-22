import { CircleAlert, HardDrive, OctagonX } from 'lucide-react'
import { type ReactNode, useState, useSyncExternalStore } from 'react'

import { StatusAlert } from '@/components/shared/status-alert'
import { Button } from '@/components/ui/button'
import { getStorageStatus, STORAGE_THRESHOLDS, subscribeStorageStatus } from '@/data/store/demo-store'
import { formatPercent } from '@/lib/format'

const percent = (usage: number) => formatPercent(Math.min(usage * 100, 100), 0)
const REFUSE_AT = percent(STORAGE_THRESHOLDS.refuse)

/**
 * App-wide notice about saving, shown under the header on every page. The
 * most serious state wins: read-only session, failed save, storage almost
 * full (critical) or filling up (warning). Only the warning can be hidden,
 * and only until the level rises or the session ends.
 */
export function StorageBanner() {
  const status = useSyncExternalStore(subscribeStorageStatus, getStorageStatus, getStorageStatus)
  const [hiddenWarning, setHiddenWarning] = useState(false)

  let banner: ReactNode = null
  if (status.mode === 'suspended') {
    banner = (
      <div role="alert">
        <StatusAlert
          tone="danger"
          icon={OctagonX}
          title="Changes aren’t being saved"
          action={
            <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          Your saved data couldn’t be upgraded, so this session is read-only and every change will be refused. Your saved data is untouched. Reload the page to try again.
        </StatusAlert>
      </div>
    )
  } else if (status.lastError) {
    banner = (
      <div role="alert">
        <StatusAlert tone="danger" icon={CircleAlert} title="Your last change wasn’t saved">
          {status.lastError.message} Your previously saved data is unchanged.
          {status.level !== 'ok' ? ` Browser storage is ${percent(status.usage)} full.` : ''}
        </StatusAlert>
      </div>
    )
  } else if (status.level === 'critical') {
    banner = (
      <div role="alert">
        <StatusAlert tone="danger" icon={HardDrive} title={`Browser storage is almost full (${percent(status.usage)})`}>
          Propwise keeps everything in this browser. At {REFUSE_AT} new changes will be refused — nothing already saved is lost, but new work won’t be kept.
        </StatusAlert>
      </div>
    )
  } else if (status.level === 'warning' && !hiddenWarning) {
    banner = (
      <StatusAlert
        tone="warning"
        icon={HardDrive}
        title={`Browser storage is ${percent(status.usage)} full`}
        action={
          <Button size="sm" variant="ghost" onClick={() => setHiddenWarning(true)}>
            Hide for this session
          </Button>
        }
      >
        Propwise keeps everything in this browser. Saving stops at {REFUSE_AT}, so avoid adding large amounts of test data. Archiving older records is planned.
      </StatusAlert>
    )
  }

  if (!banner) return null
  return (
    <section aria-label="Saving status" className="mx-auto w-full max-w-content px-4 pt-4 sm:px-6 lg:px-8">
      {banner}
    </section>
  )
}
