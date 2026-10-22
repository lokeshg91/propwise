import { Link } from 'react-router'

import { type TransactionRow } from '@/data/services'
import { DemoBadge, KindLabel } from '@/features/finance/components/finance-badges'
import { TransactionParty, TransactionStatus } from '@/features/finance/components/transaction-parts'
import { useMoney } from '@/features/finance/hooks/use-money'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { categoryLabel } from '@/features/finance/lib/transaction-list'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Card layout for the transactions list on tablet and mobile. */
export function TransactionCard({ row }: { row: TransactionRow }) {
  const money = useMoney()
  const isVoid = (row.kind === 'income' ? row.state.status : row.status) === 'void'
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <Link to={`/finance/transactions/${row.id}`} className={cn('font-medium text-foreground tabular-nums', financeLinkClass)}>
            {row.reference}
          </Link>
          <span className="mt-0.5 flex flex-wrap items-center gap-2">
            <KindLabel kind={row.kind} />
            <span className="text-caption text-muted-foreground">{categoryLabel(row)}</span>
            {row.demo ? <DemoBadge /> : null}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className={cn('text-label tabular-nums text-foreground', isVoid && 'text-muted-foreground line-through')}>{money(row.amountCents)}</span>
          {row.balanceCents > 0 && row.balanceCents !== row.amountCents ? <span className="text-caption text-muted-foreground tabular-nums">{money(row.balanceCents)} open</span> : null}
        </span>
      </div>
      <div className="min-w-0 text-caption">
        <TransactionParty row={row} />
        <span className="block truncate text-muted-foreground">
          {row.propertyName}
          {row.unitLabel ? ` · ${row.unitLabel}` : ''}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
        <TransactionStatus row={row} />
        <span className="text-caption text-muted-foreground">
          {row.kind === 'income' ? 'Due' : 'Billed'} {formatDate(row.date)}
        </span>
      </div>
    </div>
  )
}
