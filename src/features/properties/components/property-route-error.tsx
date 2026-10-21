import { Building2 } from 'lucide-react'

import { RouteErrorState } from '@/components/shared/route-error-state'

/** Shown inside the app shell when a property can't be loaded. */
export function PropertyRouteError() {
  return (
    <RouteErrorState
      icon={Building2}
      noun="Property"
      notFoundDescription="This property doesn’t exist or may have been removed from the demo data."
      errorDescription="We couldn’t load this property. Please try again."
      backTo="/properties"
      backLabel="Back to properties"
    />
  )
}
