import { ArrowDownLeft, ArrowUpRight, FlaskConical } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CHARGE_STATUS_LABELS, EXPENSE_STATUS_LABELS } from '@/data/domain/finance-labels'
import { type ChargeStatus, type ExpenseStatus } from '@/data/domain/finance-rules'
import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'neutral'

const CHARGE_VARIANTS: Record<ChargeStatus, Variant> = {
  pending: 'info',
  'partially-paid': 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'neutral',
}

const EXPENSE_VARIANTS: Record<ExpenseStatus, Variant> = {
  pending: 'warning',
  overdue: 'danger',
  paid: 'success',
  void: 'neutral',
}

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  return <Badge variant={CHARGE_VARIANTS[status]}>{CHARGE_STATUS_LABELS[status]}</Badge>
}

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return <Badge variant={EXPENSE_VARIANTS[status]}>{EXPENSE_STATUS_LABELS[status]}</Badge>
}

/** Projected rent that isn't a record yet. */
export function ScheduledBadge() {
  return <Badge variant="neutral">Scheduled</Badge>
}

/** Marks fictional records created by the sample data or the upgrade. */
export function DemoBadge({ className }: { className?: string }) {
  return (
    <Badge variant="outline" className={cn('text-muted-foreground', className)} title="Fictional sample record, stored only in this browser">
      <FlaskConical data-icon="inline-start" aria-hidden="true" />
      Demo
    </Badge>
  )
}

/** Income (money in) or expense (money out), shown by icon and word. */
export function KindLabel({ kind }: { kind: 'income' | 'expense' }) {
  const Icon = kind === 'income' ? ArrowDownLeft : ArrowUpRight
  return (
    <span className={cn('inline-flex items-center gap-1 text-caption font-medium', kind === 'income' ? 'text-success' : 'text-foreground')}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {kind === 'income' ? 'Income' : 'Expense'}
    </span>
  )
}
