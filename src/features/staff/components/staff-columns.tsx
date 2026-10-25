import { Link } from 'react-router'

import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { StaffActionsMenu } from '@/features/staff/components/staff-actions-menu'
import { StaffAvatar } from '@/features/staff/components/staff-avatar'
import { RoleBadge, StaffStatusBadge, YouBadge } from '@/features/staff/components/staff-badges'
import { PropertySummary } from '@/features/staff/components/staff-properties'
import { type StaffRow } from '@/features/staff/lib/staff-list'

const column = createDataTableColumnHelper<StaffRow>()

export const staffColumns = column.columns([
  column.accessor('nameText', {
    id: 'member',
    header: 'Name',
    sortFn: (a, b) => a.original.name.localeCompare(b.original.name),
    cell: (info) => {
      const { member, isSelf, photo } = info.row.original
      return (
        <span className="flex min-w-0 items-center gap-3">
          <StaffAvatar name={member.name} photo={photo} />
          <span className="block min-w-0">
            <span className="flex min-w-0 items-center gap-2">
              <Link
                to={`/staff/${member.id}`}
                className="truncate rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {member.name}
              </Link>
              {isSelf ? <YouBadge /> : null}
            </span>
            <span className="block truncate text-caption text-muted-foreground">{member.jobTitle}</span>
          </span>
        </span>
      )
    },
  }),
  column.accessor('contactText', {
    id: 'contact',
    header: 'Contact',
    enableSorting: false,
    cell: (info) => {
      const { member } = info.row.original
      return (
        <span className="block min-w-0">
          <span className="block truncate text-foreground">{member.email}</span>
          <span className="block text-caption whitespace-nowrap text-muted-foreground">{member.phone || 'No phone'}</span>
        </span>
      )
    },
  }),
  column.accessor('roleText', {
    id: 'role',
    header: 'Role',
    sortFn: 'text',
    cell: (info) => <RoleBadge role={info.row.original.member.role} />,
  }),
  column.accessor('propertyText', {
    id: 'properties',
    header: 'Properties',
    sortFn: (a, b) => a.original.properties.length - b.original.properties.length,
    cell: (info) => <PropertySummary properties={info.row.original.properties} />,
  }),
  column.accessor((row) => (row.member.active ? 'Active' : 'Inactive'), {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => <StaffStatusBadge active={info.row.original.member.active} />,
  }),
  column.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: 'end', cellClassName: 'w-12' },
    cell: (info) => <StaffActionsMenu id={info.row.original.id} name={info.row.original.name} />,
  }),
])
