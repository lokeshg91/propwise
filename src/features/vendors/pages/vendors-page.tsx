import { HardHat, Plus, SearchX } from 'lucide-react'
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
import { CATEGORY_LABELS } from '@/features/maintenance/lib/request-meta'
import { VendorCard } from '@/features/vendors/components/vendor-card'
import { vendorColumns } from '@/features/vendors/components/vendor-columns'
import { VendorMetrics } from '@/features/vendors/components/vendor-metrics'
import { useVendorListFilters } from '@/features/vendors/hooks/use-vendor-list-filters'
import { filterVendorRows, matchesVendorStatus, summarizeVendors, toVendorRow } from '@/features/vendors/lib/vendor-list'
import { VENDOR_STATUS_GROUP_LABELS, VENDOR_STATUS_GROUPS, type VendorStatusGroup } from '@/features/vendors/lib/vendor-meta'
import { type vendorsLoader } from '@/features/vendors/vendors.loaders'
import { REQUEST_CATEGORIES, type RequestCategory } from '@/types'

const SEARCHABLE = ['vendor', 'contact', 'services'] as const
const isCategory = (value: string): value is RequestCategory => (REQUEST_CATEGORIES as readonly string[]).includes(value)

export function VendorsPage() {
  const { vendors } = useLoaderData<typeof vendorsLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = useVendorListFilters()

  const allRows = useMemo(() => vendors.map(toVendorRow), [vendors])
  const rows = useMemo(() => filterVendorRows(allRows, filters), [allRows, filters])
  const summary = useMemo(() => summarizeVendors(allRows), [allRows])
  const statusOptions = useMemo(
    () =>
      VENDOR_STATUS_GROUPS.map((group) => ({
        value: group,
        label: `${VENDOR_STATUS_GROUP_LABELS[group]} (${allRows.filter((row) => matchesVendorStatus(row.vendor.active, group)).length})`,
      })) satisfies Array<{ value: VendorStatusGroup; label: string }>,
    [allRows],
  )

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader
        title="Vendors"
        description="Contractors and service providers, their trades and work-order history."
        actions={
          <Button asChild>
            <Link to="/vendors/new">
              <Plus data-icon="inline-start" />
              Add vendor
            </Link>
          </Button>
        }
      />

      <VendorMetrics summary={summary} />

      <Card className="min-w-0 pb-4">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-col gap-3 px-5 xl:flex-row xl:items-center">
            <SearchInput
              label="Search vendors"
              placeholder="Name, contact, email, phone or service…"
              value={filters.q}
              onValueChange={(q) => setFilters({ q })}
              className="xl:max-w-80 xl:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <SegmentedControl
                label="Vendor status"
                value={filters.status}
                options={statusOptions}
                onValueChange={(status) => setFilters({ status })}
                className="max-md:hidden"
              />
              <Select
                value={filters.status}
                onValueChange={(value) => {
                  const option = statusOptions.find((entry) => entry.value === value)
                  if (option) setFilters({ status: option.value })
                }}
              >
                <SelectTrigger aria-label="Filter by vendor status" className="w-40 md:hidden">
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
              <Select value={filters.category} onValueChange={(value) => (value === 'all' || isCategory(value)) && setFilters({ category: value })}>
                <SelectTrigger aria-label="Filter by service" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All services</SelectItem>
                  {REQUEST_CATEGORIES.map((category) => (
                    <SelectItem key={category} value={category}>
                      {CATEGORY_LABELS[category]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-body font-medium text-foreground">
                <Switch checked={filters.openJobs} onCheckedChange={(openJobs) => setFilters({ openJobs })} size="sm" />
                Has open jobs
              </label>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  Reset filters
                </Button>
              ) : null}
            </div>
          </div>

          <DataTable
            caption="Vendors. Column headers are sortable."
            data={rows}
            columns={vendorColumns}
            globalFilter={filters.q}
            searchableColumns={SEARCHABLE}
            initialSorting={[{ id: 'vendor', desc: false }]}
            pageSize={10}
            getRowId={(row) => row.id}
            itemLabel="vendors"
            minWidth="64rem"
            renderMobileRow={(row) => <VendorCard row={row} />}
            emptyState={
              allRows.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={HardHat}
                  title="No vendors yet"
                  description="Add the contractors you work with to assign them to maintenance requests."
                  actions={
                    <Button size="sm" asChild>
                      <Link to="/vendors/new">Add your first vendor</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No vendors match your filters"
                  description="Try another name, contact or service, or reset the filters to see active vendors."
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
