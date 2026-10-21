import { ArrowLeft, type LucideIcon, TriangleAlert } from 'lucide-react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { PageContainer } from '@/components/shared/page-container'
import { Button } from '@/components/ui/button'

interface RouteErrorStateProps {
  /** Icon shown for a 404. */
  icon: LucideIcon
  /** e.g. "Property". Used in "Property not found". */
  noun: string
  notFoundDescription: string
  errorDescription: string
  backTo: string
  backLabel: string
}

/** Shown inside the app shell when a record can't be loaded: 404 or a load error. */
export function RouteErrorState({ icon, noun, notFoundDescription, errorDescription, backTo, backLabel }: RouteErrorStateProps) {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  return (
    <PageContainer className="min-h-[calc(100svh-var(--spacing-header))] justify-center">
      <EmptyState
        icon={notFound ? icon : TriangleAlert}
        titleAs="h1"
        eyebrow={notFound ? 'Error 404' : undefined}
        title={notFound ? `${noun} not found` : 'Something went wrong'}
        description={notFound ? notFoundDescription : errorDescription}
        actions={
          <Button variant="outline" asChild>
            <Link to={backTo}>
              <ArrowLeft data-icon="inline-start" />
              {backLabel}
            </Link>
          </Button>
        }
      />
    </PageContainer>
  )
}
