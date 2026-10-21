import { Info, Receipt } from 'lucide-react'
import { useMemo } from 'react'

import { EmptyState } from '@/components/shared/empty-state'
import { DataTable } from '@/components/tables/data-table'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { Badge } from '@/components/ui/badge'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type TenantDetail } from '@/data/services'
import { RentChargeBadge } from '@/features/tenants/components/tenant-badges'
import { summarizeLedger } from '@/features/tenants/lib/tenant-detail'
import { RENT_CHARGE_LABELS } from '@/features/tenants/lib/tenant-meta'
import { formatCurrency, formatDate, formatMonth, formatPercent } from '@/lib/format'
import { type RentCharge } from '@/types'

const column = createDataTableColumnHelper<RentCharge>()

const columns = column.columns([
  column.accessor('period', {
    header: 'Period',
    sortFn: 'text',
    cell: (info) => <span className="font-medium text-foreground">{formatMonth(info.getValue(), 'long')}</span>,
  }),
  column.accessor('dueDate', {
    header: 'Due date',
    sortFn: 'text',
    cell: (info) => formatDate(info.getValue()),
  }),
  column.accessor('amount', {
    header: 'Amount',
    meta: { align: 'end' },
    cell: (info) => <span className="tabular-nums">{formatCurrency(info.getValue())}</span>,
  }),
  column.accessor((row) => RENT_CHARGE_LABELS[row.status], {
    id: 'status',
    header: 'Status',
    sortFn: 'text',
    cell: (info) => <RentChargeBadge status={info.row.original.status} />,
  }),
  column.accessor((row) => row.paidAt ?? '', {
    id: 'paidAt',
    header: 'Paid on',
    sortFn: 'text',
    cell: (info) => {
      const charge = info.row.original
      if (!charge.paidAt) return <span className="text-muted-foreground">—</span>
      return (
        <span>
          {formatDate(charge.paidAt)}
          {charge.late ? <span className="ml-2 text-caption text-warning">Late</span> : null}
        </span>
      )
    },
  }),
])

function ChargeCard({ charge }: { charge: RentCharge }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-body font-medium text-foreground">{formatMonth(charge.period, 'long')}</p>
        <p className="text-caption text-muted-foreground">
          Due {formatDate(charge.dueDate)}
          {charge.paidAt ? ` · paid ${formatDate(charge.paidAt)}${charge.late ? ' (late)' : ''}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-body font-semibold text-foreground tabular-nums">{formatCurrency(charge.amount)}</span>
        <RentChargeBadge status={charge.status} />
      </div>
    </div>
  )
}

/** Generated sample ledger: deterministic for each lease, never a real payment record. */
export function TenantPaymentsTab({ detail }: { detail: TenantDetail }) {
  const summary = useMemo(() => summarizeLedger(detail.ledger), [detail.ledger])
  const items = [
    { label: 'Paid to date', value: formatCurrency(summary.paidTotal), note: `${summary.paidCount} payments` },
    { label: 'On-time rate', value: formatPercent(summary.onTimeRate, 0), note: 'Of paid charges' },
    {
      label: 'Overdue',
      value: formatCurrency(summary.overdueTotal),
      note: summary.overdueCount > 0 ? `${summary.overdueCount} ${summary.overdueCount === 1 ? 'charge' : 'charges'}` : 'Nothing overdue',
      danger: summary.overdueCount > 0,
    },
    {
      label: 'Next charge',
      value: summary.next ? formatCurrency(summary.next.amount) : '—',
      note: summary.next ? `Due ${formatDate(summary.next.dueDate)}` : 'No upcoming charges',
    },
  ]

  return (
    <Card className="min-w-0 pb-4">
      <CardHeader>
        <CardTitle>Payment history</CardTitle>
        <CardDescription>Monthly rent charges for the {detail.lease?.status === 'active' ? 'current' : 'most recent'} lease</CardDescription>
        <CardAction>
          <Badge variant="info">Demo data</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-5 px-0">
        <p className="mx-5 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2.5 text-caption text-foreground dark:bg-info/15">
          <Info className="mt-px size-4 shrink-0 text-info" aria-hidden="true" />
          Generated sample records. Propwise doesn’t process payments; connect your payment provider in the service layer.
        </p>
        {detail.ledger.length === 0 ? (
          <EmptyState size="sm" icon={Receipt} title="No charges yet" description="Charges appear once the lease starts." />
        ) : (
          <>
            <dl className="mx-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
              {items.map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-4">
                  <dt className="text-caption text-muted-foreground">{item.label}</dt>
                  <dd className={item.danger ? 'mt-1 text-h3 text-danger tabular-nums' : 'mt-1 text-h3 text-foreground tabular-nums'}>{item.value}</dd>
                  <dd className="text-caption text-muted-foreground">{item.note}</dd>
                </div>
              ))}
            </dl>
            <DataTable
              caption="Rent charges (demo data). Column headers are sortable."
              data={detail.ledger}
              columns={columns}
              initialSorting={[{ id: 'period', desc: true }]}
              pageSize={12}
              getRowId={(row) => row.id}
              itemLabel="charges"
              minWidth="40rem"
              renderMobileRow={(row) => <ChargeCard charge={row} />}
              emptyState={<EmptyState size="sm" icon={Receipt} title="No charges" description="Nothing to show." />}
            />
          </>
        )}
      </CardContent>
    </Card>
  )
}
