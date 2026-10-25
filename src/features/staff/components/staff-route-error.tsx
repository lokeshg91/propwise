import { UserRoundX } from 'lucide-react'

import { RouteErrorState } from '@/components/shared/route-error-state'

/** Shown inside the app shell when a staff member can't be loaded. */
export function StaffRouteError() {
  return (
    <RouteErrorState
      icon={UserRoundX}
      noun="Staff member"
      notFoundDescription="This staff member doesn’t exist or may have been deleted from the demo data."
      errorDescription="We couldn’t load this staff member. Please try again."
      backTo="/staff"
      backLabel="Back to staff"
    />
  )
}
