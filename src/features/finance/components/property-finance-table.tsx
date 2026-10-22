import { Building2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { DataTable } from '@/components/tables/data-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type PropertyFinanceRow } from '@/data/domain/finance-summary'
import { PropertyTypeLabel } from '@/features/properties/components/property-badges'
import { useMoney } from '@/features/finance/hooks/use-money'
import { formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

const column = createDataTableColumnHelper<PropertyFinanceRow>()
const linkClass = 'rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'
const rate = (value: number | null) => (value === null ? '—' : formatPercent(value))

function useColumns(money: ReturnType<typeof useMoney>) {
  return useMemo(
    () =>
      column.columns([
        column.accessor('name', {
          id: 'property',
          header: 'Property',
          sortFn: 'text',
          cell: (info) => (
            <span className="block min-w-0">
              <Link to={`/finance/transactions?property=${info.row.original.propertyId}&range=all`} className={`block truncate ${linkClass}`}>
                {info.getValue()}
              </Link>
              <PropertyTypeLabel type={info.row.original.type} />
            </span>
          ),
        }),
        column.accessor((row) => row.totals.billedCents, { id: 'billed', header: 'Billed', meta: { align: 'end' }, cell: (info) => money(info.getValue(), { whole: true }) }),
        column.accessor((row) => row.totals.collectedCents, { id: 'collected', header: 'Collected', meta: { align: 'end' }, cell: (info) => money(info.getValue(), { whole: true }) }),
        column.accessor((row) => row.totals.collectionRate ?? -1, { id: 'rate', header: 'Collection', meta: { align: 'end' }, cell: (info) => rate(info.row.original.totals.collectionRate) }),
        column.accessor((row) => row.totals.expensesPaidCents, { id: 'expenses', header: 'Expenses paid', meta: { align: 'end' }, cell: (info) => money(info.getValue(), { whole: true }) }),
        column.accessor((row) => row.totals.netCashFlowCents, {
          id: 'net',
          header: 'Net cash flow',
          meta: { align: 'end' },
          cell: (info) => <span className={cn('font-medium', info.getValue() < 0 && 'text-danger')}>{money(info.getValue(), { whole: true })}</span>,
        }),
        column.accessor('outstandingCents', {
          id: 'outstanding',
          header: 'Outstanding',
          meta: { align: 'end' },
          cell: (info) => (
            <span className="block">
              {money(info.getValue(), { whole: true })}
              {info.row.original.overdueCents > 0 ? (
                <span className="block text-caption text-danger">
                  {info.row.original.overdueCents === info.getValue() ? 'All overdue' : `${money(info.row.original.overdueCents, { whole: true })} overdue`}
                </span>
              ) : null}
            </span>
          ),
        }),
        column.accessor((row) => row.occupancy ?? -1, { id: 'occupancy', header: 'Occupancy', meta: { align: 'end' }, cell: (info) => rate(info.row.original.occupancy) }),
      ]),
    [money],
  )
}

/** Per-property figures for the period (outstanding is as of today). */
export function PropertyFinanceTable({ rows }: { rows: PropertyFinanceRow[] }) {
  const money = useMoney()
  const columns = useColumns(money)
  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Property performance</CardTitle>
        <CardDescription>Collected, paid and outstanding by property</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <DataTable
          caption="Property performance. Column headers are sortable."
          data={rows}
          columns={columns}
          initialSorting={[{ id: 'collected', desc: true }]}
          pageSize={12}
          getRowId={(row) => row.propertyId}
          itemLabel="properties"
          minWidth="58rem"
          emptyState={<EmptyState size="sm" icon={Building2} title="No properties match these filters" />}
          renderMobileRow={(row) => (
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <Link to={`/finance/transactions?property=${row.propertyId}&range=all`} className={`block truncate ${linkClass}`}>
                    {row.name}
                  </Link>
                  <PropertyTypeLabel type={row.type} />
                </span>
                <span className={cn('text-label tabular-nums', row.totals.netCashFlowCents < 0 ? 'text-danger' : 'text-foreground')}>{money(row.totals.netCashFlowCents, { whole: true })}</span>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-caption">
                <div>
                  <dt className="text-muted-foreground">Collected</dt>
                  <dd className="text-foreground tabular-nums">{money(row.totals.collectedCents, { whole: true })}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Expenses</dt>
                  <dd className="text-foreground tabular-nums">{money(row.totals.expensesPaidCents, { whole: true })}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Outstanding</dt>
                  <dd className={cn('tabular-nums', row.overdueCents > 0 ? 'text-danger' : 'text-foreground')}>{money(row.outstandingCents, { whole: true })}</dd>
                </div>
              </dl>
              <p className="text-caption text-muted-foreground">
                Collection {rate(row.totals.collectionRate)} · Occupancy {rate(row.occupancy)}
              </p>
            </div>
          )}
        />
      </CardContent>
    </Card>
  )
}
