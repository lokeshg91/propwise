import { ChevronRight } from 'lucide-react'

import { type RouteHandle } from '@/app/routes/route-handle'

interface HeaderBreadcrumbsProps {
  handle: RouteHandle | undefined
}

export function HeaderBreadcrumbs({ handle }: HeaderBreadcrumbsProps) {
  const title = handle?.title ?? 'Propwise'

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-body">
        {handle?.section ? (
          <li className="hidden items-center gap-1.5 text-muted-foreground sm:flex">
            <span>{handle.section}</span>
            <ChevronRight className="size-3.5 text-muted-foreground/70" aria-hidden="true" />
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
