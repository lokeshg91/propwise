import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PropertyTimeline } from '@/features/properties/components/property-timeline'
import { type TimelineItem, type UnitStats } from '@/features/properties/lib/property-detail'
import { formatAddress, PROPERTY_TYPE_LABELS, UNIT_TYPE_LABELS } from '@/features/properties/lib/property-meta'
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format'
import { type Property } from '@/types'

interface PropertyOverviewTabProps {
  property: Property
  stats: UnitStats
  timeline: TimelineItem[]
  onShowUnits: () => void
  onShowActivity: () => void
}

const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' })

export function PropertyOverviewTab({ property, stats, timeline, onShowUnits, onShowActivity }: PropertyOverviewTabProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3 lg:gap-6">
      <PropertyInfoCard property={property} />
      <OccupancyBreakdownCard stats={stats} totalUnits={property.totalUnits} />
      <UnitMixCard stats={stats} onShowUnits={onShowUnits} />
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
          <CardDescription>Latest events at this property</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <PropertyTimeline items={timeline.slice(0, 4)} />
          {timeline.length > 4 ? (
            <Button variant="outline" size="sm" className="self-start" onClick={onShowActivity}>
              View all activity
              <ArrowRight data-icon="inline-end" />
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function PropertyInfoCard({ property }: { property: Property }) {
  const items: Array<{ label: string; value: string }> = [
    { label: 'Address', value: formatAddress(property.location) },
    { label: 'Property type', value: PROPERTY_TYPE_LABELS[property.type] },
    { label: 'Total units', value: formatNumber(property.totalUnits) },
    { label: 'Year built', value: property.yearBuilt ? String(property.yearBuilt) : 'Not set' },
    { label: 'Building area', value: property.areaSqft ? `${formatNumber(property.areaSqft)} sq ft` : 'Not set' },
    { label: 'In portfolio since', value: dateFormat.format(new Date(`${property.acquiredAt.slice(0, 10)}T12:00:00`)) },
  ]

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Property information</CardTitle>
        <CardDescription>Key details and description</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.label} className="space-y-0.5">
              <dt className="text-caption text-muted-foreground">{item.label}</dt>
              <dd className="text-body text-foreground">{item.value}</dd>
            </div>
          ))}
        </dl>
        <div className="space-y-1 border-t border-border pt-4">
          <p className="text-caption text-muted-foreground">Description</p>
          <p className="text-body text-foreground">{property.description ?? 'No description added yet.'}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function OccupancyBreakdownCard({ stats, totalUnits }: { stats: UnitStats; totalUnits: number }) {
  const segments = [
    { label: 'Occupied', value: stats.occupied, color: 'bg-chart-1' },
    { label: 'Vacant', value: stats.vacant, color: 'bg-chart-5' },
    { label: 'Under maintenance', value: stats.maintenance, color: 'bg-chart-3' },
    { label: 'Not yet added', value: stats.notAdded, color: 'bg-muted' },
  ].filter((segment) => segment.label !== 'Not yet added' || segment.value > 0)
  const share = (value: number) => (totalUnits === 0 ? 0 : (value / totalUnits) * 100)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Occupancy breakdown</CardTitle>
        <CardDescription>{formatNumber(totalUnits)} total units</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="text-display text-foreground tabular-nums">{formatPercent(stats.occupancyRate)}</p>
          <p className="text-caption text-muted-foreground">occupied</p>
        </div>
        <div
          className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-muted"
          role="img"
          aria-label={segments.map((segment) => `${segment.label} ${segment.value}`).join(', ')}
        >
          {segments.map((segment) =>
            segment.value > 0 ? (
              <span key={segment.label} className={segment.color} style={{ width: `${share(segment.value)}%` }} />
            ) : null,
          )}
        </div>
        <ul className="space-y-2.5">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-3 text-body">
              <span className={`size-2.5 shrink-0 rounded-sm ${segment.color}`} aria-hidden="true" />
              <span className="text-muted-foreground">{segment.label}</span>
              <span className="ml-auto font-semibold text-foreground tabular-nums">{formatNumber(segment.value)}</span>
              <span className="w-12 text-right text-caption text-muted-foreground tabular-nums">
                {formatPercent(share(segment.value))}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function UnitMixCard({ stats, onShowUnits }: { stats: UnitStats; onShowUnits: () => void }) {
  return (
    <Card className="min-w-0 lg:col-span-2">
      <CardHeader>
        <CardTitle>Units overview</CardTitle>
        <CardDescription>Unit mix, occupancy and average rent by type</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onShowUnits}>
            Manage units
            <ArrowRight data-icon="inline-end" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        {stats.byType.length === 0 ? (
          <p className="px-5 text-body text-muted-foreground">No units added yet. Use “Add unit” to set up this property.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-caption font-semibold tracking-wide text-muted-foreground uppercase">Type</TableHead>
                <TableHead className="text-right text-caption font-semibold tracking-wide text-muted-foreground uppercase">Units</TableHead>
                <TableHead className="text-right text-caption font-semibold tracking-wide text-muted-foreground uppercase">Occupied</TableHead>
                <TableHead className="pr-5 text-right text-caption font-semibold tracking-wide text-muted-foreground uppercase">Avg. rent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.byType.map((entry) => (
                <TableRow key={entry.type}>
                  <TableCell className="pl-5 font-medium text-foreground">{UNIT_TYPE_LABELS[entry.type]}</TableCell>
                  <TableCell className="text-right tabular-nums">{entry.count}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {entry.occupied}
                    <span className="ml-1.5 text-caption text-muted-foreground">
                      ({formatPercent(entry.count === 0 ? 0 : (entry.occupied / entry.count) * 100, 0)})
                    </span>
                  </TableCell>
                  <TableCell className="pr-5 text-right font-medium text-foreground tabular-nums">
                    {formatCurrency(entry.averageRent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
