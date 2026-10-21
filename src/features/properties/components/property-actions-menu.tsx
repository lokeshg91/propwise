import { DoorOpen, Eye, MoreHorizontal, Pencil } from 'lucide-react'
import { Link } from 'react-router'

import { IconButton } from '@/components/shared/icon-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function PropertyActionsMenu({ id, name }: { id: string; name: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${name}`} tooltip={false} size="icon-sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to={`/properties/${id}`}>
            <Eye aria-hidden="true" />
            View details
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/properties/${id}?tab=units`}>
            <DoorOpen aria-hidden="true" />
            Manage units
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to={`/properties/${id}/edit`}>
            <Pencil aria-hidden="true" />
            Edit property
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
