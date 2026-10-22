import { CalendarClock, History, PieChart, Wallet } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { type CashMovement, type UpcomingItem } from '@/data/domain/finance-summary'
import { type FinanceOverview } from '@/data/services'
import { DemoBadge, KindLabel, ScheduledBadge } from '@/features/finance/components/finance-badges'
import { useMoney } from '@/features/finance/hooks/use-money'
import { formatDate, formatMonth, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

const linkClass = 'rounded-sm font-medium text-foreground outline-none hover:text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

/** Latest money in (payments) and out (bills paid). */
export function RecentTransactionsCard({ items }: { items: CashMovement[] }) {
  const money = useMoney()
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Recent transactions</CardTitle>
        <CardDescription>Latest payments received and bills paid</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState size="sm" icon={History} title="No transactions yet" description="Payments and paid bills will appear here." />
        ) : (
          <ul className="flex flex-col divide-y divide-border" aria-label="Recent transactions">
            {items.map((item) => {
              const record = item.kind === 'payment' ? item.charge : item.expense
              const label = item.kind === 'payment' ? INCOME_CATEGORY_LABELS[item.charge.category] : EXPENSE_CATEGORY_LABELS[item.expense.category]
              const detail = item.kind === 'payment' ? PAYMENT_METHOD_LABELS[item.payment.method] : (item.expense.paymentMethod ? PAYMENT_METHOD_LABELS[item.expense.paymentMethod] : 'Paid')
              return (
                <li key={`${item.kind}-${item.id}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="min-w-0">
                    <Link to={`/finance/transactions/${record.id}`} className={`block truncate text-body ${linkClass}`}>
                      {record.reference} · {label}
                    </Link>
                    <span className="block truncate text-caption text-muted-foreground">
                      {formatDate(item.date)} · {detail}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <span className={cn('text-label tabular-nums', item.kind === 'payment' ? 'text-success' : 'text-foreground')}>
                      {item.kind === 'payment' ? '+' : '−'}
                      {money(item.amountCents)}
                    </span>
                    <KindLabel kind={item.kind === 'payment' ? 'income' : 'expense'} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** What's due in the next 30 days: open charges, projected rent and unpaid bills. */
export function UpcomingCard({ items }: { items: UpcomingItem[] }) {
  const money = useMoney()
  const projected = new Map<string, { period: string; date: string; amountCents: number; count: number }>()
  for (const item of items) {
    if (item.kind !== 'projected-rent') continue
    const entry = projected.get(item.period) ?? { period: item.period, date: item.date, amountCents: 0, count: 0 }
    entry.amountCents += item.amountCents
    entry.count += 1
    if (item.date < entry.date) entry.date = item.date
    projected.set(item.period, entry)
  }
  const records = items.filter((item) => item.kind !== 'projected-rent')
  const shown = records.slice(0, 6)
  const incoming = items.filter((item) => item.kind !== 'expense').reduce((sum, item) => sum + item.amountCents, 0)
  const outgoing = items.filter((item) => item.kind === 'expense').reduce((sum, item) => sum + item.amountCents, 0)
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Upcoming 30 days</CardTitle>
        <CardDescription>
          Expected in {money(incoming, { whole: true })} · due out {money(outgoing, { whole: true })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {shown.length === 0 && projected.size === 0 ? (
          <EmptyState size="sm" icon={CalendarClock} title="Nothing due in the next 30 days" />
        ) : (
          <ul className="flex flex-col divide-y divide-border" aria-label="Upcoming obligations">
            {[...projected.values()].map((entry) => (
              <li key={`projected-${entry.period}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <span className="block truncate text-body font-medium text-foreground">Rent for {formatMonth(entry.period, 'long')}</span>
                  <span className="block text-caption text-muted-foreground">
                    {formatNumber(entry.count)} {entry.count === 1 ? 'lease' : 'leases'} · from {formatDate(entry.date)}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className="text-label text-success tabular-nums">{money(entry.amountCents, { whole: true })}</span>
                  <ScheduledBadge />
                </span>
              </li>
            ))}
            {shown.map((item) => (
              <li key={`${item.kind}-${item.kind === 'charge' ? item.charge.id : item.expense.id}`} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="min-w-0">
                  <Link to={`/finance/transactions/${item.kind === 'charge' ? item.charge.id : item.expense.id}`} className={`block truncate text-body ${linkClass}`}>
                    {item.kind === 'charge' ? `${item.charge.reference} · ${INCOME_CATEGORY_LABELS[item.charge.category]}` : `${item.expense.reference} · ${EXPENSE_CATEGORY_LABELS[item.expense.category]}`}
                  </Link>
                  <span className="block text-caption text-muted-foreground">Due {formatDate(item.date)}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  <span className={cn('text-label tabular-nums', item.kind === 'expense' ? 'text-foreground' : 'text-success')}>{money(item.amountCents)}</span>
                  <KindLabel kind={item.kind === 'charge' ? 'income' : 'expense'} />
                </span>
              </li>
            ))}
          </ul>
        )}
        {records.length > shown.length ? (
          <p className="text-caption text-muted-foreground">
            {formatNumber(records.length - shown.length)} more.{' '}
            <Link to="/finance/transactions?status=unpaid&range=all" className="text-primary underline-offset-4 hover:underline">
              See unpaid records
            </Link>
          </p>
        ) : null}
        <p className="text-caption text-muted-foreground">“Scheduled” rent is projected from current leases and isn’t a record yet.</p>
      </CardContent>
    </Card>
  )
}

/** Expenses paid in the period, by category. */
export function ExpenseBreakdownCard({ items }: { items: FinanceOverview['expenseBreakdown'] }) {
  const money = useMoney()
  const total = items.reduce((sum, item) => sum + item.amountCents, 0)
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Expenses by category</CardTitle>
        <CardDescription>Bills paid in the period</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState size="sm" icon={PieChart} title="No bills paid in this period" />
        ) : (
          <ul className="flex flex-col gap-3" aria-label="Expenses by category">
            {items.map((item) => {
              const share = total > 0 ? (item.amountCents / total) * 100 : 0
              return (
                <li key={item.category} className="flex flex-col gap-1">
                  <span className="flex items-baseline justify-between gap-3 text-body">
                    <span className="truncate text-foreground">{EXPENSE_CATEGORY_LABELS[item.category]}</span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {money(item.amountCents, { whole: true })} <span className="text-caption text-muted-foreground">· {Math.round(share)}%</span>
                    </span>
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-chart-2" style={{ width: `${share}%` }} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Unpaid bills, committed maintenance and deposits held (deposits are never income). */
export function PayablesCard({ overview }: { overview: FinanceOverview }) {
  const money = useMoney()
  const { payables } = overview
  const rows = [
    { label: 'Unpaid bills', value: `${money(payables.unpaidCents, { whole: true })}`, note: `${formatNumber(payables.unpaidCount)} ${payables.unpaidCount === 1 ? 'bill' : 'bills'}` },
    { label: 'Overdue bills', value: money(payables.overdueCents, { whole: true }), note: 'Past their due date', tone: payables.overdueCents > 0 ? 'text-danger' : undefined },
    { label: 'Committed maintenance', value: money(payables.committedMaintenanceCents, { whole: true }), note: 'Estimates on open work orders' },
    { label: 'Security deposits held', value: money(overview.depositsHeldCents, { whole: true }), note: 'Current leases; not counted as income' },
  ]
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Payables and commitments</CardTitle>
        <CardDescription>As of today, all periods</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label} className="flex min-w-0 items-start gap-3 rounded-lg border border-border p-3">
              <Wallet className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-caption text-muted-foreground">{row.label}</dt>
                <dd className={cn('text-h3 tabular-nums text-foreground', row.tone)}>{row.value}</dd>
                <dd className="text-caption text-muted-foreground">{row.note}</dd>
              </div>
            </div>
          ))}
        </dl>
        {overview.completedWithoutCost > 0 ? (
          <p className="text-caption text-muted-foreground">
            {formatNumber(overview.completedWithoutCost)} completed {overview.completedWithoutCost === 1 ? 'job has' : 'jobs have'} no final cost, so no bill was created.
          </p>
        ) : null}
        <p className="flex items-center gap-2 text-caption text-muted-foreground">
          <DemoBadge /> Sample records are fictional and stored only in this browser.
        </p>
      </CardContent>
    </Card>
  )
}
