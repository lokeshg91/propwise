import { Eye, MoreHorizontal, Pencil } from 'lucide-react'
import { Link } from 'react-router'

import { IconButton } from '@/components/shared/icon-button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

export function RequestActionsMenu({ id, editable }: { id: string; editable: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <IconButton label={`Actions for ${id}`} tooltip={false} size="icon-sm">
          <MoreHorizontal />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild>
          <Link to={`/maintenance/${id}`}>
            <Eye aria-hidden="true" />
            View request
          </Link>
        </DropdownMenuItem>
        {editable ? (
          <DropdownMenuItem asChild>
            <Link to={`/maintenance/${id}/edit`}>
              <Pencil aria-hidden="true" />
              Edit details
            </Link>
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
