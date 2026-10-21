import { ArrowLeft, Compass } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { PageContainer } from '@/components/shared/page-container'
import { Button } from '@/components/ui/button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <PageContainer className="min-h-[calc(100svh-var(--spacing-header))] justify-center">
      <EmptyState
        icon={Compass}
        titleAs="h1"
        eyebrow="Error 404"
        title="Page not found"
        description="The page you’re looking for doesn’t exist or may have been moved. Check the address or head back to your overview."
        actions={
          <>
            <Button variant="outline" onClick={() => void navigate(-1)}>
              <ArrowLeft data-icon="inline-start" />
              Go back
            </Button>
            <Button asChild>
              <Link to="/dashboard">Go to overview</Link>
            </Button>
          </>
        }
      />
    </PageContainer>
  )
}
