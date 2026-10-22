import { useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { createVendor } from '@/data/services'
import { VendorForm } from '@/features/vendors/components/vendor-form'
import { EMPTY_VENDOR_VALUES, toVendorInput } from '@/features/vendors/lib/vendor-schema'

export function VendorCreatePage() {
  const navigate = useNavigate()
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to="/vendors" label="Vendors" />
        <PageHeader title="Add vendor" description="Add a contractor or service provider so they can be assigned to maintenance requests." />
      </div>
      <VendorForm
        defaultValues={EMPTY_VENDOR_VALUES}
        submitLabel="Add vendor"
        cancelHref="/vendors"
        onSubmit={async (values, options) => {
          const vendor = await createVendor(toVendorInput(values), options)
          toast.success('Vendor added', { description: `${vendor.name} is ${vendor.active ? 'ready for work orders' : 'saved as inactive'}.` })
          await navigate(`/vendors/${vendor.id}`)
        }}
      />
    </PageContainer>
  )
}
