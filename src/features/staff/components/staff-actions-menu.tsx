import { Eye, MoreHorizontal, Pencil } from 'lucide-react'
import { Link } from 'react-router'

import { IconButton } from '@/components/shared/icon-button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function StaffActionsMenu({ id, name }: { id: string; name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${name}`} tooltip={false} size="icon-sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to={`/staff/${id}`}>
            <Eye aria-hidden="true" />
            View profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/staff/${id}/edit`}>
            <Pencil aria-hidden="true" />
            Edit
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
