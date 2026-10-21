import { Plus, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PropertyCard } from '@/features/properties/components/property-card'
import { propertyColumns } from '@/features/properties/components/property-columns'
import { PropertySummary } from '@/features/properties/components/property-summary'
import { usePropertyListFilters } from '@/features/properties/hooks/use-property-list-filters'
import { filterPropertyRows, summarizeProperties, toListRow } from '@/features/properties/lib/property-list'
import { PROPERTY_STATUS_LABELS } from '@/features/properties/lib/property-meta'
import { type propertiesLoader } from '@/features/properties/properties.loaders'
import { PROPERTY_STATUSES, type PropertyStatus } from '@/types'

const isPropertyStatus = (value: string): value is PropertyStatus =>
  (PROPERTY_STATUSES as readonly string[]).includes(value)

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'residential', label: 'Residential' },
  { value: 'commercial', label: 'Commercial' },
] as const

const SEARCHABLE = ['name', 'location'] as const

export function PropertiesPage() {
  const { properties } = useLoaderData<typeof propertiesLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = usePropertyListFilters()

  const allRows = useMemo(() => properties.map(toListRow), [properties])
  const rows = useMemo(() => filterPropertyRows(allRows, filters), [allRows, filters])
  const summary = useMemo(() => summarizeProperties(rows), [rows])

  return (
    <PageContainer>
      <PageHeader
        title="Properties"
        description="Manage your residential and commercial portfolio, units and occupancy."
        actions={
          <Button asChild>
            <Link to="/properties/new">
              <Plus data-icon="inline-start" />
              Add property
            </Link>
          </Button>
        }
      />

      <PropertySummary summary={summary} />

      <Card className="min-w-0 pb-4">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-col gap-3 px-5 lg:flex-row lg:items-center">
            <SearchInput
              label="Search properties"
              placeholder="Search by name, city or address…"
              value={filters.q}
              onValueChange={(q) => setFilters({ q })}
              className="lg:max-w-80 lg:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <SegmentedControl
                label="Property type"
                value={filters.type}
                options={TYPE_OPTIONS}
                onValueChange={(type) => setFilters({ type })}
              />
              <Select
                value={filters.status}
                onValueChange={(status) => {
                  if (status === 'all' || isPropertyStatus(status)) setFilters({ status })
                }}
              >
                <SelectTrigger aria-label="Filter by status" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All statuses</SelectItem>
                  {PROPERTY_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {PROPERTY_STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : null}
            </div>
          </div>

          <DataTable
            caption="Properties. Column headers are sortable."
            data={rows}
            columns={propertyColumns}
            globalFilter={filters.q}
            searchableColumns={SEARCHABLE}
            initialSorting={[{ id: 'name', desc: false }]}
            pageSize={8}
            getRowId={(row) => row.id}
            itemLabel="properties"
            minWidth="60rem"
            renderMobileRow={(row) => <PropertyCard row={row} />}
            emptyState={
              <EmptyState
                size="sm"
                icon={SearchX}
                title="No properties match your filters"
                description="Try another name, city or address, or clear the filters to see every property."
                actions={
                  hasFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button size="sm" asChild>
                      <Link to="/properties/new">Add your first property</Link>
                    </Button>
                  )
                }
              />
            }
          />
        </CardContent>
      </Card>
    </PageContainer>
  )
}
