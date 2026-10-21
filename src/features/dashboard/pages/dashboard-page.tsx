import { Building2, CalendarClock, Percent, Plus, Wallet, Wrench } from 'lucide-react'
import { toast } from 'sonner'

import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BarChartPlaceholder, DonutChartPlaceholder } from '@/features/dashboard/components/chart-placeholder'
import { KpiCardPlaceholder } from '@/features/dashboard/components/kpi-card-placeholder'

const KPIS = [
  { label: 'Total properties', icon: Building2 },
  { label: 'Occupancy rate', icon: Percent },
  { label: 'Rent collected', icon: Wallet },
  { label: 'Open work orders', icon: Wrench },
] as const

const PERIODS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: '12m', label: 'Last 12 months' },
] as const

/**
 * Overview layout shell. Widgets render as placeholders until the dashboard
 * module (Phase 3) connects them to sample data.
 */
export function DashboardPage() {
  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description="Portfolio performance, occupancy and activity across all your properties."
        meta={<Badge variant="brand">Layout preview</Badge>}
        actions={
          <>
            <Select defaultValue="30d">
              <SelectTrigger aria-label="Reporting period" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                {PERIODS.map((period) => (
                  <SelectItem key={period.value} value={period.value}>
                    {period.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() =>
                toast('Adding properties arrives with the Properties module.', {
                  description: 'This action is a placeholder in the current release.',
                })
              }
            >
              <Plus data-icon="inline-start" />
              Add property
            </Button>
          </>
        }
      />

      <section aria-label="Key metrics" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {KPIS.map((kpi) => (
          <KpiCardPlaceholder key={kpi.label} label={kpi.label} icon={kpi.icon} />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue &amp; expenses</CardTitle>
            <CardDescription>Monthly cash flow across the portfolio</CardDescription>
            <CardAction>
              <Badge variant="neutral">12 months</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>
            <BarChartPlaceholder />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Occupancy by type</CardTitle>
            <CardDescription>Residential, commercial and mixed-use</CardDescription>
          </CardHeader>
          <CardContent>
            <DonutChartPlaceholder />
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent work orders</CardTitle>
            <CardDescription>Latest maintenance requests from tenants</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-5">Request</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="hidden sm:table-cell">Priority</TableHead>
                  <TableHead className="pr-5 text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[0, 1, 2, 3].map((row) => (
                  <TableRow key={row} className="hover:bg-transparent">
                    <TableCell className="pl-5">
                      <Skeleton className="h-4 w-32 sm:w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-20 sm:w-28" />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell className="pr-5">
                      <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Upcoming renewals</CardTitle>
            <CardDescription>Leases ending in the next 60 days</CardDescription>
            <CardAction>
              <CalendarClock className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardAction>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </PageContainer>
  )
}
