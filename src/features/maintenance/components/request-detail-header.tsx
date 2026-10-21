import { CirclePause, CirclePlay, CircleX, Pencil, RotateCcw, UserCheck, Wrench, CircleCheckBig } from 'lucide-react'
import { Link } from 'react-router'

import { BackLink } from '@/components/shared/back-link'
import { Button } from '@/components/ui/button'
import { type RequestAction } from '@/data/domain/maintenance-rules'
import { type RequestDetail } from '@/data/services'
import { MaintenancePriorityBadge } from '@/features/maintenance/components/maintenance-badges'
import { CategoryLabel, RequestStatusBadge } from '@/features/maintenance/components/request-badges'
import { locationLabel } from '@/features/maintenance/lib/request-list'

const PRIMARY: Array<{ action: RequestAction; label: string; icon: typeof Wrench }> = [
  { action: 'assign', label: 'Assign vendor', icon: UserCheck },
  { action: 'start', label: 'Start work', icon: Wrench },
  { action: 'resume', label: 'Resume', icon: CirclePlay },
  { action: 'complete', label: 'Complete', icon: CircleCheckBig },
  { action: 'reopen', label: 'Reopen', icon: RotateCcw },
]

interface RequestDetailHeaderProps {
  detail: RequestDetail
  onAction: (action: RequestAction) => void
}

export function RequestDetailHeader({ detail, onAction }: RequestDetailHeaderProps) {
  const { request, property, actions } = detail
  const primary = PRIMARY.filter((entry) => actions.includes(entry.action))
  const where = locationLabel(detail)

  return (
    <div className="flex flex-col gap-3">
      <BackLink to="/maintenance" label="Maintenance" />
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1 text-foreground">{request.title}</h1>
            <RequestStatusBadge status={request.status} />
            <MaintenancePriorityBadge priority={request.priority} />
          </div>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
            <span className="font-medium text-foreground tabular-nums">{request.id}</span>
            <CategoryLabel category={request.category} />
            {property ? (
              <Link
                to={`/properties/${property.id}?tab=maintenance`}
                className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                {property.name} · {where}
              </Link>
            ) : (
              <span>{where}</span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {request.status !== 'cancelled' ? (
            <Button variant="outline" asChild>
              <Link to={`/maintenance/${request.id}/edit`}>
                <Pencil data-icon="inline-start" />
                Edit
              </Link>
            </Button>
          ) : null}
          {actions.includes('hold') ? (
            <Button variant="outline" onClick={() => onAction('hold')}>
              <CirclePause data-icon="inline-start" />
              Put on hold
            </Button>
          ) : null}
          {actions.includes('cancel') ? (
            <Button variant="destructive" onClick={() => onAction('cancel')}>
              <CircleX data-icon="inline-start" />
              Cancel request
            </Button>
          ) : null}
          {primary.map(({ action, label, icon: Icon }) => (
            <Button key={action} onClick={() => onAction(action)}>
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
