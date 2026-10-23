import { CircleCheckBig, SearchX } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useLoaderData } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { SearchInput } from '@/components/shared/search-input'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { DataTable } from '@/components/tables/data-table'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AGING_BUCKET_LABELS } from '@/data/domain/finance-labels'
import { AGING_BUCKETS } from '@/data/domain/finance-rules'
import { AgingBar } from '@/features/finance/components/aging-bar'
import { DemoBadge } from '@/features/finance/components/finance-badges'
import { FinanceTabs } from '@/features/finance/components/finance-tabs'
import { useMoney } from '@/features/finance/hooks/use-money'
import { useUrlFilters } from '@/features/finance/hooks/use-url-filters'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import {
  DEFAULT_RECEIVABLE_FILTERS,
  filterReceivables,
  parseReceivableFilters,
  summarizeReceivables,
  toReceivableViews,
  type ReceivableView,
} from '@/features/finance/lib/receivable-list'
import { type receivablesLoader } from '@/features/finance/finance.loaders'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'
import { type PropertyType } from '@/types'

const column = createDataTableColumnHelper<ReceivableView>()

function useColumns() {
  const { date: formatDate } = useFormat()
  const money = useMoney()
  return useMemo(
    () =>
      column.columns([
        column.accessor('tenantName', {
          id: 'tenant',
          header: 'Tenant',
          sortFn: 'text',
          cell: (info) => (
            <span className="flex min-w-0 flex-col items-start gap-1">
              <Link to={`/tenants/${info.row.original.tenantId}?tab=payments`} className={cn('block max-w-48 truncate font-medium text-foreground', financeLinkClass)}>
                {info.getValue()}
              </Link>
              {info.row.original.demo ? <DemoBadge /> : null}
            </span>
          ),
        }),
        column.accessor((row) => `${row.propertyName} ${row.unitLabel}`, {
          id: 'property',
          header: 'Property',
          sortFn: 'text',
          cell: (info) => (
            <span className="block min-w-0 max-w-48">
              <span className="block truncate text-foreground">{info.row.original.propertyName}</span>
              <span className="block text-caption text-muted-foreground">{info.row.original.unitLabel}</span>
            </span>
          ),
        }),
        column.accessor('monthlyRentCents', { id: 'rent', header: 'Monthly rent', meta: { align: 'end' }, cell: (info) => money(info.getValue(), { whole: true }) }),
        column.accessor('balanceCents', {
          id: 'balance',
          header: 'Balance',
          meta: { align: 'end' },
          cell: (info) => <span className={cn('font-medium tabular-nums', info.getValue() > 0 ? 'text-foreground' : 'text-muted-foreground')}>{money(info.getValue())}</span>,
        }),
        ...AGING_BUCKETS.map((bucket) =>
          column.accessor((row) => row.aging[bucket], {
            id: bucket,
            header: AGING_BUCKET_LABELS[bucket],
            meta: { align: 'end' as const },
            cell: (info) => (
              <span className={cn('tabular-nums', info.getValue() === 0 ? 'text-muted-foreground' : bucket === 'current' ? 'text-foreground' : 'text-danger')}>
                {info.getValue() === 0 ? '—' : money(info.getValue(), { whole: true })}
              </span>
            ),
          }),
        ),
        column.accessor((row) => row.oldestDueDate ?? '', {
          id: 'oldest',
          header: 'Oldest due',
          sortFn: 'text',
          cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{info.getValue() ? formatDate(info.getValue()) : '—'}</span>,
        }),
        column.accessor((row) => row.lastPaymentOn ?? '', {
          id: 'lastPayment',
          header: 'Last payment',
          sortFn: 'text',
          cell: (info) => <span className="whitespace-nowrap text-muted-foreground">{info.getValue() ? formatDate(info.getValue()) : 'None'}</span>,
        }),
      ]),
    [money, formatDate],
  )
}

export function ReceivablesPage() {
  const { number: formatNumber } = useFormat()
  const { rows, properties } = useLoaderData<typeof receivablesLoader>()
  const { filters, setFilters, clearFilters, hasFilters } = useUrlFilters(DEFAULT_RECEIVABLE_FILTERS, parseReceivableFilters)
  const money = useMoney()
  const columns = useColumns()
  const views = useMemo(() => toReceivableViews(rows, new Map(properties.map((property) => [property.id, property.type]))), [rows, properties])
  const filtered = useMemo(() => filterReceivables(views, filters), [views, filters])
  const summary = useMemo(() => summarizeReceivables(filtered), [filtered])
  const visibleProperties = properties.filter((property) => filters.type === 'all' || property.type === filters.type)

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader title="Receivables" description="What each tenant owes today, by how late it is. Charges not yet due aren’t included." />
      <FinanceTabs />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Total owed</CardTitle>
            <CardDescription>For the tenants shown</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-1">
            <p className="text-h1 text-foreground tabular-nums">{money(summary.balanceCents)}</p>
            <p className="text-caption text-muted-foreground">
              <span className={summary.overdueCents > 0 ? 'font-medium text-danger' : undefined}>{money(summary.overdueCents)} overdue</span> ·{' '}
              {formatNumber(summary.withBalance)} {summary.withBalance === 1 ? 'tenant' : 'tenants'} with a balance
            </p>
          </CardContent>
        </Card>
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader>
            <CardTitle>Aging</CardTitle>
            <CardDescription>Open balances by days past the due date</CardDescription>
          </CardHeader>
          <CardContent>
            <AgingBar aging={summary.aging} label="Tenant balances by age" />
          </CardContent>
        </Card>
      </div>

      <Card className="min-w-0 pb-4">
        <CardContent className="flex flex-col gap-4 px-0">
          <div className="flex flex-col gap-3 px-5 lg:flex-row lg:items-center">
            <SearchInput label="Search receivables" placeholder="Tenant, property or unit…" value={filters.q} onValueChange={(q) => setFilters({ q })} className="lg:max-w-80 lg:flex-1" />
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:ml-auto lg:flex lg:items-center">
              <Select
                value={filters.type}
                onValueChange={(type) => setFilters({ type: type as PropertyType | 'all', property: 'all' })}
              >
                <SelectTrigger aria-label="Property type" className="w-full lg:w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All property types</SelectItem>
                  <SelectItem value="residential">Residential</SelectItem>
                  <SelectItem value="commercial">Commercial</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filters.property} onValueChange={(property) => setFilters({ property })}>
                <SelectTrigger aria-label="Property" className="w-full lg:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="all">All properties</SelectItem>
                  {visibleProperties.map((property) => (
                    <SelectItem key={property.id} value={property.id}>
                      {property.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-body font-medium text-foreground">
                <Switch checked={filters.open} onCheckedChange={(open) => setFilters({ open })} size="sm" />
                Only with a balance
              </label>
              {hasFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="justify-self-start">
                  Reset filters
                </Button>
              ) : null}
            </div>
          </div>

          <DataTable
            caption="Receivables by tenant. Column headers are sortable."
            data={filtered}
            columns={columns}
            initialSorting={[{ id: 'balance', desc: true }]}
            pageSize={20}
            getRowId={(row) => row.leaseId}
            itemLabel="tenants"
            minWidth="76rem"
            renderMobileRow={(row) => <ReceivableCard row={row} />}
            emptyState={
              filters.open && !filters.q && filters.property === 'all' && filters.type === 'all' ? (
                <EmptyState size="sm" icon={CircleCheckBig} title="Nobody owes anything right now" description="Every charge that’s due has been paid." />
              ) : (
                <EmptyState
                  size="sm"
                  icon={SearchX}
                  title="No tenants match your filters"
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
      <p className="text-caption text-muted-foreground">Income that isn’t billed to a tenant (for example laundry revenue) is listed in Transactions.</p>
    </PageContainer>
  )
}

function ReceivableCard({ row }: { row: ReceivableView }) {
  const { date: formatDate } = useFormat()
  const money = useMoney()
  const late = AGING_BUCKETS.filter((bucket) => bucket !== 'current' && row.aging[bucket] > 0)
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <Link to={`/tenants/${row.tenantId}?tab=payments`} className={cn('block truncate font-medium text-foreground', financeLinkClass)}>
            {row.tenantName}
          </Link>
          <span className="block truncate text-caption text-muted-foreground">
            {row.propertyName} · {row.unitLabel}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-label text-foreground tabular-nums">{money(row.balanceCents)}</span>
          {row.demo ? <DemoBadge /> : null}
        </span>
      </div>
      <p className="text-caption text-muted-foreground">
        {late.length > 0 ? late.map((bucket) => `${AGING_BUCKET_LABELS[bucket]}: ${money(row.aging[bucket], { whole: true })}`).join(' · ') : 'Nothing overdue'}
      </p>
      <p className="border-t border-border pt-2.5 text-caption text-muted-foreground">
        Oldest due {row.oldestDueDate ? formatDate(row.oldestDueDate) : '—'} · Last payment {row.lastPaymentOn ? formatDate(row.lastPaymentOn) : 'none'}
      </p>
    </div>
  )
}
