import { ArrowUpRight, Info, Plus, Receipt } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'

import { EmptyState } from '@/components/shared/empty-state'
import { DataTable } from '@/components/tables/data-table'
import { createDataTableColumnHelper } from '@/components/tables/data-table-features'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CHARGE_STATUS_LABELS, INCOME_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/data/domain/finance-labels'
import { type TenantFinance, type TenantLedgerEntry, type TenantPaymentRow } from '@/data/services'
import { AgingBar } from '@/features/finance/components/aging-bar'
import { ChargeStatusBadge, DemoBadge } from '@/features/finance/components/finance-badges'
import { RecordPaymentDialog } from '@/features/finance/components/income-actions'
import { MoneyProvider } from '@/features/finance/components/money-provider'
import { useMoney } from '@/features/finance/hooks/use-money'
import { financeLinkClass } from '@/features/finance/lib/finance-styles'
import { formatDate, formatMonth, formatPercent } from '@/lib/format'
import { cn } from '@/lib/utils'

const entryColumn = createDataTableColumnHelper<TenantLedgerEntry>()
const paymentColumn = createDataTableColumnHelper<TenantPaymentRow>()

function Money({ cents, struck = false, className }: { cents: number; struck?: boolean; className?: string }) {
  const money = useMoney()
  return <span className={cn('tabular-nums', struck && 'text-muted-foreground line-through', className)}>{money(cents)}</span>
}

function RecordLink({ id, reference, demo }: { id: string; reference: string; demo?: boolean }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Link to={`/finance/transactions/${id}`} className={cn('font-medium text-foreground tabular-nums', financeLinkClass)}>
        {reference}
      </Link>
      {demo ? <DemoBadge /> : null}
    </span>
  )
}

const chargeLabel = (entry: TenantLedgerEntry) => {
  const { charge } = entry
  const category = INCOME_CATEGORY_LABELS[charge.category]
  return charge.period ? `${category}, ${formatMonth(charge.period, 'long')}` : category
}

function ChargeDescription({ entry, showUnit }: { entry: TenantLedgerEntry; showUnit: boolean }) {
  const { charge } = entry
  return (
    <span className="flex min-w-0 flex-col">
      <span className="text-foreground">{chargeLabel(entry)}</span>
      {charge.description && charge.category !== 'rent' && charge.description.toLowerCase() !== INCOME_CATEGORY_LABELS[charge.category].toLowerCase() ? (
        <span className="text-caption text-muted-foreground">{charge.description}</span>
      ) : null}
      {showUnit ? <span className="text-caption text-muted-foreground">{`${entry.propertyName}, ${entry.unitLabel}`}</span> : null}
      {charge.voidedAt ? <span className="text-caption text-muted-foreground">Voided: {charge.voidReason}</span> : null}
    </span>
  )
}

function ChargeStatus({ entry }: { entry: TenantLedgerEntry }) {
  const { state } = entry
  return (
    <span className="flex flex-col items-start gap-1">
      <ChargeStatusBadge status={state.status} />
      {state.daysOverdue > 0 ? <span className="text-caption text-danger">Overdue by {state.daysOverdue} {state.daysOverdue === 1 ? 'day' : 'days'}</span> : null}
      {state.paidLate ? <span className="text-caption text-muted-foreground">Paid late</span> : null}
    </span>
  )
}

function PaymentStatus({ row }: { row: TenantPaymentRow }) {
  return row.payment.voidedAt ? (
    <span className="flex flex-col items-start gap-0.5">
      <Badge variant="neutral">Voided</Badge>
      {row.payment.voidReason ? <span className="text-caption text-muted-foreground">{row.payment.voidReason}</span> : null}
    </span>
  ) : (
    <Badge variant="success">Received</Badge>
  )
}

interface TenantPaymentsTabProps {
  finance: TenantFinance
  tenantId: string
  /** Reloads the page data after a successful save. */
  onSaved: () => void
}

/** The tenant's charges and payments from the stored Finance ledger. */
export function TenantPaymentsTab(props: TenantPaymentsTabProps) {
  return (
    <MoneyProvider settings={props.finance.settings}>
      <PaymentsContent {...props} />
    </MoneyProvider>
  )
}

function PaymentsContent({ finance, tenantId, onSaved }: TenantPaymentsTabProps) {
  const money = useMoney()
  const [paying, setPaying] = useState<TenantLedgerEntry | null>(null)
  const multipleUnits = new Set(finance.entries.map((entry) => entry.charge.unitId)).size > 1
  const financeHref = `/finance/transactions?party=${encodeURIComponent(`tenant:${tenantId}`)}&range=all`

  const chargeColumns = useMemo(
    () =>
      entryColumn.columns([
        entryColumn.accessor((row) => row.charge.reference, {
          id: 'reference',
          header: 'Reference',
          sortFn: 'text',
          cell: (info) => <RecordLink id={info.row.original.charge.id} reference={info.getValue()} demo={info.row.original.charge.demo} />,
        }),
        entryColumn.accessor((row) => chargeLabel(row), {
          id: 'charge',
          header: 'Charge',
          sortFn: 'text',
          cell: (info) => <ChargeDescription entry={info.row.original} showUnit={multipleUnits} />,
        }),
        entryColumn.accessor((row) => row.charge.dueDate, {
          id: 'dueDate',
          header: 'Due',
          sortFn: 'text',
          cell: (info) => <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>,
        }),
        entryColumn.accessor((row) => row.charge.amountCents, {
          id: 'amount',
          header: 'Amount',
          meta: { align: 'end' },
          cell: (info) => <Money cents={info.getValue()} struck={Boolean(info.row.original.charge.voidedAt)} />,
        }),
        entryColumn.accessor((row) => row.state.paidCents, {
          id: 'paid',
          header: 'Paid',
          meta: { align: 'end' },
          cell: (info) => <Money cents={info.getValue()} />,
        }),
        entryColumn.accessor((row) => row.state.balanceCents, {
          id: 'balance',
          header: 'Balance',
          meta: { align: 'end' },
          cell: (info) => <Money cents={info.getValue()} className={info.getValue() > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'} />,
        }),
        entryColumn.accessor((row) => CHARGE_STATUS_LABELS[row.state.status], {
          id: 'status',
          header: 'Status',
          sortFn: 'text',
          cell: (info) => <ChargeStatus entry={info.row.original} />,
        }),
        entryColumn.display({
          id: 'actions',
          header: () => <span className="sr-only">Actions</span>,
          cell: (info) =>
            info.row.original.state.balanceCents > 0 ? (
              <Button size="xs" variant="outline" onClick={() => setPaying(info.row.original)} aria-label={`Record payment for ${info.row.original.charge.reference}`}>
                Record payment
              </Button>
            ) : null,
        }),
      ]),
    [multipleUnits],
  )

  const paymentColumns = useMemo(
    () =>
      paymentColumn.columns([
        paymentColumn.accessor((row) => row.payment.receivedOn, {
          id: 'receivedOn',
          header: 'Received',
          sortFn: 'text',
          cell: (info) => <span className="whitespace-nowrap">{formatDate(info.getValue())}</span>,
        }),
        paymentColumn.accessor((row) => row.payment.reference, {
          id: 'reference',
          header: 'Payment',
          sortFn: 'text',
          cell: (info) => (
            <span className="flex flex-wrap items-center gap-1.5 tabular-nums">
              {info.getValue()}
              {info.row.original.payment.demo ? <DemoBadge /> : null}
            </span>
          ),
        }),
        paymentColumn.accessor((row) => row.charge.reference, {
          id: 'charge',
          header: 'For',
          sortFn: 'text',
          cell: (info) => <RecordLink id={info.row.original.charge.id} reference={info.getValue()} />,
        }),
        paymentColumn.accessor((row) => PAYMENT_METHOD_LABELS[row.payment.method], {
          id: 'method',
          header: 'Method',
          sortFn: 'text',
          cell: (info) => (
            <span>
              {info.getValue()}
              {info.row.original.payment.externalRef ? <span className="block text-caption text-muted-foreground">{info.row.original.payment.externalRef}</span> : null}
            </span>
          ),
        }),
        paymentColumn.accessor((row) => row.payment.amountCents, {
          id: 'amount',
          header: 'Amount',
          meta: { align: 'end' },
          cell: (info) => <Money cents={info.getValue()} struck={Boolean(info.row.original.payment.voidedAt)} />,
        }),
        paymentColumn.accessor((row) => (row.payment.voidedAt ? 'Voided' : 'Received'), {
          id: 'status',
          header: 'Status',
          sortFn: 'text',
          cell: (info) => <PaymentStatus row={info.row.original} />,
        }),
      ]),
    [],
  )

  const figures = [
    { label: 'Balance due', value: money(finance.balanceCents), note: finance.overdueCents > 0 ? `${money(finance.overdueCents)} overdue` : 'Nothing overdue', danger: finance.overdueCents > 0 },
    { label: 'Received, last 12 months', value: money(finance.receivedLast12Cents), note: `${finance.receivedLast12Count} ${finance.receivedLast12Count === 1 ? 'payment' : 'payments'}` },
    { label: 'Rent paid on time', value: finance.onTimeRate === null ? '—' : formatPercent(finance.onTimeRate, 0), note: 'Of fully paid rent charges' },
    {
      label: 'Next charge',
      value: finance.next ? money(finance.next.amountCents) : '—',
      note: finance.next ? `Due ${formatDate(finance.next.dueDate)}${finance.next.projected ? ' (scheduled)' : ''}` : 'No upcoming charges',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <Card className="min-w-0 pb-4">
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>Charges and payments from the Finance ledger. Amounts in {finance.settings.currency}.</CardDescription>
          <CardAction className="flex flex-wrap items-center justify-end gap-2">
            {finance.hasDemo ? <Badge variant="info">Local demo records</Badge> : null}
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 px-0">
          <div className="mx-5 flex flex-wrap gap-2">
            {finance.leaseId ? (
              <Button asChild size="sm">
                <Link to={`/finance/income/new?leaseId=${encodeURIComponent(finance.leaseId)}`}>
                  <Plus data-icon="inline-start" />
                  Add income
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="outline">
              <Link to={financeHref}>
                View in Finance
                <ArrowUpRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
          <p className="mx-5 flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 px-3 py-2.5 text-caption text-foreground dark:bg-info/15">
            <Info className="mt-px size-4 shrink-0 text-info" aria-hidden="true" />
            <span>
              Records are kept in this browser. Propwise records payments; it doesn’t process them.
              {finance.startsBeforeWindow ? ` Finance records start in ${formatMonth(finance.startPeriod, 'long')}; earlier months aren’t stored.` : ''}
            </span>
          </p>
          {finance.entries.length === 0 ? (
            <EmptyState
              size="sm"
              icon={Receipt}
              title="No charges yet"
              description={
                finance.next
                  ? `The first charge, ${money(finance.next.amountCents)} rent, is due ${formatDate(finance.next.dueDate)}. Rent is billed from the lease automatically once a month starts.`
                  : 'Rent is billed from the lease automatically once a month starts.'
              }
            />
          ) : (
            <>
              <dl className="mx-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
                {figures.map((item) => (
                  <div key={item.label} className="rounded-lg border border-border p-4">
                    <dt className="text-caption text-muted-foreground">{item.label}</dt>
                    <dd className={cn('mt-1 text-h3 tabular-nums', item.danger ? 'text-danger' : 'text-foreground')}>{item.value}</dd>
                    <dd className="text-caption text-muted-foreground">{item.note}</dd>
                  </div>
                ))}
              </dl>
              {finance.balanceCents > 0 ? (
                <div className="mx-5">
                  <AgingBar aging={finance.aging} label="Balance by age" />
                </div>
              ) : null}
              <DataTable
                caption="Charges billed to this tenant, newest first. Column headers are sortable."
                data={finance.entries}
                columns={chargeColumns}
                initialSorting={[{ id: 'dueDate', desc: true }]}
                pageSize={12}
                getRowId={(row) => row.charge.id}
                itemLabel="charges"
                minWidth="56rem"
                renderMobileRow={(entry) => (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <RecordLink id={entry.charge.id} reference={entry.charge.reference} demo={entry.charge.demo} />
                        <ChargeDescription entry={entry} showUnit={multipleUnits} />
                        <p className="text-caption text-muted-foreground">Due {formatDate(entry.charge.dueDate)}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Money cents={entry.charge.amountCents} struck={Boolean(entry.charge.voidedAt)} className="text-body font-semibold text-foreground" />
                        {entry.state.balanceCents > 0 && entry.state.paidCents > 0 ? <span className="text-caption text-muted-foreground">{money(entry.state.balanceCents)} left</span> : null}
                        <ChargeStatus entry={entry} />
                      </div>
                    </div>
                    {entry.state.balanceCents > 0 ? (
                      <Button size="sm" variant="outline" className="self-start" onClick={() => setPaying(entry)} aria-label={`Record payment for ${entry.charge.reference}`}>
                        Record payment
                      </Button>
                    ) : null}
                  </div>
                )}
                emptyState={<EmptyState size="sm" icon={Receipt} title="No charges" description="Nothing to show." />}
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0 pb-4">
        <CardHeader>
          <CardTitle>Payments received</CardTitle>
          <CardDescription>Every payment, including voided ones with their reason.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {finance.payments.length === 0 ? (
            <EmptyState size="sm" icon={Receipt} title="No payments yet" description="Payments recorded in Finance appear here." />
          ) : (
            <DataTable
              caption="Payments received from this tenant, newest first. Column headers are sortable."
              data={finance.payments}
              columns={paymentColumns}
              initialSorting={[{ id: 'receivedOn', desc: true }]}
              pageSize={12}
              getRowId={(row) => row.payment.id}
              itemLabel="payments"
              minWidth="48rem"
              renderMobileRow={(row) => (
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-body font-medium text-foreground tabular-nums">{row.payment.reference}</p>
                    <p className="text-caption text-muted-foreground">
                      {formatDate(row.payment.receivedOn)} · {PAYMENT_METHOD_LABELS[row.payment.method]} · for <RecordLink id={row.charge.id} reference={row.charge.reference} />
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Money cents={row.payment.amountCents} struck={Boolean(row.payment.voidedAt)} className="text-body font-semibold text-foreground" />
                    <PaymentStatus row={row} />
                  </div>
                </div>
              )}
              emptyState={<EmptyState size="sm" icon={Receipt} title="No payments yet" description="Payments recorded in Finance appear here." />}
            />
          )}
        </CardContent>
      </Card>

      {paying ? (
        <RecordPaymentDialog
          detail={paying}
          onClose={() => setPaying(null)}
          onDone={(message) => {
            // Only reached after the save resolved.
            setPaying(null)
            toast.success(message)
            onSaved()
          }}
        />
      ) : null}
    </div>
  )
}
