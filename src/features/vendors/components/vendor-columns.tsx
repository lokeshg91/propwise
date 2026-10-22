import { Link } from 'react-router'

import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { VendorActionsMenu } from '@/features/vendors/components/vendor-actions-menu'
import { CategoryChips, VendorStatusBadge } from '@/features/vendors/components/vendor-badges'
import { type VendorRow } from '@/features/vendors/lib/vendor-list'
import { formatDate, formatNumber } from '@/lib/format'

const column = createDataTableColumnHelper<VendorRow>()

export const vendorColumns = column.columns([
  column.accessor('nameText', {
    id: 'vendor',
    header: 'Vendor',
    sortFn: (a, b) => a.original.name.localeCompare(b.original.name),
    cell: (info) => {
      const { vendor } = info.row.original
      return (
        <span className="block min-w-0">
          <Link
            to={`/vendors/${vendor.id}`}
            className="block truncate rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {vendor.name}
          </Link>
          {vendor.company ? <span className="block truncate text-caption text-muted-foreground">{vendor.company}</span> : null}
        </span>
      )
    },
  }),
  column.accessor('contactText', {
    id: 'contact',
    header: 'Contact',
    enableSorting: false,
    cell: (info) => {
      const { vendor } = info.row.original
      return (
        <span className="block min-w-0">
          <span className="block truncate text-foreground">{vendor.contactName}</span>
          <span className="block truncate text-caption text-muted-foreground">{vendor.email}</span>
          <span className="block text-caption whitespace-nowrap text-muted-foreground">{vendor.phone}</span>
        </span>
      )
    },
  }),
  column.accessor('categoryText', {
    id: 'services',
    header: 'Services',
    enableSorting: false,
    cell: (info) => <CategoryChips categories={info.row.original.vendor.categories} limit={2} />,
  }),
  column.accessor('open', {
    header: 'Open jobs',
    meta: { align: 'end' },
    cell: (info) => <span className={info.getValue() > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}>{formatNumber(info.getValue())}</span>,
  }),
  column.accessor('completed', {
    header: 'Completed',
    meta: { align: 'end' },
    cell: (info) => formatNumber(info.getValue()),
  }),
  column.accessor('lastJobAt', {
    id: 'lastJob',
    header: 'Last job',
    sortFn: 'text',
    cell: (info) =>
      info.getValue() ? (
        <span className="whitespace-nowrap">{formatDate(info.getValue().slice(0, 10))}</span>
      ) : (
        <span className="text-muted-foreground">No jobs yet</span>
      ),
  }),
  column.accessor((row) => (row.vendor.active ? 'Active' : 'Inactive'), {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => <VendorStatusBadge active={info.row.original.vendor.active} />,
  }),
  column.display({
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    meta: { align: 'end', cellClassName: 'w-12' },
    cell: (info) => <VendorActionsMenu id={info.row.original.id} name={info.row.original.name} />,
  }),
])
