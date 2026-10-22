import { Link } from 'react-router'

import { type TransactionRow } from '@/data/services'
import { ChargeStatusBadge, ExpenseStatusBadge } from '@/features/finance/components/finance-badges'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { cn } from '@/lib/utils'

/** Status badge plus "Overdue by N days" in words, never colour alone. */
export function TransactionStatus({ row }: { row: TransactionRow }) {
  if (row.kind === 'income') {
    const { state } = row
    return (
      <span className="flex flex-col items-start gap-1">
        <ChargeStatusBadge status={state.status} />
        {state.daysOverdue > 0 ? <span className="text-caption text-danger">Overdue by {state.daysOverdue} {state.daysOverdue === 1 ? 'day' : 'days'}</span> : null}
        {state.paidLate ? <span className="text-caption text-muted-foreground">Paid late</span> : null}
      </span>
    )
  }
  return <ExpenseStatusBadge status={row.status} />
}

export function TransactionParty({ row }: { row: TransactionRow }) {
  if (!row.party) return <span className="text-muted-foreground">—</span>
  return row.partyHref ? (
    <Link to={row.partyHref} className={cn('block truncate text-foreground', financeLinkClass)}>
      {row.party}
    </Link>
  ) : (
    <span className="block truncate text-foreground">{row.party}</span>
  )
}

