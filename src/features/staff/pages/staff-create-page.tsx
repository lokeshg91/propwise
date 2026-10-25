import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { createStaff } from '@/data/services'
import { StaffForm } from '@/features/staff/components/staff-form'
import { EMPTY_STAFF_VALUES, toStaffInput } from '@/features/staff/lib/staff-schema'
import { type staffCreateLoader } from '@/features/staff/staff.loaders'

export function StaffCreatePage() {
  const { propertyOptions } = useLoaderData<typeof staffCreateLoader>()
  const navigate = useNavigate()
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to="/staff" label="Staff" />
        <PageHeader title="Add staff member" description="Add a team member, choose their role and the properties they look after. Demo: no invitation email is sent." />
      </div>
      <StaffForm
        defaultValues={EMPTY_STAFF_VALUES}
        propertyOptions={propertyOptions}
        submitLabel="Add staff member"
        cancelHref="/staff"
        onSubmit={async (values) => {
          const member = await createStaff(toStaffInput(values))
          toast.success('Staff member added', { description: `${member.name} is on the team.` })
          await navigate(`/staff/${member.id}`)
        }}
      />
    </PageContainer>
  )
}
