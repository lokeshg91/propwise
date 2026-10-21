import { Plus, SearchX, UsersRound } from 'lucide-react'
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
import { TenantCard } from '@/features/tenants/components/tenant-card'
import { tenantColumns } from '@/features/tenants/components/tenant-columns'
import { TenantMetrics } from '@/features/tenants/components/tenant-metrics'
import { useTenantListFilters } from '@/features/tenants/hooks/use-tenant-list-filters'
import { filterTenantRows, summarizeTenants, type TenantListFilters, toTenantRow } from '@/features/tenants/lib/tenant-list'
import { LEASE_FILTER_ORDER, LEASE_STATUS_LABELS } from '@/features/tenants/lib/tenant-meta'
import { type tenantsLoader } from '@/features/tenants/tenants.loaders'
import { LEASE_DISPLAY_STATUSES, type LeaseDisplayStatus } from '@/types'

const SEARCHABLE = ['name', 'property', 'phone'] as const
const isLeaseStatus = (value: string): value is LeaseDisplayStatus => (LEASE_DISPLAY_STATUSES as readonly string[]).includes(value)

export function TenantsPage() {
  const { tenants } = useLoaderData<typeof tenantsLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = useTenantListFilters()

  const allRows = useMemo(() => tenants.map((item) => toTenantRow(item)), [tenants])
  const rows = useMemo(() => filterTenantRows(allRows, filters), [allRows, filters])
  const summary = useMemo(() => summarizeTenants(allRows), [allRows])

  const statusOptions = useMemo(
    () =>
      [
        { value: 'all', label: `All (${summary.total})` },
        { value: 'active', label: `Active (${summary.active})` },
        { value: 'pending', label: `Pending (${summary.pending})` },
        { value: 'past', label: `Past (${summary.past})` },
      ] satisfies Array<{ value: TenantListFilters['status']; label: string }>,
    [summary],
  )

  return (
    <PageContainer>
      <PageHeader
        title="Tenants"
        description="Residents and businesses, their leases and payment history."
        actions={
          <Button asChild>
            <Link to="/tenants/new">
              <Plus data-icon="inline-start" />
              Add tenant
            </Link>
          </Button>
        }
      />

      <TenantMetrics summary={summary} />

      <Card className="min-w-0 pb-4">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-col gap-3 px-5 xl:flex-row xl:items-center">
            <SearchInput
              label="Search tenants"
              placeholder="Name, email, phone or property…"
              value={filters.q}
              onValueChange={(q) => setFilters({ q })}
              className="xl:max-w-80 xl:flex-1"
            />
            <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
              <SegmentedControl
                label="Tenant status"
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
                <SelectTrigger aria-label="Filter by tenant status" className="w-40 md:hidden">
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
              <Select
                value={filters.lease}
                onValueChange={(lease) => {
                  if (lease === 'all' || isLeaseStatus(lease)) setFilters({ lease })
                }}
              >
                <SelectTrigger aria-label="Filter by lease status" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="all">All lease statuses</SelectItem>
                  {LEASE_FILTER_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {LEASE_STATUS_LABELS[status]}
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
            caption="Tenants. Column headers are sortable."
            data={rows}
            columns={tenantColumns}
            globalFilter={filters.q}
            searchableColumns={SEARCHABLE}
            initialSorting={[{ id: 'name', desc: false }]}
            pageSize={10}
            getRowId={(row) => row.id}
            itemLabel="tenants"
            minWidth="64rem"
            renderMobileRow={(row) => <TenantCard row={row} />}
            emptyState={
              allRows.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={UsersRound}
                  title="No tenants yet"
                  description="Add a tenant and assign them to a vacant unit to start a lease."
                  actions={
                    <Button size="sm" asChild>
                      <Link to="/tenants/new">Add your first tenant</Link>
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No tenants match your filters"
                  description="Try another name, email, phone or property, or clear the filters."
                  actions={
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
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
