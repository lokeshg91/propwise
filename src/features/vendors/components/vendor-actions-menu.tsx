import { ClipboardList, Eye, MoreHorizontal, Pencil } from 'lucide-react'
import { Link } from 'react-router'

import { IconButton } from '@/components/shared/icon-button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function VendorActionsMenu({ id, name }: { id: string; name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${name}`} tooltip={false} size="icon-sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to={`/vendors/${id}`}>
            <Eye aria-hidden="true" />
            View vendor
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/vendors/${id}?tab=work-orders`}>
            <ClipboardList aria-hidden="true" />
            Work orders
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/vendors/${id}/edit`}>
            <Pencil aria-hidden="true" />
            Edit vendor
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
