import { Ban, Banknote, CircleAlert, Clock, HandCoins, Pencil, Scale, TimerReset } from 'lucide-react'
import { Link } from 'react-router'

import { ActivityTimeline } from '@/components/shared/activity-timeline'
import { DetailList } from '@/components/shared/detail-list'
import { EmptyState } from '@/components/shared/empty-state'
import { StatusAlert } from '@/components/shared/status-alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { INCOME_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { describeLateFeeRule } from '@/data/domain/finance-rules'
import { type TransactionDetail } from '@/data/services'
import { type Payment } from '@/types'
import { ChargeStatusBadge, DemoBadge } from '@/features/finance/components/finance-badges'
import { useMoney } from '@/features/finance/hooks/use-money'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { toActivityItems } from '@/features/finance/lib/finance-timeline'
import { formatDate, formatMonth } from '@/lib/format'
import { cn } from '@/lib/utils'

type IncomeDetailData = Extract<TransactionDetail, { kind: 'income' }>

const SOURCE_LABELS = { lease: 'Posted from the lease', recurring: 'Posted from a recurring schedule', manual: 'Added by hand', 'late-fee': 'Late fee' } as const

export type IncomeAction = 'pay' | 'adjust' | 'void' | 'late-fee' | 'end-recurring'

interface IncomeDetailProps {
  detail: IncomeDetailData
  onAction: (action: IncomeAction) => void
  onVoidPayment: (payment: Payment) => void
}

export function IncomeDetail({ detail, onAction, onVoidPayment }: IncomeDetailProps) {
  const money = useMoney()
  const { charge, state, payments, lease, tenant, property, unit } = detail
  const unitLabel = unit ? `${property?.type === 'commercial' ? 'Suite' : 'Unit'} ${unit.number}` : null
  const title = `${INCOME_CATEGORY_LABELS[charge.category]}${charge.period ? ` · ${formatMonth(charge.period, 'long')}` : ''}`
  const open = state.status !== 'void'

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-h1 text-foreground tabular-nums">{charge.reference}</h1>
          <ChargeStatusBadge status={state.status} />
          {charge.demo ? <DemoBadge /> : null}
        </div>
        <p className="text-body text-muted-foreground">
          Income · {title}
          {tenant ? (
            <>
              {' · '}
              <Link to={`/tenants/${tenant.id}?tab=payments`} className={cn('text-foreground', financeLinkClass)}>
                {tenant.name}
              </Link>
            </>
          ) : charge.payerName ? ` · ${charge.payerName}` : null}
        </p>
        </div>
        {open ? (
          <div className="flex shrink-0 flex-wrap gap-2">
            {state.balanceCents > 0 ? (
              <Button onClick={() => onAction('pay')}>
                <HandCoins data-icon="inline-start" />
                Record payment
              </Button>
            ) : null}
            {detail.lateFeeAllowed.allowed ? (
              <Button variant="outline" onClick={() => onAction('late-fee')}>
                <TimerReset data-icon="inline-start" />
                Add late fee
              </Button>
            ) : null}
            {charge.source === 'manual' ? (
              <Button variant="outline" asChild>
                <Link to={`/finance/transactions/${charge.id}/edit`}>
                  <Pencil data-icon="inline-start" />
                  Edit
                </Link>
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">More actions</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onSelect={() => onAction('adjust')}>
                  <Scale aria-hidden="true" />
                  Adjust amount
                </DropdownMenuItem>
                {detail.recurring && detail.recurring.endPeriod === undefined ? (
                  <DropdownMenuItem onSelect={() => onAction('end-recurring')}>End recurring charge</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => onAction('void')}>
                  <Ban aria-hidden="true" />
                  Void charge
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </header>

      <IncomeAlert detail={detail} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-2">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Amount</CardTitle>
              <CardDescription>{SOURCE_LABELS[charge.source]}</CardDescription>
            </CardHeader>
            <CardContent>
              <DetailList
                className="lg:grid-cols-3"
                items={[
                  { label: 'Amount', value: <span className={cn('tabular-nums', state.status === 'void' && 'text-muted-foreground line-through')}>{money(charge.amountCents)}</span> },
                  { label: 'Paid', value: <span className="tabular-nums">{money(state.paidCents)}</span> },
                  { label: 'Balance', value: <span className={cn('font-medium tabular-nums', state.balanceCents > 0 && state.daysOverdue > 0 && 'text-danger')}>{money(state.balanceCents)}</span> },
                  { label: 'Due date', value: formatDate(charge.dueDate) },
                  { label: 'Issued', value: formatDate(charge.issuedOn) },
                  { label: 'Billing month', value: charge.period ? formatMonth(charge.period, 'long') : '—' },
                  ...(charge.adjusted ? [{ label: 'Adjusted', value: 'Amount changed by hand' }] : []),
                  ...(charge.description && charge.description !== INCOME_CATEGORY_LABELS[charge.category] ? [{ label: 'Description', value: charge.description }] : []),
                ]}
              />
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Payments</CardTitle>
              <CardDescription>
                {payments.length === 0 ? 'Nothing received yet' : `${payments.length} ${payments.length === 1 ? 'payment' : 'payments'} recorded`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={Banknote}
                  title="No payments recorded"
                  description={open ? 'Use Record payment when money arrives.' : undefined}
                  actions={
                    open && state.balanceCents > 0 ? (
                      <Button size="sm" variant="outline" onClick={() => onAction('pay')}>
                        Record payment
                      </Button>
                    ) : null
                  }
                />
              ) : (
                <div className="-mx-5 overflow-x-auto">
                  <Table className="min-w-[36rem]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="pl-5">Received</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="pr-5">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell className="pl-5 whitespace-nowrap">{formatDate(payment.receivedOn)}</TableCell>
                          <TableCell className="tabular-nums">
                            <span className="flex flex-wrap items-center gap-1.5">
                              {payment.reference}
                              {payment.demo ? <DemoBadge /> : null}
                            </span>
                          </TableCell>
                          <TableCell>
                            {PAYMENT_METHOD_LABELS[payment.method]}
                            {payment.externalRef ? <span className="block text-caption text-muted-foreground">{payment.externalRef}</span> : null}
                          </TableCell>
                          <TableCell className={cn('text-right tabular-nums', payment.voidedAt && 'text-muted-foreground line-through')}>{money(payment.amountCents)}</TableCell>
                          <TableCell className="pr-5">
                            {payment.voidedAt ? (
                              <span className="flex flex-col gap-0.5">
                                <Badge variant="neutral">Voided</Badge>
                                {payment.voidReason ? <span className="text-caption text-muted-foreground">{payment.voidReason}</span> : null}
                              </span>
                            ) : (
                              <span className="flex flex-wrap items-center gap-2">
                                <Badge variant="success">Received</Badge>
                                {open ? (
                                  <Button size="xs" variant="ghost" onClick={() => onVoidPayment(payment)} aria-label={`Void payment ${payment.reference}`}>
                                    Void
                                  </Button>
                                ) : null}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Newest first. Automatic changes always say why.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={toActivityItems(detail.timeline, money)} emptyDescription="Changes to this record will appear here." />
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Billed to</CardTitle>
            </CardHeader>
            <CardContent>
              <DetailList
                className="lg:grid-cols-1"
                items={[
                  {
                    label: tenant ? 'Tenant' : 'Payer',
                    value: tenant ? (
                      <Link to={`/tenants/${tenant.id}?tab=payments`} className={cn('text-foreground', financeLinkClass)}>
                        {tenant.name}
                      </Link>
                    ) : (
                      (charge.payerName ?? '—')
                    ),
                  },
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
                  ...(lease ? [{ label: 'Lease', value: `${formatDate(lease.startDate)} – ${formatDate(lease.endedAt ?? lease.endDate)}` }] : []),
                  ...(detail.recurring ? [{ label: 'Recurring schedule', value: `${detail.recurring.description} · ${money(detail.recurring.amountCents)} a month` }] : []),
                  ...(detail.parent
                    ? [
                        {
                          label: 'Late fee for',
                          value: (
                            <Link to={`/finance/transactions/${detail.parent.id}`} className={cn('text-foreground', financeLinkClass)}>
                              {detail.parent.reference}
                            </Link>
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </CardContent>
          </Card>
          {charge.category === 'rent' ? <LateFeeCard detail={detail} onAdd={() => onAction('late-fee')} /> : null}
        </div>
      </div>
    </div>
  )
}

function IncomeAlert({ detail }: { detail: IncomeDetailData }) {
  const money = useMoney()
  const { charge, state } = detail
  if (state.status === 'void') {
    return (
      <StatusAlert tone="info" icon={Ban} title={charge.voidedBy === 'system' ? 'Voided automatically' : 'Voided'}>
        {charge.voidReason ?? 'No reason recorded.'} It no longer counts towards the balance.
      </StatusAlert>
    )
  }
  if (state.daysOverdue > 0) {
    return (
      <StatusAlert tone="danger" icon={CircleAlert} title={`Overdue by ${state.daysOverdue} ${state.daysOverdue === 1 ? 'day' : 'days'}`}>
        {money(state.balanceCents)} {state.status === 'partially-paid' ? `is still open after ${money(state.paidCents)} was paid.` : 'is still open.'}
      </StatusAlert>
    )
  }
  if (state.status === 'partially-paid') {
    return (
      <StatusAlert tone="warning" icon={Clock} title="Partially paid">
        {money(state.balanceCents)} is due by {formatDate(charge.dueDate)}.
      </StatusAlert>
    )
  }
  if (state.status === 'paid' && state.paidLate) {
    return (
      <StatusAlert tone="info" icon={Clock} title="Paid late">
        The last payment arrived after the grace period.
      </StatusAlert>
    )
  }
  return null
}

function LateFeeCard({ detail, onAdd }: { detail: IncomeDetailData; onAdd: () => void }) {
  const money = useMoney()
  const { lateFee, lateFeeAllowed, settings, property } = detail
  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Late fee</CardTitle>
        <CardDescription>{property?.type === 'commercial' ? 'Commercial rule' : 'Residential rule'}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {lateFee ? (
          <p className="flex items-center gap-2 text-body text-foreground">
            <TimerReset className="size-4 shrink-0 text-warning" aria-hidden="true" />
            <span>
              <Link to={`/finance/transactions/${lateFee.id}`} className={cn('font-medium text-foreground', financeLinkClass)}>
                {lateFee.reference}
              </Link>{' '}
              · {lateFee.voidedAt ? `${money(lateFee.amountCents)} was added and later voided${lateFee.voidReason ? ` (${lateFee.voidReason})` : ''}. Only one late fee per charge is allowed, so another can’t be added.` : `${money(lateFee.amountCents)} was added.`}
            </span>
          </p>
        ) : lateFeeAllowed.allowed ? (
          <div className="flex flex-col items-start gap-2">
            <p className="text-body text-foreground">
              A late fee of <span className="font-medium tabular-nums">{money(lateFeeAllowed.suggestedCents)}</span> can be added.
            </p>
            <Button size="sm" variant="outline" onClick={onAdd}>
              Add late fee
            </Button>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">
            {lateFeeAllowed.reason}
            {lateFeeAllowed.reason?.startsWith('The grace period') ? ` Available from ${formatDate(lateFeeAllowed.availableFrom)}.` : ''}
          </p>
        )}
        <p className="text-caption text-muted-foreground">{describeLateFeeRule(settings, (cents) => money(cents))}</p>
      </CardContent>
    </Card>
  )
}
