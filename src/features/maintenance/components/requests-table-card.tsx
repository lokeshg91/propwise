import { ClipboardList, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type RequestListItem } from '@/data/services'
import { RequestCard } from '@/features/maintenance/components/request-card'
import { createRequestColumns } from '@/features/maintenance/components/request-columns'
import { matchesStatusGroup, toRequestRow } from '@/features/maintenance/lib/request-list'
import { STATUS_GROUP_LABELS, STATUS_GROUPS, type StatusGroup } from '@/features/maintenance/lib/request-meta'

const columns = createRequestColumns({ showProperty: false })

interface RequestsTableCardProps {
  items: RequestListItem[]
  description: string
  /** Prefilled "Report issue" link. */
  reportHref: string
}

/** Maintenance requests for one property, reusing the Maintenance table and cards. */
export function RequestsTableCard({ items, description, reportHref }: RequestsTableCardProps) {
  const [group, setGroup] = useState<StatusGroup>('active')
  const allRows = useMemo(() => items.map((item) => toRequestRow(item)), [items])
  const rows = useMemo(() => allRows.filter((row) => matchesStatusGroup(row.status, group)), [allRows, group])
  const options = STATUS_GROUPS.map((value) => ({
    value,
    label: `${STATUS_GROUP_LABELS[value]} (${allRows.filter((row) => matchesStatusGroup(row.status, value)).length})`,
  }))

  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
        <CardDescription>{description}</CardDescription>
        <CardAction>
          <Button size="sm" asChild>
            <Link to={reportHref}>
              <Plus data-icon="inline-start" />
              Report issue
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {allRows.length > 0 ? (
          <div className="px-5">
            <SegmentedControl label="Request status" value={group} options={options} onValueChange={setGroup} className="max-w-full overflow-x-auto" />
          </div>
        ) : null}
        <DataTable
          caption="Maintenance requests for this property. Column headers are sortable."
          data={rows}
          columns={columns}
          initialSorting={[{ id: 'opened', desc: true }]}
          pageSize={8}
          getRowId={(row) => row.id}
          itemLabel="requests"
          minWidth="56rem"
          renderMobileRow={(row) => <RequestCard row={row} showProperty={false} />}
          emptyState={
            <EmptyState
              size="sm"
              icon={ClipboardList}
              title={allRows.length === 0 ? 'No maintenance requests yet' : `No ${STATUS_GROUP_LABELS[group].toLowerCase()} requests`}
              description={allRows.length === 0 ? 'Report an issue to track the work and the vendor visit.' : 'Choose another status to see more requests.'}
            />
          }
        />
      </CardContent>
    </Card>
  )
}
