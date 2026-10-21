import { ArrowRightLeft, CalendarClock, ClipboardList, UserCheck } from 'lucide-react'

import { DetailList } from '@/components/shared/detail-list'
import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type RequestAction } from '@/data/domain/maintenance-rules'
import { type RequestDetail, type WorkOrderWithVendor } from '@/data/services'
import { InactiveVendorBadge, WorkOrderStatusBadge } from '@/features/maintenance/components/request-badges'
import { formatDateTime } from '@/features/maintenance/lib/request-time'
import { formatCurrency } from '@/lib/format'

const money = (value: number | null) => (value === null ? '—' : formatCurrency(value))

function VendorName({ order }: { order: WorkOrderWithVendor }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="font-medium text-foreground">{order.vendor.name}</span>
      {order.vendor.active ? null : <InactiveVendorBadge />}
    </span>
  )
}

/** Current work order with its actions, plus every earlier work order (cancelled or completed). */
export function WorkOrderPanel({ detail, onAction }: { detail: RequestDetail; onAction: (action: RequestAction) => void }) {
  const active = detail.workOrders.find((order) => order.id === detail.activeWorkOrder?.id)
  const latest = active ?? detail.workOrders[0]
  const history = detail.workOrders.filter((order) => order.id !== latest?.id)

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Work order</CardTitle>
        <CardDescription>
          {active ? `${active.id} · current` : latest ? `${latest.id} · ${latest.status}` : 'No vendor assigned yet'}
        </CardDescription>
        {latest ? (
          <CardAction>
            <WorkOrderStatusBadge status={latest.status} />
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {latest ? (
          <>
            <DetailList
              className="lg:grid-cols-3"
              items={[
                {
                  label: 'Vendor',
                  value: (
                    <span className="flex flex-col">
                      <VendorName order={latest} />
                      {latest.vendor.phone ? (
                        <span className="text-caption text-muted-foreground">
                          {latest.vendor.contactName} · {latest.vendor.phone}
                        </span>
                      ) : null}
                    </span>
                  ),
                },
                {
                  label: latest.status === 'completed' ? 'Completed' : latest.status === 'cancelled' ? 'Cancelled' : 'Visit',
                  value:
                    latest.status === 'completed' && latest.completedAt
                      ? formatDateTime(latest.completedAt)
                      : latest.status === 'cancelled' && latest.cancelledAt
                        ? formatDateTime(latest.cancelledAt)
                        : latest.scheduledFor
                          ? formatDateTime(latest.scheduledFor)
                          : 'Not scheduled',
                },
                {
                  label: latest.status === 'completed' ? 'Final cost' : 'Estimate',
                  value: (
                    <span className="tabular-nums">
                      {latest.status === 'completed' ? money(latest.actualCost) : money(latest.estimatedCost)}
                      {latest.status === 'completed' && latest.estimatedCost !== null ? (
                        <span className="text-caption text-muted-foreground"> · estimate {money(latest.estimatedCost)}</span>
                      ) : null}
                    </span>
                  ),
                },
                ...(latest.notes ? [{ label: 'Notes', value: latest.notes }] : []),
              ]}
            />
            {detail.actions.includes('reschedule') || detail.actions.includes('reassign') ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                {detail.actions.includes('reschedule') ? (
                  <Button variant="outline" size="sm" onClick={() => onAction('reschedule')}>
                    <CalendarClock data-icon="inline-start" />
                    Reschedule
                  </Button>
                ) : null}
                {detail.actions.includes('reassign') ? (
                  <Button variant="outline" size="sm" onClick={() => onAction('reassign')}>
                    <ArrowRightLeft data-icon="inline-start" />
                    Reassign vendor
                  </Button>
                ) : null}
              </div>
            ) : null}
          </>
        ) : (
          <EmptyState
            size="sm"
            icon={ClipboardList}
            title="No vendor assigned"
            description={detail.actions.includes('assign') ? 'Assign a vendor to schedule the work.' : 'This request was closed without a work order.'}
            actions={
              detail.actions.includes('assign') ? (
                <Button size="sm" onClick={() => onAction('assign')}>
                  <UserCheck data-icon="inline-start" />
                  Assign vendor
                </Button>
              ) : null
            }
          />
        )}

        {history.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-label text-foreground">Earlier work orders</h3>
            <div className="-mx-5 overflow-x-auto">
              <Table className="min-w-[36rem]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-5">Work order</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="pr-5 text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="pl-5 tabular-nums">{order.id}</TableCell>
                      <TableCell>
                        <VendorName order={order} />
                      </TableCell>
                      <TableCell>
                        <WorkOrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(order.completedAt ?? order.cancelledAt ?? order.createdAt)}
                      </TableCell>
                      <TableCell className="pr-5 text-right tabular-nums">
                        {order.status === 'completed' ? (
                          money(order.actualCost)
                        ) : (
                          <span className="text-muted-foreground">{order.estimatedCost === null ? '—' : `Est. ${money(order.estimatedCost)}`}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
