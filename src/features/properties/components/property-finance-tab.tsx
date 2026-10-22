import { ArrowUpRight, Plus, Users } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type PropertyFinance } from '@/data/services'
import { CashFlowCard } from '@/features/finance/components/cash-flow-card'
import { CollectionsCard } from '@/features/finance/components/collections-card'
import { DemoBadge } from '@/features/finance/components/finance-badges'
import { FinanceKpis } from '@/features/finance/components/finance-kpis'
import { MoneyProvider } from '@/features/finance/components/money-provider'
import { ExpenseBreakdownCard, PayablesCard, RecentTransactionsCard, UpcomingCard } from '@/features/finance/components/overview-lists'
import { useMoney } from '@/features/finance/hooks/use-money'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Finance for one property: the Finance overview scoped to it (last 12 months, cash basis). */
export function PropertyFinanceTab({ finance, propertyId, propertyName }: { finance: PropertyFinance; propertyId: string; propertyName: string }) {
  return (
    <MoneyProvider settings={finance.settings}>
      <Content finance={finance} propertyId={propertyId} propertyName={propertyName} />
    </MoneyProvider>
  )
}

function Content({ finance, propertyId, propertyName }: { finance: PropertyFinance; propertyId: string; propertyName: string }) {
  const money = useMoney()
  const id = encodeURIComponent(propertyId)
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-caption text-muted-foreground">
          Last 12 months: {formatDate(finance.range.from)} – {formatDate(finance.range.to)}. Cash basis: money received or paid in the period. Amounts in {finance.settings.currency}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/finance/transactions?property=${id}&range=12m`}>
              Transactions
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/finance?property=${id}&range=12m`}>
              Open in Finance
              <ArrowUpRight data-icon="inline-end" />
            </Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link to={`/finance/expenses/new?propertyId=${id}`}>
              <Plus data-icon="inline-start" />
              Add bill
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to={`/finance/income/new?propertyId=${id}`}>
              <Plus data-icon="inline-start" />
              Add income
            </Link>
          </Button>
        </div>
      </div>

      <FinanceKpis totals={finance.totals} previous={finance.previousTotals} receivables={finance.receivables} />
      <div className="grid gap-4 lg:grid-cols-3">
        <CashFlowCard trend={finance.trend} />
        <CollectionsCard totals={finance.totals} receivables={finance.receivables} />
      </div>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Tenants with a balance</CardTitle>
          <CardDescription>Open balances at {propertyName}, as of today</CardDescription>
          <CardAction>
            <Button asChild size="sm" variant="ghost">
              <Link to={`/finance/receivables?property=${id}`}>Receivables</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {finance.tenants.length === 0 ? (
            <EmptyState size="sm" icon={Users} title="Nobody owes anything" description="Tenants with unpaid charges appear here." />
          ) : (
            <ul aria-label="Tenants with a balance" className="flex flex-col divide-y divide-border">
              {finance.tenants.map((row) => (
                <li key={row.leaseId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-1.5">
                      <Link to={`/tenants/${row.tenantId}?tab=payments`} className={cn('truncate font-medium text-foreground', financeLinkClass)}>
                        {row.tenantName}
                      </Link>
                      {row.demo ? <DemoBadge /> : null}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {row.unitLabel}
                      {row.oldestDueDate ? ` · oldest due ${formatDate(row.oldestDueDate)}` : ''}
                    </p>
                  </div>
                  <span className={cn('shrink-0 text-body font-semibold tabular-nums', row.aging.current < row.balanceCents ? 'text-danger' : 'text-foreground')}>
                    {money(row.balanceCents)}
                    {row.aging.current < row.balanceCents ? <span className="block text-right text-caption font-normal">Overdue</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <RecentTransactionsCard items={finance.recent} />
        <UpcomingCard items={finance.upcoming} />
        <ExpenseBreakdownCard items={finance.expenseBreakdown} />
        <PayablesCard overview={finance} />
      </div>
    </div>
  )
}
