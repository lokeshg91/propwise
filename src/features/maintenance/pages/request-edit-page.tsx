import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { CircleX } from 'lucide-react'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { StatusAlert } from '@/components/shared/status-alert'
import { updateServiceRequest } from '@/data/services'
import { RequestForm } from '@/features/maintenance/components/request-form'
import { toRequestFormValues, toRequestInput } from '@/features/maintenance/lib/request-schema'
import { type requestEditLoader } from '@/features/maintenance/maintenance.loaders'

export function RequestEditPage() {
  const { detail, options } = useLoaderData<typeof requestEditLoader>()
  const navigate = useNavigate()
  const { request } = detail
  const detailHref = `/maintenance/${request.id}`
  const locationLocked = detail.workOrders.length > 0 || request.unitTakenOffline

  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to={detailHref} label={request.id} />
        <PageHeader title="Edit request" description={`Update the details for ${request.id}: ${request.title}.`} />
      </div>
      {request.status === 'cancelled' ? (
        <StatusAlert tone="info" icon={CircleX} title="This request is cancelled">
          Cancelled requests are final and can’t be edited. Create a new request if the issue returns.
        </StatusAlert>
      ) : (
        <RequestForm
          key={request.id}
          mode={{ kind: 'edit', locationLocked }}
          options={options}
          defaultValues={toRequestFormValues(detail)}
          submitLabel="Save changes"
          cancelHref={detailHref}
          onSubmit={async (values) => {
            await updateServiceRequest(request.id, toRequestInput(values))
            toast.success('Changes saved', { description: request.id })
            await navigate(detailHref)
          }}
        />
      )}
    </PageContainer>
  )
}
