import { ClipboardList, Plus, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { PRIORITY_LABELS } from '@/features/maintenance/lib/maintenance-meta'
import { RequestCard } from '@/features/maintenance/components/request-card'
import { createRequestColumns } from '@/features/maintenance/components/request-columns'
import { RequestMetrics } from '@/features/maintenance/components/request-metrics'
import { useRequestListFilters } from '@/features/maintenance/hooks/use-request-list-filters'
import { filterRequestRows, matchesStatusGroup, summarizeRequests, toRequestRow } from '@/features/maintenance/lib/request-list'
import { CATEGORY_LABELS, STATUS_GROUP_LABELS, STATUS_GROUPS, type StatusGroup } from '@/features/maintenance/lib/request-meta'
import { type maintenanceLoader } from '@/features/maintenance/maintenance.loaders'
import { MAINTENANCE_PRIORITIES, type MaintenancePriority, REQUEST_CATEGORIES, type RequestCategory } from '@/types'

const SEARCHABLE = ['request', 'location', 'vendor'] as const
const columns = createRequestColumns()
const isPriority = (value: string): value is MaintenancePriority => (MAINTENANCE_PRIORITIES as readonly string[]).includes(value)
const isCategory = (value: string): value is RequestCategory => (REQUEST_CATEGORIES as readonly string[]).includes(value)

export function MaintenancePage() {
  const { requests, properties } = useLoaderData<typeof maintenanceLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = useRequestListFilters()

  const allRows = useMemo(() => requests.map((item) => toRequestRow(item)), [requests])
  const rows = useMemo(() => filterRequestRows(allRows, filters), [allRows, filters])
  const summary = useMemo(() => summarizeRequests(allRows), [allRows])

  const statusOptions = useMemo(
    () =>
      STATUS_GROUPS.map((group) => ({
        value: group,
        label: `${STATUS_GROUP_LABELS[group]} (${allRows.filter((row) => matchesStatusGroup(row.status, group)).length})`,
      })) satisfies Array<{ value: StatusGroup; label: string }>,
    [allRows],
  )

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader
        title="Maintenance"
        description="Requests, work orders and vendor visits across your portfolio."
        actions={
          <Button asChild>
            <Link to="/maintenance/new">
              <Plus data-icon="inline-start" />
              New request
            </Link>
          </Button>
        }
      />

      <RequestMetrics summary={summary} />

      <Card className="min-w-0 pb-4">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-col gap-3 px-5">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <SearchInput
                label="Search requests"
                placeholder="ID, issue, vendor or tenant…"
                value={filters.q}
                onValueChange={(q) => setFilters({ q })}
                className="xl:max-w-80 xl:flex-1"
              />
              <SegmentedControl
                label="Request status"
                value={filters.status}
                options={statusOptions}
                onValueChange={(status) => setFilters({ status })}
                className="max-md:hidden xl:ml-auto"
              />
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  const option = statusOptions.find((entry) => entry.value === value)
                  if (option) setFilters({ status: option.value })
                }}
              >
                <SelectTrigger aria-label="Filter by request status" className="w-full sm:w-48 md:hidden">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={filters.priority} onValueChange={(value) => (value === 'all' || isPriority(value)) && setFilters({ priority: value })}>
                <SelectTrigger aria-label="Filter by priority" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {[...MAINTENANCE_PRIORITIES].reverse().map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.category} onValueChange={(value) => (value === 'all' || isCategory(value)) && setFilters({ category: value })}>
                <SelectTrigger aria-label="Filter by category" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All categories</SelectItem>
                  {REQUEST_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filters.property} onValueChange={(property) => setFilters({ property })}>
                <SelectTrigger aria-label="Filter by property" className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All properties</SelectItem>
                  {properties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-body font-medium text-foreground">
                <Switch checked={filters.overdue} onCheckedChange={(overdue) => setFilters({ overdue })} size="sm" />
                Overdue only
              </label>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="ml-auto">
                  Reset filters
                </Button>
              ) : null}
            </div>
          </div>

          <DataTable
            caption="Maintenance requests. Column headers are sortable."
            data={rows}
            columns={columns}
            globalFilter={filters.q}
            searchableColumns={SEARCHABLE}
            initialSorting={[{ id: 'opened', desc: true }]}
            pageSize={10}
            getRowId={(row) => row.id}
            itemLabel="requests"
            minWidth="64rem"
            renderMobileRow={(row) => <RequestCard row={row} />}
            emptyState={
              allRows.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={ClipboardList}
                  title="No maintenance requests yet"
                  description="Log an issue to track the work, the vendor visit and the outcome."
                  actions={
                    <Button size="sm" asChild>
                      <Link to="/maintenance/new">Create the first request</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No requests match your filters"
                  description="Try another search or status, or reset the filters to see active requests."
                  actions={
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Reset filters
                    </Button>
                  }
                />
              )
            }
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
