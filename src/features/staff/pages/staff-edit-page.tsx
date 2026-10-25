import { useLoaderData, useNavigate } from 'react-router'
import { toast } from 'sonner'

import { BackLink } from '@/components/shared/back-link'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { updateStaff } from '@/data/services'
import { StaffForm } from '@/features/staff/components/staff-form'
import { toStaffFormValues, toStaffInput } from '@/features/staff/lib/staff-schema'
import { type staffEditLoader } from '@/features/staff/staff.loaders'

export function StaffEditPage() {
  const { member, isSelf, propertyOptions } = useLoaderData<typeof staffEditLoader>()
  const navigate = useNavigate()
  const detailHref = `/staff/${member.id}`
  return (
    <PageContainer className="max-w-5xl">
      <NavigationProgress />
      <div className="flex flex-col gap-3">
        <BackLink to={detailHref} label={member.name} />
        <PageHeader
          title={isSelf ? 'Edit your staff details' : 'Edit staff member'}
          description={isSelf ? 'Your name, email, phone and job title are your profile: saving here updates the Account page and the header too.' : `Update ${member.name}’s details, role and properties. Past activity keeps the name it was recorded with.`}
        />
      </div>
      <StaffForm
        key={member.id}
        staffId={member.id}
        isSelf={isSelf}
        defaultValues={toStaffFormValues(member)}
        propertyOptions={propertyOptions}
        submitLabel="Save changes"
        cancelHref={detailHref}
        onSubmit={async (values) => {
          const updated = await updateStaff(member.id, toStaffInput(values))
          toast.success('Changes saved', { description: `${updated.name} has been updated.` })
          await navigate(detailHref)
        }}
      />
    </PageContainer>
  )
}
