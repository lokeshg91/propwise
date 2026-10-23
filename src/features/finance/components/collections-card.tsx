import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type FinanceTotals, type ReceivablesPosition } from '@/data/domain/finance-summary'
import { AgingBar } from '@/features/finance/components/aging-bar'
import { useMoney } from '@/features/finance/hooks/use-money'
import { useFormat } from '@/hooks/use-format'

/** Billed vs collected for charges due in the period, and open balances by age. */
export function CollectionsCard({ totals, receivables }: { totals: FinanceTotals; receivables: ReceivablesPosition }) {
  const { percent: formatPercent } = useFormat()
  const money = useMoney()
  const rate = totals.collectionRate
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Collections</CardTitle>
        <CardDescription>Charges due in the period, paid to date</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-caption text-muted-foreground">Collection rate</p>
            <p className="text-h2 text-foreground tabular-nums">{rate === null ? 'No charges' : formatPercent(rate)}</p>
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Collection rate"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={rate ?? 0}
          >
            <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.min(rate ?? 0, 100)}%` }} />
          </div>
          <p className="text-caption text-muted-foreground">
            Billed <span className="font-medium text-foreground tabular-nums">{money(totals.billedCents, { whole: true })}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-label text-foreground">Open balances by age</p>
          <AgingBar aging={receivables.aging} />
        </div>
      </CardContent>
    </Card>
  )
}
