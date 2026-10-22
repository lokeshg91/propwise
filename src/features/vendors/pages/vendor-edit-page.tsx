import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { updateVendor } from '@/data/services'
import { VendorForm } from '@/features/vendors/components/vendor-form'
import { toVendorFormValues, toVendorInput } from '@/features/vendors/lib/vendor-schema'
import { type vendorDetailLoader } from '@/features/vendors/vendors.loaders'

export function VendorEditPage() {
  const { vendor } = useLoaderData<typeof vendorDetailLoader>()
  const navigate = useNavigate()
  const detailHref = `/vendors/${vendor.id}`
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to={detailHref} label={vendor.name} />
        <PageHeader
          title="Edit vendor"
          description={`Update ${vendor.name}’s details. Existing work orders keep this vendor; past activity keeps the name it was recorded with.`}
        />
      </div>
      <VendorForm
        key={vendor.id}
        vendorId={vendor.id}
        vendorName={vendor.name}
        defaultValues={toVendorFormValues(vendor)}
        submitLabel="Save changes"
        cancelHref={detailHref}
        onSubmit={async (values, options) => {
          const updated = await updateVendor(vendor.id, toVendorInput(values), options)
          toast.success('Changes saved', { description: `${updated.name} has been updated.` })
          await navigate(detailHref)
        }}
      />
    </PageContainer>
  )
}
