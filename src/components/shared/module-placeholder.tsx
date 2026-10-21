import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router'

import { findNavItem } from '@/app/routes/navigation'
import { EmptyState } from '@/components/shared/empty-state'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface ModulePlaceholderProps {
  /** Path of the module as registered in the navigation config. */
  path: string
}

/**
 * Consistent placeholder for modules that are scheduled for a later release.
 * Replace a page's content with the real module when it is implemented.
 */
export function ModulePlaceholder({ path }: ModulePlaceholderProps) {
  const match = findNavItem(path)
  if (!match) throw new Error(`Unknown module "${path}"`)
  const { item } = match

  return (
    <PageContainer>
      <PageHeader
        title={item.label}
        description={item.description}
        meta={<Badge variant="neutral">Coming soon</Badge>}
      />
      <Card className="border-dashed py-0 shadow-none">
        <EmptyState
          icon={item.icon}
          title={`${item.label} is on the way`}
          description="This module is part of an upcoming Propwise release. Navigation, layout and theming are already in place."
          actions={
            <Button variant="outline" asChild>
              <Link to="/dashboard">
                <ArrowLeft data-icon="inline-start" />
                Back to overview
              </Link>
            </Button>
          }
        />
      </Card>
    </PageContainer>
  )
}
