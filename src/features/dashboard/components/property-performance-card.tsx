import { ArrowRight, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { SearchInput } from '@/components/shared/search-input'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { propertyPerformanceColumns } from '@/features/dashboard/components/property-performance-columns'
import { PropertyPerformanceMobileRow } from '@/features/dashboard/components/property-performance-mobile-row'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/lib/property-meta'
import { type PropertyPerformanceRow, PROPERTY_STATUSES, type PropertyStatus } from '@/types'

type StatusFilter = PropertyStatus | 'all'
const isStatusFilter = (value: string): value is StatusFilter =>
  value === 'all' || (PROPERTY_STATUSES as readonly string[]).includes(value)

const SEARCHABLE = ['name', 'location'] as const

export function PropertyPerformanceCard({ rows }: { rows: PropertyPerformanceRow[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  const data = useMemo(
    () => (status === 'all' ? rows : rows.filter((row) => row.status === status)),
    [rows, status],
  )
  const hasFilters = search !== '' || status !== 'all'

  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Property performance</CardTitle>
        <CardDescription>Occupancy and revenue for each property this month</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/properties">
              View all
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="flex flex-col gap-2 px-5 sm:flex-row">
          <SearchInput
            label="Search properties"
            placeholder="Search by name or city…"
            value={search}
            onValueChange={setSearch}
            className="sm:max-w-72 sm:flex-1"
          />
          <Select
            value={status}
            onValueChange={(value) => {
              if (isStatusFilter(value)) setStatus(value)
            }}
          >
            <SelectTrigger aria-label="Filter by status" className="w-full sm:w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROPERTY_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PROPERTY_STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DataTable
          caption="Property performance. Column headers are sortable."
          data={data}
          columns={propertyPerformanceColumns}
          globalFilter={search}
          searchableColumns={SEARCHABLE}
          initialSorting={[{ id: 'monthlyRevenue', desc: true }]}
          pageSize={6}
          getRowId={(row) => row.id}
          itemLabel="properties"
          minWidth="52rem"
          renderMobileRow={(row) => <PropertyPerformanceMobileRow row={row} />}
          emptyState={
            <EmptyState
              size="sm"
              icon={SearchX}
              title="No properties match your filters"
              description="Try a different name or city, or clear the filters."
              actions={
                hasFilters ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setStatus('all')
                    }}
                  >
                    Clear filters
                  </Button>
                ) : null
              }
            />
          }
        />
      </CardContent>
    </Card>
  )
}
