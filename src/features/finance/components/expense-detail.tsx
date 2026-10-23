import { Ban, CalendarClock, CircleAlert, CircleCheck, Lock, Pencil, Undo2 } from 'lucide-react'
import { Link } from 'react-router'

import { ActivityTimeline } from '@/components/shared/activity-timeline'
import { DetailList } from '@/components/shared/detail-list'
import { StatusAlert } from '@/components/shared/status-alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { daysBetween, todayIso } from '@/data/domain/dates'
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { costVariancePercent } from '@/data/domain/finance-rules'
import { type TransactionDetail } from '@/data/services'
import { VendorLink } from '@/features/maintenance/components/vendor-link'
import { DemoBadge, ExpenseStatusBadge } from '@/features/finance/components/finance-badges'
import { useMoney } from '@/features/finance/hooks/use-money'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { toActivityItems } from '@/features/finance/lib/finance-timeline'
import { useFormat } from '@/hooks/use-format'
import { formatSigned } from '@/lib/format'
import { cn } from '@/lib/utils'

type ExpenseDetailData = Extract<TransactionDetail, { kind: 'expense' }>

const SOURCE_LABELS = { 'work-order': 'Created from a completed work order', manual: 'Added by hand', operating: 'Operating expense' } as const

export type ExpenseAction = 'mark-paid' | 'mark-unpaid' | 'void' | 'due-date'

export function ExpenseDetail({ detail, onAction }: { detail: ExpenseDetailData; onAction: (action: ExpenseAction) => void }) {
  const { date: formatDate, percent: formatPercent } = useFormat()
  const money = useMoney()
  const { expense, status, vendor, property, unit, workOrder, request } = detail
  const variance = costVariancePercent(expense.estimatedCents, expense.amountCents)
  const unitLabel = unit ? `${property?.type === 'commercial' ? 'Suite' : 'Unit'} ${unit.number}` : null
  const payee = vendor ? <VendorLink vendor={{ id: vendor.id, name: vendor.name, active: vendor.active }} /> : (expense.payeeName ?? '—')

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-h1 text-foreground tabular-nums">{expense.reference}</h1>
            <ExpenseStatusBadge status={status} />
            {expense.demo ? <DemoBadge /> : null}
          </div>
          <p className="text-body text-muted-foreground">
            Expense · {EXPENSE_CATEGORY_LABELS[expense.category]} · {expense.description}
          </p>
        </div>
        {status !== 'void' ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {expense.paidOn ? (
              <Button variant="outline" onClick={() => onAction('mark-unpaid')}>
                <Undo2 data-icon="inline-start" />
                Mark as unpaid
              </Button>
            ) : (
              <Button onClick={() => onAction('mark-paid')}>
                <CircleCheck data-icon="inline-start" />
                Mark as paid
              </Button>
            )}
            {expense.source === 'work-order' ? (
              <Button variant="outline" onClick={() => onAction('due-date')}>
                <CalendarClock data-icon="inline-start" />
                Change due date
              </Button>
            ) : (
              <>
                <Button variant="outline" asChild>
                  <Link to={`/finance/transactions/${expense.id}/edit`}>
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => onAction('void')}>
                  <Ban data-icon="inline-start" />
                  Void
                </Button>
              </>
            )}
          </div>
        ) : null}
      </header>

      {status === 'void' ? (
        <StatusAlert tone="info" icon={Ban} title="Voided">
          {expense.voidReason ?? 'No reason recorded.'} It no longer counts towards expenses.
        </StatusAlert>
      ) : status === 'overdue' ? (
        <StatusAlert tone="danger" icon={CircleAlert} title={`Overdue by ${daysBetween(expense.dueDate, todayIso())} days`}>
          {money(expense.amountCents)} was due on {formatDate(expense.dueDate)}.
        </StatusAlert>
      ) : null}
      {expense.source === 'work-order' && workOrder ? (
        <StatusAlert tone="info" icon={Lock} title="Amount set by the work order">
          This bill was created when {workOrder.id} was completed. Its amount and estimate come from the work order and can’t be changed in Finance.
        </StatusAlert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Bill</CardTitle>
              <CardDescription>{SOURCE_LABELS[expense.source]}</CardDescription>
            </CardHeader>
            <CardContent>
              <DetailList
                className="lg:grid-cols-3"
                items={[
                  { label: 'Amount', value: <span className={cn('tabular-nums', status === 'void' && 'text-muted-foreground line-through')}>{money(expense.amountCents)}</span> },
                  { label: 'Estimate', value: expense.estimatedCents !== undefined ? <span className="tabular-nums">{money(expense.estimatedCents)}</span> : 'No estimate' },
                  {
                    label: 'Actual vs estimate',
                    value:
                      variance === null ? (
                        'Not enough data'
                      ) : (
                        <span className={cn('tabular-nums', variance > 0 ? 'text-danger' : variance < 0 ? 'text-success' : undefined)}>
                          {formatSigned(variance, (value) => formatPercent(value))}
                        </span>
                      ),
                  },
                  { label: 'Bill date', value: formatDate(expense.billDate) },
                  { label: 'Due date', value: formatDate(expense.dueDate) },
                  { label: 'Paid on', value: expense.paidOn ? formatDate(expense.paidOn) : 'Not paid' },
                  ...(expense.paymentMethod ? [{ label: 'Payment method', value: PAYMENT_METHOD_LABELS[expense.paymentMethod] }] : []),
                  ...(expense.paymentRef ? [{ label: 'Payment reference', value: expense.paymentRef }] : []),
                  { label: 'Invoice number', value: expense.invoiceNumber ?? '—' },
                ]}
              />
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Newest first</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={toActivityItems(detail.timeline, money)} emptyDescription="Changes to this bill will appear here." />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Paid to</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                className="lg:grid-cols-1"
                items={[
                  { label: vendor ? 'Vendor' : 'Payee', value: payee },
                  {
                    label: 'Property',
                    value: property ? (
                      <Link to={`/properties/${property.id}?tab=finance`} className={cn('text-foreground', financeLinkClass)}>
                        {property.name}
                      </Link>
                    ) : (
                      'Unknown property'
                    ),
                  },
                  ...(unitLabel ? [{ label: 'Unit', value: unitLabel }] : []),
                ]}
              />
            </CardContent>
          </Card>
          {workOrder ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Work order</CardTitle>
                <CardDescription>{workOrder.id}</CardDescription>
              </CardHeader>
              <CardContent>
                <DetailList
                  className="lg:grid-cols-1"
                  items={[
                    {
                      label: 'Request',
                      value: request ? (
                        <Link to={`/maintenance/${request.id}`} className={cn('text-foreground', financeLinkClass)}>
                          {request.id} · {request.title}
                        </Link>
                      ) : (
                        workOrder.requestId
                      ),
                    },
                    { label: 'Completed', value: workOrder.completedAt ? formatDate(workOrder.completedAt.slice(0, 10)) : '—' },
                  ]}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  )
}
