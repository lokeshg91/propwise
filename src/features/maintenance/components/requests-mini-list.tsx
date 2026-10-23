import { ClipboardList, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isActiveRequest } from '@/data/domain/maintenance-rules'
import { type RequestListItem } from '@/data/services'
import { RequestStatusBadge, TimingText } from '@/features/maintenance/components/request-badges'
import { locationLabel } from '@/features/maintenance/lib/request-list'
import { timingLine } from '@/features/maintenance/lib/request-time'
import { useFormat } from '@/hooks/use-format'

interface RequestsMiniListProps {
  items: RequestListItem[]
  /** Prefilled "Report issue" link, or null when the tenant has no current unit. */
  reportHref: string | null
  /** Link to the full list. */
  allHref: string
}

/** Compact card with a tenant's open requests (up to three) and a "Report issue" link. */
export function RequestsMiniList({ items, reportHref, allHref }: RequestsMiniListProps) {
  const { date: formatDate } = useFormat()
  const open = items.filter((item) => isActiveRequest(item.request))
  const shown = open.slice(0, 3)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance requests</CardTitle>
        <CardDescription>
          {open.length === 0 ? 'No open requests' : `${open.length} open`}
          {items.length > open.length ? ` · ${items.length - open.length} closed` : ''}
        </CardDescription>
        {reportHref ? (
          <CardAction>
            <Button variant="outline" size="sm" asChild>
              <Link to={reportHref}>
                <Plus data-icon="inline-start" />
                Report issue
              </Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shown.length === 0 ? (
          <p className="flex items-center gap-2 text-body text-muted-foreground">
            <ClipboardList className="size-4" aria-hidden="true" />
            {items.length === 0 ? 'Nothing reported yet.' : 'All requests are closed.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {shown.map((item) => {
              const { timing, text } = timingLine(item.request, formatDate)
              return (
                <li key={item.request.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
                  <Link
                    to={`/maintenance/${item.request.id}`}
                    className="truncate rounded-sm text-body font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {item.request.title}
                  </Link>
                  <span className="flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
                    <span className="tabular-nums">{item.request.id}</span>
                    <span>{locationLabel(item)}</span>
                    <RequestStatusBadge status={item.request.status} />
                    <TimingText timing={timing} text={text} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
        {items.length > 0 ? (
          <Link to={allHref} className="w-fit rounded-sm text-caption text-primary underline-offset-4 hover:underline">
            View all in Maintenance
          </Link>
        ) : null}
      </CardContent>
    </Card>
  )
}
