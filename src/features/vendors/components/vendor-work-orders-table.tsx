import { ClipboardList } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { FormattedAmount, FormattedDateTime } from '@/components/shared/formatted'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { DataTable } from '@/components/tables/data-table'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type VendorWorkOrder } from '@/data/services'
import { WorkOrderStatusBadge } from '@/features/maintenance/components/request-badges'
import {
  locationText,
  matchesWorkOrderGroup,
  WORK_ORDER_GROUP_LABELS,
  WORK_ORDER_GROUPS,
  type WorkOrderGroup,
} from '@/features/vendors/lib/vendor-detail'
import { useFormat } from '@/hooks/use-format'

const column = createDataTableColumnHelper<VendorWorkOrder>()
const linkClass = 'rounded-sm outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

/** The most relevant date for a work order: completed, cancelled, visit or created. */
function keyDate(entry: VendorWorkOrder): { label: string; value: string } {
  const { order } = entry
  if (order.status === 'completed' && order.completedAt) return { label: 'Completed', value: order.completedAt }
  if (order.status === 'cancelled' && order.cancelledAt) return { label: 'Cancelled', value: order.cancelledAt }
  if (order.scheduledFor) return { label: 'Visit', value: order.scheduledFor }
  return { label: 'Assigned', value: order.createdAt }
}

function ReplacedNote({ entry }: { entry: VendorWorkOrder }) {
  if (!entry.replacedBy) return null
  return (
    <span className="block text-caption text-muted-foreground">
      Reassigned to{' '}
      <Link to={`/vendors/${entry.replacedBy.vendorId}`} className="text-primary underline-offset-4 hover:underline">
        {entry.replacedBy.vendorName}
      </Link>
    </span>
  )
}

const columns = column.columns([
  column.accessor((row) => `${row.order.id} ${row.request?.id ?? ''} ${row.request?.title ?? ''}`, {
    id: 'job',
    header: 'Work order',
    sortFn: (a, b) => a.original.order.id.localeCompare(b.original.order.id, 'en', { numeric: true }),
    cell: (info) => {
      const { order, request } = info.row.original
      return (
        <span className="block min-w-0">
          {request ? (
            <Link to={`/maintenance/${request.id}`} className={`block truncate font-medium text-foreground ${linkClass}`}>
              {request.title}
            </Link>
          ) : (
            <span className="block font-medium text-foreground">Request {order.requestId}</span>
          )}
          <span className="block text-caption text-muted-foreground tabular-nums">
            {order.id} · {request?.id ?? order.requestId}
          </span>
        </span>
      )
    },
  }),
  column.accessor((row) => locationText(row), {
    id: 'location',
    header: 'Location',
    sortFn: 'alphanumeric',
    cell: (info) => <span className="text-muted-foreground">{info.getValue()}</span>,
  }),
  column.accessor((row) => row.order.status, {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => (
      <span className="flex flex-col items-start gap-1">
        <WorkOrderStatusBadge status={info.row.original.order.status} />
        <ReplacedNote entry={info.row.original} />
      </span>
    ),
  }),
  column.accessor((row) => keyDate(row).value, {
    id: 'date',
    header: 'Date',
    sortFn: 'text',
    cell: (info) => {
      const date = keyDate(info.row.original)
      return (
        <span className="block whitespace-nowrap">
          <span className="block text-caption text-muted-foreground">{date.label}</span>
          <FormattedDateTime value={date.value} />
        </span>
      )
    },
  }),
  column.accessor((row) => row.order.actualCost ?? row.order.estimatedCost ?? -1, {
    id: 'cost',
    header: 'Cost',
    meta: { align: 'end' },
    cell: (info) => {
      const { order } = info.row.original
      return order.status === 'completed' ? (
        <span className="block tabular-nums">
          <FormattedAmount value={order.actualCost} />
          {order.estimatedCost !== null ? (
            <span className="block text-caption text-muted-foreground">
              est. <FormattedAmount value={order.estimatedCost} />
            </span>
          ) : null}
        </span>
      ) : (
        <span className="text-muted-foreground tabular-nums">
          {order.estimatedCost === null ? (
            '—'
          ) : (
            <>
              Est. <FormattedAmount value={order.estimatedCost} />
            </>
          )}
        </span>
      )
    },
  }),
])

function WorkOrderCard({ entry }: { entry: VendorWorkOrder }) {
  const { amount, dateTime: formatDateTime } = useFormat()
  const money = (value: number | null) => (value === null ? '—' : amount(value))
  const date = keyDate(entry)
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {entry.request ? (
            <Link to={`/maintenance/${entry.request.id}`} className="block truncate text-body font-medium text-foreground hover:text-primary">
              {entry.request.title}
            </Link>
          ) : (
            <p className="text-body font-medium text-foreground">Request {entry.order.requestId}</p>
          )}
          <p className="text-caption text-muted-foreground tabular-nums">
            {entry.order.id} · {entry.request?.id ?? entry.order.requestId}
          </p>
        </div>
        <WorkOrderStatusBadge status={entry.order.status} />
      </div>
      <p className="truncate text-caption text-muted-foreground">{locationText(entry)}</p>
      <ReplacedNote entry={entry} />
      <p className="flex justify-between gap-3 border-t border-border pt-2 text-caption">
        <span className="text-muted-foreground">
          {date.label} {formatDateTime(date.value)}
        </span>
        <span className="font-semibold text-foreground tabular-nums">
          {entry.order.status === 'completed' ? money(entry.order.actualCost) : entry.order.estimatedCost === null ? '—' : `Est. ${money(entry.order.estimatedCost)}`}
        </span>
      </p>
    </div>
  )
}

/** Every work order the vendor has had, including cancelled and reassigned ones. */
export function VendorWorkOrdersTable({ workOrders, vendorName }: { workOrders: VendorWorkOrder[]; vendorName: string }) {
  const [group, setGroup] = useState<WorkOrderGroup>('all')
  const rows = useMemo(() => workOrders.filter((entry) => matchesWorkOrderGroup(entry, group)), [workOrders, group])
  const options = WORK_ORDER_GROUPS.map((value) => ({
    value,
    label: `${WORK_ORDER_GROUP_LABELS[value]} (${workOrders.filter((entry) => matchesWorkOrderGroup(entry, value)).length})`,
  }))

  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Work orders</CardTitle>
        <CardDescription>Every job assigned to {vendorName}, including cancelled and reassigned ones</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {workOrders.length > 0 ? (
          <div className="px-5">
            <SegmentedControl label="Work-order status" value={group} options={options} onValueChange={setGroup} className="max-w-full overflow-x-auto" />
          </div>
        ) : null}
        <DataTable
          caption={`Work orders for ${vendorName}. Column headers are sortable.`}
          data={rows}
          columns={columns}
          initialSorting={[{ id: 'date', desc: true }]}
          pageSize={10}
          getRowId={(row) => row.order.id}
          itemLabel="work orders"
          minWidth="52rem"
          renderMobileRow={(row) => <WorkOrderCard entry={row} />}
          emptyState={
            <EmptyState
              size="sm"
              icon={ClipboardList}
              title={workOrders.length === 0 ? 'No work orders yet' : `No ${WORK_ORDER_GROUP_LABELS[group].toLowerCase()} work orders`}
              description={
                workOrders.length === 0 ? 'Assign this vendor from a maintenance request to see its jobs here.' : 'Choose another status to see more work orders.'
              }
            />
          }
        />
      </CardContent>
    </Card>
  )
}
