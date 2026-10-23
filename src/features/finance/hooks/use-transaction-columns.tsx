import { useMemo } from 'react'
import { Link } from 'react-router'

import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { type TransactionRow } from '@/data/services'
import { DemoBadge, KindLabel } from '@/features/finance/components/finance-badges'
import { TransactionParty, TransactionStatus } from '@/features/finance/components/transaction-parts'
import { useMoney } from '@/features/finance/hooks/use-money'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { categoryLabel } from '@/features/finance/lib/transaction-list'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

const column = createDataTableColumnHelper<TransactionRow>()

/** Columns for the transactions table (money formatted in the Finance currency). */
export function useTransactionColumns() {
  const { date: formatDate } = useFormat()
  const money = useMoney()
  return useMemo(
    () =>
      column.columns([
        column.accessor('date', {
          id: 'date',
          header: 'Date',
          sortFn: 'text',
          cell: (info) => (
            <span className="block whitespace-nowrap">
              <span className="block text-foreground">{formatDate(info.getValue())}</span>
              <span className="block text-caption text-muted-foreground">{info.row.original.kind === 'income' ? 'Due' : 'Billed'}</span>
            </span>
          ),
        }),
        column.accessor('reference', {
          id: 'reference',
          header: 'Reference',
          sortFn: 'alphanumeric',
          cell: (info) => (
            <span className="flex flex-col items-start gap-1">
              <Link to={`/finance/transactions/${info.row.original.id}`} className={cn('font-medium whitespace-nowrap text-foreground tabular-nums', financeLinkClass)}>
                {info.getValue()}
              </Link>
              {info.row.original.demo ? <DemoBadge /> : null}
            </span>
          ),
        }),
        column.accessor((row) => `${row.kind} ${categoryLabel(row)}`, {
          id: 'type',
          header: 'Type',
          sortFn: 'text',
          cell: (info) => (
            <span className="flex flex-col gap-0.5">
              <KindLabel kind={info.row.original.kind} />
              <span className="text-caption text-muted-foreground">{categoryLabel(info.row.original)}</span>
            </span>
          ),
        }),
        column.accessor('party', {
          id: 'party',
          header: 'Tenant / payee',
          sortFn: 'text',
          cell: (info) => (
            <span className="block min-w-0 max-w-56">
              <TransactionParty row={info.row.original} />
              {info.row.original.description ? <span className="block truncate text-caption text-muted-foreground">{info.row.original.description}</span> : null}
            </span>
          ),
        }),
        column.accessor((row) => `${row.propertyName} ${row.unitLabel}`, {
          id: 'property',
          header: 'Property',
          sortFn: 'text',
          cell: (info) => (
            <span className="block min-w-0 max-w-52">
              <Link to={`/properties/${info.row.original.propertyId}?tab=finance`} className={cn('block truncate text-foreground', financeLinkClass)}>
                {info.row.original.propertyName}
              </Link>
              {info.row.original.unitLabel ? <span className="block text-caption text-muted-foreground">{info.row.original.unitLabel}</span> : null}
            </span>
          ),
        }),
        column.accessor('amountCents', {
          id: 'amount',
          header: 'Amount',
          meta: { align: 'end' },
          cell: (info) => (
            <span className={cn('tabular-nums', (info.row.original.kind === 'income' ? info.row.original.state.status : info.row.original.status) === 'void' && 'text-muted-foreground line-through')}>
              {money(info.getValue())}
            </span>
          ),
        }),
        column.accessor('balanceCents', {
          id: 'balance',
          header: 'Open',
          meta: { align: 'end' },
          cell: (info) => <span className={cn('tabular-nums', info.getValue() > 0 ? 'font-medium text-foreground' : 'text-muted-foreground')}>{info.getValue() > 0 ? money(info.getValue()) : '—'}</span>,
        }),
        column.accessor((row) => (row.kind === 'income' ? row.state.status : row.status), {
          id: 'status',
          header: 'Status',
          sortFn: 'text',
          cell: (info) => <TransactionStatus row={info.row.original} />,
        }),
      ]),
    [money, formatDate],
  )
}
