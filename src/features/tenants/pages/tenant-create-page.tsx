import { useMemo } from 'react'
import { useLoaderData, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { createTenant } from '@/data/services'
import { TenantForm } from '@/features/tenants/components/tenant-form'
import { emptyTenantValues, toTenantInput } from '@/features/tenants/lib/tenant-schema'
import { type tenantCreateLoader } from '@/features/tenants/tenants.loaders'

export function TenantCreatePage() {
  const { assignable } = useLoaderData<typeof tenantCreateLoader>()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  // "Assign tenant" from a property's unit dialog preselects that unit.
  const defaults = useMemo(() => {
    const property = assignable.find((entry) => entry.id === params.get('propertyId'))
    const unit = property?.units.find((entry) => entry.id === params.get('unitId'))
    return emptyTenantValues(property ? { propertyId: property.id, unitId: unit?.id, rent: unit?.rent } : {})
  }, [assignable, params])
  const fromProperty = params.get('propertyId')

  return (
    <PageContainer className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <BackLink to={fromProperty ? `/properties/${fromProperty}?tab=units` : '/tenants'} label={fromProperty ? 'Back to property' : 'Tenants'} />
        <PageHeader title="Add tenant" description="Create a tenant profile and assign them to an available unit." />
      </div>
      <TenantForm
        mode={{ kind: 'create' }}
        defaultValues={defaults}
        assignable={assignable}
        submitLabel="Add tenant"
        cancelHref={fromProperty ? `/properties/${fromProperty}?tab=units` : '/tenants'}
        onSubmit={async (values) => {
          const tenant = await createTenant(toTenantInput(values))
          toast.success('Tenant added', {
            description: values.leaseStatus === 'pending' ? `${tenant.name}’s unit is reserved until move-in.` : `${tenant.name} has moved in.`,
          })
          await navigate(`/tenants/${tenant.id}`)
        }}
      />
    </PageContainer>
  )
}
