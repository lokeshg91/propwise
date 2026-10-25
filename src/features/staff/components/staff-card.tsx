import { Link } from 'react-router'

import { StaffActionsMenu } from '@/features/staff/components/staff-actions-menu'
import { StaffAvatar } from '@/features/staff/components/staff-avatar'
import { RoleBadge, StaffStatusBadge, YouBadge } from '@/features/staff/components/staff-badges'
import { PropertySummary } from '@/features/staff/components/staff-properties'
import { type StaffRow } from '@/features/staff/lib/staff-list'

/** Card layout for the staff directory on tablet and mobile. */
export function StaffCard({ row }: { row: StaffRow }) {
  const { member, isSelf, photo } = row
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <StaffAvatar name={member.name} photo={photo} />
          <div className="min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <Link
                to={`/staff/${member.id}`}
                className="truncate rounded-sm text-body font-medium text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {member.name}
              </Link>
              {isSelf ? <YouBadge /> : null}
            </span>
            <p className="truncate text-caption text-muted-foreground">{member.jobTitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <StaffStatusBadge active={member.active} />
          <StaffActionsMenu id={member.id} name={member.name} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <RoleBadge role={member.role} />
      </div>
      <p className="truncate text-caption text-muted-foreground">
        {member.email}
        {member.phone ? ` · ${member.phone}` : ''}
      </p>
      <div className="border-t border-border pt-3 text-caption">
        <PropertySummary properties={row.properties} limit={2} />
      </div>
    </div>
  )
}
