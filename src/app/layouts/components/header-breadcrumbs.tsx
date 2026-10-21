import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'

import { type RouteHandle } from '@/app/routes/route-handle'
import { cn } from '@/lib/utils'

interface HeaderBreadcrumbsProps {
  handle: RouteHandle | undefined
}

export function HeaderBreadcrumbs({ handle }: HeaderBreadcrumbsProps) {
  const title = handle?.title ?? 'Propwise'

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body">
        {handle?.section ? (
          <li
            className={cn(
              'hidden items-center gap-1.5 text-muted-foreground',
              handle.parent ? 'lg:flex' : 'sm:flex',
            )}
          >
            <span>{handle.section}</span>
            <ChevronRight className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
          </li>
        ) : null}
        {handle?.parent ? (
          <li className="hidden min-w-0 items-center gap-1.5 sm:flex">
            <Link
              to={handle.parent.to}
              className="truncate rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {handle.parent.label}
            </Link>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          </li>
        ) : null}
        <li className="min-w-0">
          <span aria-current="page" className="block truncate font-semibold text-foreground">
            {title}
          </span>
        </li>
      </ol>
    </nav>
  )
}
