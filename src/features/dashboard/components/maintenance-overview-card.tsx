import { ArrowRight, CircleCheck, CircleDot, Clock, type LucideIcon, SearchX, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { SearchInput } from '@/components/shared/search-input'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { maintenanceColumns } from '@/features/dashboard/components/maintenance-columns'
import { MaintenanceMobileRow } from '@/features/dashboard/components/maintenance-mobile-row'
import { cn } from '@/lib/utils'
import { type MaintenanceRequestRow, type MaintenanceSummary } from '@/types'

type TileKey = 'open' | 'urgent' | 'inProgress' | 'completed'

const TILES: ReadonlyArray<{
  key: TileKey
  label: string
  icon: LucideIcon
  tone: string
  matches: (row: MaintenanceRequestRow) => boolean
}> = [
  { key: 'open', label: 'Open', icon: CircleDot, tone: 'bg-primary/10 text-primary dark:bg-primary/15', matches: (r) => r.status === 'open' },
  { key: 'urgent', label: 'Urgent', icon: TriangleAlert, tone: 'bg-danger/10 text-danger dark:bg-danger/15', matches: (r) => r.priority === 'urgent' && r.status !== 'completed' },
  { key: 'inProgress', label: 'In progress', icon: Clock, tone: 'bg-warning/10 text-warning dark:bg-warning/15', matches: (r) => r.status === 'in-progress' },
  { key: 'completed', label: 'Completed', icon: CircleCheck, tone: 'bg-success/10 text-success dark:bg-success/15', matches: (r) => r.status === 'completed' },
]

const SEARCHABLE = ['id', 'issue', 'propertyName', 'vendor'] as const

interface MaintenanceOverviewCardProps {
  summary: MaintenanceSummary
  rows: MaintenanceRequestRow[]
  rangeLabel: string
}

export function MaintenanceOverviewCard({ summary, rows, rangeLabel }: MaintenanceOverviewCardProps) {
  const [activeTile, setActiveTile] = useState<TileKey | null>(null)
  const [search, setSearch] = useState('')

  const data = useMemo(() => {
    const tile = TILES.find((entry) => entry.key === activeTile)
    return tile ? rows.filter(tile.matches) : rows
  }, [rows, activeTile])
  const activeLabel = TILES.find((entry) => entry.key === activeTile)?.label

  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Maintenance overview</CardTitle>
        <CardDescription>Work orders across the selected portfolio. Select a status to filter.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/maintenance">
              View all
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 px-0">
        <div className="grid grid-cols-2 gap-3 px-5 lg:grid-cols-4" role="group" aria-label="Filter requests by status">
          {TILES.map((tile) => {
            const Icon = tile.icon
            const active = activeTile === tile.key
            return (
              <button
                key={tile.key}
                type="button"
                aria-pressed={active}
                aria-label={`${summary[tile.key]} ${tile.label.toLowerCase()}${tile.key === 'completed' ? ` in the last ${rangeLabel}` : ''}`}
                onClick={() => setActiveTile(active ? null : tile.key)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-[border-color,background-color,box-shadow] outline-none',
                  'hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50',
                  active && 'border-primary bg-accent/60 ring-1 ring-primary hover:bg-accent/60',
                )}
              >
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-lg', tile.tone)}>
                  <Icon className="size-[1.125rem]" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-h2 text-foreground tabular-nums">{summary[tile.key]}</span>
                  <span className="block text-caption text-muted-foreground">
                    {tile.label}
                    {tile.key === 'completed' ? <span className="max-sm:block"> · {rangeLabel}</span> : null}
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 px-5">
          <SearchInput
            label="Search maintenance requests"
            placeholder="Search requests or vendors…"
            value={search}
            onValueChange={setSearch}
            className="w-full sm:max-w-80"
          />
          {activeLabel ? (
            <Button variant="ghost" size="sm" onClick={() => setActiveTile(null)}>
              Clear “{activeLabel}” filter
            </Button>
          ) : null}
        </div>

        <DataTable
          caption="Recent maintenance requests. Column headers are sortable."
          data={data}
          columns={maintenanceColumns}
          globalFilter={search}
          searchableColumns={SEARCHABLE}
          pageSize={5}
          getRowId={(row) => row.id}
          itemLabel="requests"
          minWidth="56rem"
          renderMobileRow={(row) => <MaintenanceMobileRow row={row} />}
          emptyState={
            <EmptyState
              size="sm"
              icon={SearchX}
              title="No maintenance requests found"
              description={
                search ? 'No requests match your search.' : 'There are no requests with this status for the selected filters.'
              }
              actions={
                search || activeTile ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearch('')
                      setActiveTile(null)
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
