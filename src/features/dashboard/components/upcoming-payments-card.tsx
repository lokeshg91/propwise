import { ArrowRight, CalendarCheck } from 'lucide-react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/shared/empty-state'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PAYMENT_WINDOW_DAYS } from '@/features/dashboard/lib/dashboard-selectors'
import { PaymentStatusBadge } from '@/features/finance/components/payment-status-badge'
import { formatCurrency, formatDueLabel, formatShortDate, getInitials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { type PaymentRow } from '@/types'

const VISIBLE_ROWS = 6

export function UpcomingPaymentsCard({ payments }: { payments: PaymentRow[] }) {
  const totalDue = payments.reduce((sum, payment) => sum + payment.amount, 0)
  const overdue = payments.filter((payment) => payment.status === 'overdue')
  const visible = payments.slice(0, VISIBLE_ROWS)
  const hidden = payments.length - visible.length

  return (
    <Card className="pb-0">
      <CardHeader>
        <CardTitle>Upcoming rent payments</CardTitle>
        <CardDescription>
          Due in the next {PAYMENT_WINDOW_DAYS} days
          {overdue.length > 0 ? ` · ${overdue.length} overdue` : ''}
        </CardDescription>
        <CardAction className="text-right">
          <p className="text-h3 text-foreground tabular-nums">{formatCurrency(totalDue)}</p>
          <p className="text-caption text-muted-foreground">{payments.length} payments</p>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {visible.length === 0 ? (
          <EmptyState
            size="sm"
            icon={CalendarCheck}
            title="No payments due"
            description="Nothing is due or overdue for the selected properties in the next two weeks."
          />
        ) : (
          <ul className="-my-2 divide-y divide-border">
            {visible.map((payment) => (
              <li key={payment.id} className="flex items-center gap-3 py-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-muted text-caption font-semibold text-muted-foreground">
                    {getInitials(payment.tenantName)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body font-medium text-foreground">{payment.tenantName}</p>
                  <p className="truncate text-caption text-muted-foreground">
                    {payment.propertyName} · {payment.unit}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-body font-semibold text-foreground tabular-nums">
                    {formatCurrency(payment.amount)}
                  </span>
                  <span className="flex items-center gap-2">
                    <time
                      dateTime={payment.dueDate}
                      title={formatShortDate(payment.dueDate)}
                      className={cn(
                        'hidden text-caption min-[420px]:inline',
                        payment.status === 'overdue' ? 'font-medium text-danger' : 'text-muted-foreground',
                      )}
                    >
                      {formatDueLabel(payment.dueDate)}
                    </time>
                    <PaymentStatusBadge status={payment.status} />
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <CardFooter className="justify-between gap-3 bg-transparent py-3">
        <span className="text-caption text-muted-foreground">
          {hidden > 0 ? `+${hidden} more in the next ${PAYMENT_WINDOW_DAYS} days` : 'All upcoming payments shown'}
        </span>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/finance">
            Open finance
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
