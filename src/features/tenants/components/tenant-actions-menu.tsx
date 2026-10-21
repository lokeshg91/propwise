import { Eye, FileText, MoreHorizontal, Pencil, Receipt } from 'lucide-react'
import { Link } from 'react-router'

import { IconButton } from '@/components/shared/icon-button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function TenantActionsMenu({ id, name }: { id: string; name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${name}`} tooltip={false} size="icon-sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to={`/tenants/${id}`}>
            <Eye aria-hidden="true" />
            View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/tenants/${id}?tab=lease`}>
            <FileText aria-hidden="true" />
            Manage lease
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/tenants/${id}?tab=payments`}>
            <Receipt aria-hidden="true" />
            Payment history
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/tenants/${id}/edit`}>
            <Pencil aria-hidden="true" />
            Edit tenant
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
