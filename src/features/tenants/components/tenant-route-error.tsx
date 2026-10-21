import { UserRoundX } from 'lucide-react'

import { RouteErrorState } from '@/components/shared/route-error-state'

/** Shown inside the app shell when a tenant can't be loaded. */
export function TenantRouteError() {
  return (
    <RouteErrorState
      icon={UserRoundX}
      noun="Tenant"
      notFoundDescription="This tenant doesn’t exist or may have been removed from the demo data."
      errorDescription="We couldn’t load this tenant. Please try again."
      backTo="/tenants"
      backLabel="Back to tenants"
    />
  )
}
