import { useMemo } from 'react'
import { useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { createServiceRequest } from '@/data/services'
import { RequestForm } from '@/features/maintenance/components/request-form'
import { emptyRequestValues, toRequestInput, toWorkOrderInput } from '@/features/maintenance/lib/request-schema'
import { type requestCreateLoader } from '@/features/maintenance/maintenance.loaders'

export function RequestCreatePage() {
  const { options } = useLoaderData<typeof requestCreateLoader>()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // "Report issue" links from a property, unit or tenant prefill the location and reporter.
  const { defaults, back } = useMemo(() => {
    const property = options.properties.find((entry) => entry.id === params.get('propertyId'))
    const unit = property?.units.find((entry) => entry.id === params.get('unitId'))
    const tenantId = unit?.tenants.find((tenant) => tenant.id === params.get('tenantId'))?.id
    const from = params.get('from')
    return {
      defaults: emptyRequestValues({ propertyId: property?.id, unitId: unit?.id, tenantId }),
      back:
        from === 'tenant' && tenantId
          ? { to: `/tenants/${tenantId}`, label: 'Back to tenant' }
          : property
            ? { to: `/properties/${property.id}?tab=maintenance`, label: 'Back to property' }
            : { to: '/maintenance', label: 'Maintenance' },
    }
  }, [options, params])

  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to={back.to} label={back.label} />
        <PageHeader title="New maintenance request" description="Log the issue and, if you like, assign a vendor straight away." />
      </div>
      <RequestForm
        mode={{ kind: 'create' }}
        options={options}
        defaultValues={defaults}
        submitLabel="Create request"
        cancelHref={back.to}
        onSubmit={async (values) => {
          const request = await createServiceRequest(toRequestInput(values), {
            takeUnitOffline: values.locationType === 'unit' && values.takeUnitOffline,
            assign: values.assignNow ? toWorkOrderInput(values) : null,
          })
          toast.success('Request created', {
            description: `${request.id}${values.assignNow ? ' is scheduled with the vendor.' : ' is waiting for a vendor.'}`,
          })
          await navigate(`/maintenance/${request.id}`)
        }}
      />
    </PageContainer>
  )
}
