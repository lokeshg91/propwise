import { CircleCheckBig, CirclePause, CircleX, DoorClosed, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useLoaderData, useRevalidator } from 'react-router'

import { ActivityTimeline } from '@/components/shared/activity-timeline'
import { DetailList } from '@/components/shared/detail-list'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { StatusAlert } from '@/components/shared/status-alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toIsoDate } from '@/data/domain/dates'
import { checkTransition, REOPEN_WINDOW_DAYS, type RequestAction } from '@/data/domain/maintenance-rules'
import { UnitStatusBadge } from '@/features/properties/components/unit-status-badge'
import { RequestActionDialog } from '@/features/maintenance/components/request-action-dialogs'
import { TimingText } from '@/features/maintenance/components/request-badges'
import { RequestDetailHeader } from '@/features/maintenance/components/request-detail-header'
import { WorkOrderPanel } from '@/features/maintenance/components/work-order-panel'
import { buildRequestTimeline } from '@/features/maintenance/lib/request-detail'
import { locationLabel } from '@/features/maintenance/lib/request-list'
import { HOLD_REASON_LABELS, SOURCE_LABELS } from '@/features/maintenance/lib/request-meta'
import { formatDuration, hoursUntil, timingLine } from '@/features/maintenance/lib/request-time'
import { type requestDetailLoader } from '@/features/maintenance/maintenance.loaders'
import { useFormat } from '@/hooks/use-format'
import { formatRelativeTime } from '@/lib/format'

const linkClass = 'rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

export function RequestDetailsPage() {
  const { date: formatDate, dateTime: formatDateTime } = useFormat()
  const detail = useLoaderData<typeof requestDetailLoader>()
  const { request, property, unit, tenant } = detail
  const revalidator = useRevalidator()
  const [action, setAction] = useState<RequestAction | null>(null)

  const timeline = useMemo(() => buildRequestTimeline(detail), [detail])
  const { timing, text: timingText } = timingLine(request, formatDate)
  const where = locationLabel(detail)
  const reopenCheck = checkTransition(request, 'reopen', { hasActiveWorkOrder: false })
  const reopenUntil = request.completedAt ? toIsoDate(new Date(Date.parse(request.completedAt) + REOPEN_WINDOW_DAYS * 86_400_000)) : null
  const vendors = detail.vendorsForActions

  return (
    <PageContainer>
      <NavigationProgress />
      <RequestDetailHeader detail={detail} onAction={setAction} />

      {request.status === 'cancelled' ? (
        <StatusAlert tone="info" icon={CircleX} title={`Cancelled ${request.cancelledAt ? formatDate(request.cancelledAt.slice(0, 10)) : ''}`}>
          {request.cancelReason ? `${request.cancelReason} ` : ''}Cancelled requests are final and can’t be reopened. Create a new request if the issue returns.
        </StatusAlert>
      ) : null}
      {request.status === 'completed' ? (
        <StatusAlert tone="success" icon={CircleCheckBig} title={`Completed ${request.completedAt ? formatDate(request.completedAt.slice(0, 10)) : ''}`}>
          {reopenCheck.allowed && reopenUntil
            ? `If the issue comes back, reopen it until ${formatDate(reopenUntil)}.`
            : `The ${REOPEN_WINDOW_DAYS}-day reopen window has closed. Create a new request if the issue returns.`}
        </StatusAlert>
      ) : null}
      {timing === 'overdue' ? (
        <StatusAlert tone="danger" icon={TriangleAlert} title={timingText}>
          The resolution target was {formatDateTime(request.dueAt)}. {request.status === 'open' ? 'Assign a vendor to get it scheduled.' : 'Follow up with the vendor.'}
        </StatusAlert>
      ) : null}
      {request.status === 'on-hold' && request.hold ? (
        <StatusAlert tone="warning" icon={CirclePause} title={`On hold · ${HOLD_REASON_LABELS[request.hold.reason]}`}>
          {request.hold.note || 'Resume the request when work can continue.'}
        </StatusAlert>
      ) : null}
      {detail.unitReturn.applicable ? (
        <StatusAlert tone="info" icon={DoorClosed} title={`${where} is under maintenance`}>
          {request.unitTakenOffline ? 'It was taken offline for this request. ' : ''}
          When you complete or cancel the request, you’ll be asked whether to return it to Vacant. Nothing changes without your answer.
        </StatusAlert>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>
                Reported {formatRelativeTime(request.createdAt)} by {SOURCE_LABELS[request.source].toLowerCase()}
                {request.reopenCount > 0 ? ` · reopened ${request.reopenCount === 1 ? 'once' : `${request.reopenCount} times`}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <p className="text-body whitespace-pre-line text-foreground">{request.description || 'No description added.'}</p>
              <DetailList
                className="lg:grid-cols-3"
                items={[
                  {
                    label: 'Location',
                    value: property ? (
                      <Link to={`/properties/${property.id}?tab=maintenance`} className={linkClass}>
                        {property.name} · {where}
                      </Link>
                    ) : (
                      where
                    ),
                  },
                  { label: 'Permission to enter', value: request.unitId ? (request.permissionToEnter ? 'Yes' : 'No — arrange a time') : 'Not needed' },
                  { label: 'Access notes', value: request.accessNotes || '—' },
                  { label: 'Created', value: formatDateTime(request.createdAt) },
                  { label: 'Last updated', value: formatDateTime(request.updatedAt) },
                  { label: 'Source', value: SOURCE_LABELS[request.source] },
                ]}
              />
            </CardContent>
          </Card>

          <WorkOrderPanel detail={detail} onAction={setAction} />

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Every change to this request, newest first</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={timeline} grouped emptyDescription="Changes to this request will appear here." />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Resolution target</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Target', value: formatDateTime(request.dueAt) },
                  {
                    label: 'Status',
                    value: timing === 'closed' ? timingText : <TimingText timing={timing} text={timingText} className="text-body" />,
                  },
                  {
                    label: request.completedAt ? 'Time to resolve' : 'Open for',
                    value: formatDuration(
                      request.completedAt
                        ? (Date.parse(request.completedAt) - Date.parse(request.createdAt)) / 3_600_000
                        : -hoursUntil(request.cancelledAt ?? request.createdAt),
                    ),
                  },
                ]}
              />
            </CardContent>
          </Card>
          {unit ? (
            <Card>
              <CardHeader>
                <CardTitle>{where}</CardTitle>
                <CardDescription>{property?.name}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-body">
                  <span className="text-muted-foreground">Unit status</span>
                  <UnitStatusBadge status={unit.status} />
                </div>
                <Link to={`/properties/${request.propertyId}?tab=units`} className={`w-fit text-body ${linkClass}`}>
                  View units
                </Link>
              </CardContent>
            </Card>
          ) : null}
          {tenant ? (
            <Card>
              <CardHeader>
                <CardTitle>Tenant</CardTitle>
              </CardHeader>
              <CardContent>
                <Link to={`/tenants/${tenant.id}`} className={`text-body font-medium ${linkClass}`}>
                  {tenant.name}
                </Link>
                <p className="mt-1 text-caption text-muted-foreground">Reported this issue</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      <RequestActionDialog
        action={action}
        detail={detail}
        vendors={vendors}
        onOpenChange={(open) => {
          if (!open) setAction(null)
        }}
        onDone={() => {
          setAction(null)
          void revalidator.revalidate()
        }}
      />
    </PageContainer>
  )
}
