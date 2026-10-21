import { RefreshCw, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, useRouteError } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'

/** Catches errors thrown while rendering or loading a route. */
export function RouteErrorBoundary() {
  const error = useRouteError()
  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : 'An unexpected error occurred.'

  return (
    <div className="flex min-h-svh items-center justify-center bg-background px-4">
      <EmptyState
        icon={TriangleAlert}
        titleAs="h1"
        title="Something went wrong"
        description={message}
        actions={
          <Button onClick={() => window.location.reload()}>
            <RefreshCw data-icon="inline-start" />
            Reload page
          </Button>
        }
      />
    </div>
  )
}
