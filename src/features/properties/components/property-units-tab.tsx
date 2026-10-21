import { DoorOpen, Plus, SearchX } from 'lucide-react'
import { useMemo, useState } from 'react'

import { EmptyState } from '@/components/shared/empty-state'
import { SearchInput } from '@/components/shared/search-input'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UnitCard } from '@/features/properties/components/unit-card'
import { createUnitColumns, type UnitLease, type UnitRow } from '@/features/properties/components/unit-columns'
import { type UnitStats } from '@/features/properties/lib/property-detail'
import { UNIT_TYPE_LABELS, unitLabel, unitTypesFor } from '@/features/properties/lib/property-meta'
import { type Property, type Unit, type UnitStatus, type UnitType } from '@/types'

type StatusFilter = UnitStatus | 'all'

interface PropertyUnitsTabProps {
  property: Property
  units: Unit[]
  /** Active and pending leases at the property. */
  leases: UnitLease[]
  stats: UnitStats
  canAddUnit: boolean
  onAddUnit: () => void
  onEditUnit: (unit: Unit) => void
}

const SEARCHABLE = ['unit', 'tenant'] as const

export function PropertyUnitsTab({ property, units, leases, stats, canAddUnit, onAddUnit, onEditUnit }: PropertyUnitsTabProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [type, setType] = useState<UnitType | 'all'>('all')

  const rows = useMemo<UnitRow[]>(
    () =>
      units
        .filter((unit) => (status === 'all' || unit.status === status) && (type === 'all' || unit.type === type))
        .map((unit) => ({
          ...unit,
          label: unitLabel(property.type, unit.number),
          lease: leases.find((lease) => lease.unitId === unit.id) ?? null,
        })),
    [units, leases, status, type, property.type],
  )
  const columns = useMemo(() => createUnitColumns(onEditUnit), [onEditUnit])
  const hasFilters = search !== '' || status !== 'all' || type !== 'all'
  const clear = () => {
    setSearch('')
    setStatus('all')
    setType('all')
  }

  const statusOptions = [
    { value: 'all' as const, label: `All (${stats.added})` },
    { value: 'occupied' as const, label: `Occupied (${stats.occupied})` },
    { value: 'vacant' as const, label: `Vacant (${stats.vacant})` },
    { value: 'maintenance' as const, label: `Maintenance (${stats.maintenance})` },
  ]

  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Units</CardTitle>
        <CardDescription>
          {stats.added} of {property.totalUnits} units added
          {stats.notAdded > 0 ? ` · ${stats.notAdded} remaining` : ''}
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={onAddUnit} aria-disabled={!canAddUnit} className="aria-disabled:opacity-60">
            <Plus data-icon="inline-start" />
            Add unit
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        {units.length === 0 ? (
          <EmptyState
            size="sm"
            icon={DoorOpen}
            title="No units yet"
            description={`Add the ${property.type === 'residential' ? 'apartments' : 'suites'} at ${property.name} to track rent and occupancy.`}
            actions={
              <Button size="sm" onClick={onAddUnit}>
                <Plus data-icon="inline-start" />
                Add first unit
              </Button>
            }
          />
        ) : (
          <>
            <div className="flex flex-col gap-3 px-5 xl:flex-row xl:items-center">
              <SearchInput
                label="Search units"
                placeholder="Search unit number or tenant…"
                value={search}
                onValueChange={setSearch}
                className="xl:max-w-72 xl:flex-1"
              />
              <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
                <SegmentedControl
                  label="Occupancy status"
                  value={status}
                  options={statusOptions}
                  onValueChange={setStatus}
                  className="max-md:hidden"
                />
                <Select
                  value={status}
                  onValueChange={(value) => {
                    const option = statusOptions.find((entry) => entry.value === value)
                    if (option) setStatus(option.value)
                  }}
                >
                  <SelectTrigger aria-label="Filter by occupancy status" className="w-44 md:hidden">
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
                  value={type}
                  onValueChange={(value) => {
                    if (value === 'all' || (unitTypesFor(property.type) as readonly string[]).includes(value)) setType(value as UnitType | 'all')
                  }}
                >
                  <SelectTrigger aria-label="Filter by unit type" className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="all">All unit types</SelectItem>
                    {unitTypesFor(property.type).map((value) => (
                      <SelectItem key={value} value={value}>
                        {UNIT_TYPE_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasFilters ? (
                  <Button variant="ghost" size="sm" onClick={clear}>
                    Clear filters
                  </Button>
                ) : null}
              </div>
            </div>
            <DataTable
              caption={`Units at ${property.name}. Column headers are sortable.`}
              data={rows}
              columns={columns}
              globalFilter={search}
              searchableColumns={SEARCHABLE}
              initialSorting={[{ id: 'unit', desc: false }]}
              pageSize={10}
              getRowId={(row) => row.id}
              itemLabel="units"
              minWidth="56rem"
              renderMobileRow={(row) => <UnitCard row={row} onEdit={() => onEditUnit(row)} />}
              emptyState={
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No units match your filters"
                  description="Try another unit number or tenant, or clear the filters."
                  actions={
                    <Button variant="outline" size="sm" onClick={clear}>
                      Clear filters
                    </Button>
                  }
                />
              }
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
