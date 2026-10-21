import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { createProperty } from '@/data/services'
import { PropertyForm } from '@/features/properties/components/property-form'
import { EMPTY_PROPERTY_VALUES } from '@/features/properties/lib/property-schema'

export function PropertyCreatePage() {
  const navigate = useNavigate()

  return (
    <PageContainer className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <BackLink to="/properties" label="Properties" />
        <PageHeader
          title="Add property"
          description="Add a residential or commercial property to your portfolio. You can add its units next."
        />
      </div>
      <PropertyForm
        defaultValues={EMPTY_PROPERTY_VALUES}
        submitLabel="Add property"
        cancelHref="/properties"
        onSubmit={async (values) => {
          const property = await createProperty(values)
          toast.success('Property added', { description: `${property.name} is now part of your portfolio.` })
          await navigate(`/properties/${property.id}?tab=units`)
        }}
      />
    </PageContainer>
  )
}
