import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { updateTenant } from '@/data/services'
import { TenantForm, type TenantFormMode } from '@/features/tenants/components/tenant-form'
import { toTenantFormValues, toTenantInput } from '@/features/tenants/lib/tenant-schema'
import { type tenantEditLoader } from '@/features/tenants/tenants.loaders'

export function TenantEditPage() {
  const { detail, assignable } = useLoaderData<typeof tenantEditLoader>()
  const navigate = useNavigate()
  const { tenant, lease } = detail
  const detailHref = `/tenants/${tenant.id}`
  const mode: TenantFormMode =
    lease && (lease.status === 'active' || lease.status === 'pending')
      ? { kind: 'edit-current', leaseStatus: lease.status }
      : { kind: 'edit-past' }

  return (
    <PageContainer className="max-w-5xl">
      <div className="flex flex-col gap-3">
        <BackLink to={detailHref} label={tenant.name} />
        <PageHeader title="Edit tenant" description={`Update ${tenant.name}’s details and lease terms.`} />
      </div>
      <TenantForm
        key={tenant.id}
        mode={mode}
        defaultValues={toTenantFormValues(detail)}
        assignable={assignable}
        submitLabel="Save changes"
        cancelHref={detailHref}
        onSubmit={async (values) => {
          const updated = await updateTenant(tenant.id, toTenantInput(values))
          toast.success('Changes saved', { description: `${updated.name} has been updated.` })
          await navigate(detailHref)
        }}
      />
    </PageContainer>
  )
}
