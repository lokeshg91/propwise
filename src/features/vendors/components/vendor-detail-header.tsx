import { Mail, MoreHorizontal, Pencil, Phone, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react'
import { Link } from 'react-router'

import { BackLink } from '@/components/shared/back-link'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { CategoryChips, VendorStatusBadge } from '@/features/vendors/components/vendor-badges'
import { type Vendor } from '@/types'

export type VendorAction = 'deactivate' | 'reactivate' | 'delete'

export function VendorDetailHeader({ vendor, onAction }: { vendor: Vendor; onAction: (action: VendorAction) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <BackLink to="/vendors" label="Vendors" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1 text-foreground">{vendor.name}</h1>
            <VendorStatusBadge active={vendor.active} />
          </div>
          {vendor.company ? <p className="text-body text-muted-foreground">{vendor.company}</p> : null}
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
            <a href={`mailto:${vendor.email}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              <Mail className="size-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{vendor.email}</span>
            </a>
            <a href={`tel:${vendor.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
              <Phone className="size-4 shrink-0" aria-hidden="true" />
              {vendor.phone}
            </a>
          </p>
          <CategoryChips categories={vendor.categories} />
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/vendors/${vendor.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit vendor
            </Link>
          </Button>
          {vendor.active ? (
            <Button variant="outline" onClick={() => onAction('deactivate')}>
              <UserRoundX data-icon="inline-start" />
              Deactivate
            </Button>
          ) : (
            <Button onClick={() => onAction('reactivate')}>
              <UserRoundCheck data-icon="inline-start" />
              Reactivate
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="More actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to={`/vendors/${vendor.id}?tab=work-orders`}>Work-order history</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onAction('delete')}>
                <Trash2 aria-hidden="true" />
                Delete vendor
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
