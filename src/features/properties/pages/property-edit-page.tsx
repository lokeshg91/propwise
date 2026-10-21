import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { updateProperty } from '@/data/services'
import { PropertyForm } from '@/features/properties/components/property-form'
import { toPropertyFormValues } from '@/features/properties/lib/property-form-values'
import { type propertyDetailLoader } from '@/features/properties/properties.loaders'

export function PropertyEditPage() {
  const { property, units } = useLoaderData<typeof propertyDetailLoader>()
  const navigate = useNavigate()
  const detailHref = `/properties/${property.id}`

  return (
    <PageContainer className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <BackLink to={detailHref} label={property.name} />
        <PageHeader title="Edit property" description={`Update the details for ${property.name}.`} />
      </div>
      <PropertyForm
        key={property.id}
        defaultValues={toPropertyFormValues(property)}
        minTotalUnits={units.length}
        submitLabel="Save changes"
        cancelHref={detailHref}
        onSubmit={async (values) => {
          const updated = await updateProperty(property.id, values)
          toast.success('Changes saved', { description: `${updated.name} has been updated.` })
          await navigate(detailHref)
        }}
      />
    </PageContainer>
  )
}
