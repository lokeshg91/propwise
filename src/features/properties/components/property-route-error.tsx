import { ArrowLeft, Building2, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { PageContainer } from '@/components/shared/page-container'
import { Button } from '@/components/ui/button'

/** Shown inside the app shell when a property can't be loaded. */
export function PropertyRouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <PageContainer className="min-h-[calc(100svh-var(--spacing-header))] justify-center">
      <EmptyState
        icon={notFound ? Building2 : TriangleAlert}
        titleAs="h1"
        eyebrow={notFound ? 'Error 404' : undefined}
        title={notFound ? 'Property not found' : 'Something went wrong'}
        description={
          notFound
            ? 'This property doesn’t exist or may have been removed from the demo data.'
            : 'We couldn’t load this property. Please try again.'
        }
        actions={
          <Button variant="outline" asChild>
            <Link to="/properties">
              <ArrowLeft data-icon="inline-start" />
              Back to properties
            </Link>
          </Button>
        }
      />
    </PageContainer>
  )
}
