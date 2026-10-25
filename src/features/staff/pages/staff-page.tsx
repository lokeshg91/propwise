import { Plus, SearchX, Users } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link, useLoaderData, useSearchParams } from 'react-router'

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ROLE_LABELS } from '@/data/domain/staff-rules'
import { RoleMatrix } from '@/features/staff/components/role-matrix'
import { StaffCard } from '@/features/staff/components/staff-card'
import { staffColumns } from '@/features/staff/components/staff-columns'
import { StaffMetrics } from '@/features/staff/components/staff-metrics'
import { useStaffListFilters } from '@/features/staff/hooks/use-staff-list-filters'
import { filterStaffRows, matchesStaffStatus, STAFF_STATUS_GROUP_LABELS, STAFF_STATUS_GROUPS, summarizeStaff, toStaffRow, type StaffStatusGroup } from '@/features/staff/lib/staff-list'
import { type staffListLoader } from '@/features/staff/staff.loaders'
import { STAFF_ROLES, type StaffRole } from '@/types'

const SEARCHABLE = ['member', 'contact', 'role', 'properties'] as const
const isRole = (value: string): value is StaffRole => (STAFF_ROLES as readonly string[]).includes(value)

/** Staff (Phase 10.4): the team directory (`?q`, `status`, `role`, `property`) and the role reference (`?tab=roles`). */
export function StaffPage() {
  const { staff, properties } = useLoaderData<typeof staffListLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = useStaffListFilters()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'roles' ? 'roles' : 'team'
  const setTab = useCallback(
    (next: string) =>
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === 'roles') updated.set('tab', 'roles')
          else updated.delete('tab')
          return updated
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  )

  const allRows = useMemo(() => staff.map(toStaffRow), [staff])
  const rows = useMemo(() => filterStaffRows(allRows, filters), [allRows, filters])
  const summary = useMemo(() => summarizeStaff(allRows), [allRows])
  const roleCounts = useMemo(() => Object.fromEntries(STAFF_ROLES.map((role) => [role, allRows.filter((row) => row.member.active && row.member.role === role).length])) as Record<StaffRole, number>, [allRows])
  const statusOptions = useMemo(
    () =>
      STAFF_STATUS_GROUPS.map((group) => ({
        value: group,
        label: `${STAFF_STATUS_GROUP_LABELS[group]} (${allRows.filter((row) => matchesStaffStatus(row.member.active, group)).length})`,
      })) satisfies Array<{ value: StaffStatusGroup; label: string }>,
    [allRows],
  )
  const knownProperty = filters.property === 'all' || filters.property === 'unassigned' || properties.some((property) => property.id === filters.property)

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader
        title="Staff"
        description="Your team, their roles and the properties they look after."
        actions={
          <Button asChild>
            <Link to="/staff/new">
              <Plus data-icon="inline-start" />
              Add staff member
            </Link>
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger value="team" className="px-1">
              Team
              <span className="rounded-full bg-muted px-1.5 text-caption text-muted-foreground tabular-nums">{allRows.length}</span>
            </TabsTrigger>
            <TabsTrigger value="roles" className="px-1">
              Roles and access
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="team" className="flex flex-col gap-6">
          <StaffMetrics summary={summary} propertyCount={properties.length} />
          <Card className="min-w-0 pb-4">
            <CardContent className="flex flex-col gap-4 px-0">
              <div className="flex flex-col gap-3 px-5 xl:flex-row xl:items-center">
                <SearchInput
                  label="Search staff"
                  placeholder="Name, job title, email, phone or property…"
                  value={filters.q}
                  onValueChange={(q) => setFilters({ q })}
                  className="xl:max-w-80 xl:flex-1"
                />
                <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
                  <SegmentedControl label="Staff status" value={filters.status} options={statusOptions} onValueChange={(status) => setFilters({ status })} className="max-md:hidden" />
                  <Select
                    value={filters.status}
                    onValueChange={(value) => {
                      const option = statusOptions.find((entry) => entry.value === value)
                      if (option) setFilters({ status: option.value })
                    }}
                  >
                    <SelectTrigger aria-label="Filter by status" className="w-40 md:hidden">
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
                  <Select value={filters.role} onValueChange={(value) => (value === 'all' || isRole(value)) && setFilters({ role: value })}>
                    <SelectTrigger aria-label="Filter by role" className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {STAFF_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={knownProperty ? filters.property : 'all'} onValueChange={(property) => setFilters({ property })}>
                    <SelectTrigger aria-label="Filter by property" className="w-52">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value="all">All properties</SelectItem>
                      <SelectItem value="unassigned">No assignments</SelectItem>
                      {properties.map((property) => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasFilters ? (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      Reset filters
                    </Button>
                  ) : null}
                </div>
              </div>

              <DataTable
                caption="Staff members. Column headers are sortable."
                data={knownProperty ? rows : filterStaffRows(allRows, { ...filters, property: 'all' })}
                columns={staffColumns}
                globalFilter={filters.q}
                searchableColumns={SEARCHABLE}
                initialSorting={[{ id: 'member', desc: false }]}
                pageSize={10}
                getRowId={(row) => row.id}
                itemLabel="staff members"
                minWidth="60rem"
                renderMobileRow={(row) => <StaffCard row={row} />}
                emptyState={
                  <EmptyState
                    size="sm"
                    icon={allRows.length === 0 ? Users : SearchX}
                    title="No staff members match your filters"
                    description="Try another name, role or property, or reset the filters to see active staff."
                    actions={
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Reset filters
                      </Button>
                    }
                  />
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <RoleMatrix counts={roleCounts} />
        </TabsContent>
      </Tabs>
    </PageContainer>
  )
}
