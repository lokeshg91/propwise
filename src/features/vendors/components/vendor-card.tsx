import { Link } from 'react-router'

import { VendorActionsMenu } from '@/features/vendors/components/vendor-actions-menu'
import { CategoryChips, VendorStatusBadge } from '@/features/vendors/components/vendor-badges'
import { type VendorRow } from '@/features/vendors/lib/vendor-list'
import { formatDate } from '@/lib/format'

/** Card layout for the vendor list on tablet and mobile. */
export function VendorCard({ row }: { row: VendorRow }) {
  const { vendor } = row
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/vendors/${vendor.id}`}
            className="block truncate rounded-sm text-body font-medium text-foreground outline-none hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {vendor.name}
          </Link>
          <p className="truncate text-caption text-muted-foreground">{vendor.company || vendor.contactName}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <VendorStatusBadge active={vendor.active} />
          <VendorActionsMenu id={vendor.id} name={vendor.name} />
        </div>
      </div>
      <CategoryChips categories={vendor.categories} limit={3} />
      <p className="truncate text-caption text-muted-foreground">
        {vendor.contactName} · {vendor.phone} · {vendor.email}
      </p>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-caption">
        <span className="text-foreground">
          <span className="font-semibold tabular-nums">{row.open}</span> open · <span className="font-semibold tabular-nums">{row.completed}</span> completed
        </span>
        <span className="text-muted-foreground">{row.lastJobAt ? `Last job ${formatDate(row.lastJobAt.slice(0, 10))}` : 'No jobs yet'}</span>
      </div>
    </div>
  )
}
