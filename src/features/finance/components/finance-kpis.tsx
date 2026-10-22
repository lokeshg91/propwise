import { CircleDollarSign, HandCoins, Receipt, Scale } from 'lucide-react'

import { TrendIndicator } from '@/components/shared/trend-indicator'
import { type FinanceTotals } from '@/data/domain/finance-summary'
import { ratioPercent } from '@/data/domain/money'
import { type FinanceOverview } from '@/data/services'
import { KpiCard } from '@/features/dashboard/components/kpi-card'
import { useMoney } from '@/features/finance/hooks/use-money'
import { formatNumber, formatPercent, formatSigned } from '@/lib/format'

function Change({ current, previous, inverse = false }: { current: number; previous: number | undefined; inverse?: boolean }) {
  if (previous === undefined) return <p className="text-caption text-muted-foreground">No full previous period yet</p>
  const percent = ratioPercent(current - previous, Math.abs(previous))
  if (previous === 0 || percent === null) return <p className="text-caption text-muted-foreground">No data for the previous period</p>
  return <TrendIndicator change={current - previous} inverse={inverse} label={formatSigned(percent, (value) => formatPercent(value))} context="vs previous period" />
}

/** Cash-basis headline figures with billed and incurred amounts alongside. */
/** `previous` is null when the previous period starts before Finance history (no fair comparison). */
export function FinanceKpis({ totals, previous, receivables }: { totals: FinanceTotals; previous: FinanceTotals | null; receivables: FinanceOverview['receivables'] }) {
  const money = useMoney()
  return (
    <section aria-label="Finance figures" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <KpiCard
        label="Income collected"
        value={money(totals.collectedCents, { whole: true })}
        icon={HandCoins}
        footer={
          <div className="flex flex-col gap-1">
            <Change current={totals.collectedCents} previous={previous?.collectedCents} />
            <p className="text-caption text-muted-foreground">Billed {money(totals.billedCents, { whole: true })}</p>
          </div>
        }
      />
      <KpiCard
        label="Expenses paid"
        value={money(totals.expensesPaidCents, { whole: true })}
        icon={Receipt}
        footer={
          <div className="flex flex-col gap-1">
            <Change current={totals.expensesPaidCents} previous={previous?.expensesPaidCents} inverse />
            <p className="text-caption text-muted-foreground">Incurred {money(totals.expensesIncurredCents, { whole: true })}</p>
          </div>
        }
      />
      <KpiCard
        label="Net cash flow"
        value={money(totals.netCashFlowCents, { whole: true })}
        icon={Scale}
        footer={
          <div className="flex flex-col gap-1">
            <Change current={totals.netCashFlowCents} previous={previous?.netCashFlowCents} />
            <p className="text-caption text-muted-foreground">Collected minus paid</p>
          </div>
        }
      />
      <KpiCard
        label="Outstanding receivables"
        value={money(receivables.outstandingCents, { whole: true })}
        icon={CircleDollarSign}
        footer={
          <div className="flex flex-col gap-1">
            <p className="text-caption text-muted-foreground">
              <span className={receivables.overdueCents > 0 ? 'font-medium text-danger' : undefined}>{money(receivables.overdueCents, { whole: true })} overdue</span>
              {receivables.oldestOverdueDays > 0 ? ` · oldest ${formatNumber(receivables.oldestOverdueDays)} days` : ''}
            </p>
            <p className="text-caption text-muted-foreground">As of today, all periods</p>
          </div>
        }
      />
    </section>
  )
}
