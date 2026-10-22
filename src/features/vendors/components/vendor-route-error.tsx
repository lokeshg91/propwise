import { UserRoundX } from 'lucide-react'

import { RouteErrorState } from '@/components/shared/route-error-state'

/** Shown inside the app shell when a vendor can't be loaded. */
export function VendorRouteError() {
  return (
    <RouteErrorState
      icon={UserRoundX}
      noun="Vendor"
      notFoundDescription="This vendor doesn’t exist or may have been deleted from the demo data."
      errorDescription="We couldn’t load this vendor. Please try again."
      backTo="/vendors"
      backLabel="Back to vendors"
    />
  )
}
