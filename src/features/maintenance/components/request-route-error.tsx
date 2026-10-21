import { ClipboardX } from 'lucide-react'

import { RouteErrorState } from '@/components/shared/route-error-state'

/** Shown inside the app shell when a maintenance request can't be loaded. */
export function RequestRouteError() {
  return (
    <RouteErrorState
      icon={ClipboardX}
      noun="Request"
      notFoundDescription="This maintenance request doesn’t exist or may have been removed from the demo data."
      errorDescription="We couldn’t load this request. Please try again."
      backTo="/maintenance"
      backLabel="Back to maintenance"
    />
  )
}
