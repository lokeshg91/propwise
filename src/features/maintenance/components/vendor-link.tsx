import { Link } from 'react-router'

import { InactiveVendorBadge } from '@/features/maintenance/components/request-badges'
import { cn } from '@/lib/utils'

export interface VendorLinkTarget {
  id: string
  name: string
  active: boolean
  /** The work order points at a vendor id that no longer exists. */
  missing?: boolean
}

const linkClass = 'rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

/**
 * A vendor name that opens the vendor's profile by its stable id, so renamed
 * and inactive vendors still resolve. Inactive vendors keep their badge;
 * a missing vendor is shown as plain text with no link.
 */
export function VendorLink({ vendor, className, showInactive = true }: { vendor: VendorLinkTarget; className?: string; showInactive?: boolean }) {
  if (vendor.missing) {
    return (
      <span className={cn('text-muted-foreground', className)} title="This vendor record is no longer available">
        Unknown vendor
        <span className="sr-only"> (vendor record not available)</span>
      </span>
    )
  }
  return (
    <span className="inline-flex max-w-full min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 align-baseline">
      <Link to={`/vendors/${vendor.id}`} className={cn('min-w-0 truncate text-foreground', linkClass, className)}>
        {vendor.name}
      </Link>
      {showInactive && !vendor.active ? <InactiveVendorBadge /> : null}
    </span>
  )
}
