import { Badge } from '@/components/ui/badge'
import { type RequestTiming } from '@/data/domain/maintenance-rules'
import {
  CATEGORY_ICONS,
  CATEGORY_LABELS,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_TONES,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_TONES,
} from '@/features/maintenance/lib/request-meta'
import { cn } from '@/lib/utils'
import { type RequestCategory, type RequestStatus, type WorkOrderStatus } from '@/types'

/**
 * Dark mode: the "Open" (brand) tint is lighter than the shared brand badge so its text meets WCAG AA (4.5:1) on cards.
 * Scoped to Maintenance: the Dashboard's own "Open" label is unchanged (it must stay pixel-identical).
 */
const STATUS_CLASS: Partial<Record<RequestStatus, string>> = { open: 'dark:bg-primary/8' }

export function RequestStatusBadge({ status }: { status: RequestStatus }) {
  return (
    <Badge variant={REQUEST_STATUS_TONES[status]} className={STATUS_CLASS[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {REQUEST_STATUS_LABELS[status]}
    </Badge>
  )
}

export function WorkOrderStatusBadge({ status }: { status: WorkOrderStatus }) {
  return <Badge variant={WORK_ORDER_STATUS_TONES[status]}>{WORK_ORDER_STATUS_LABELS[status]}</Badge>
}

export function InactiveVendorBadge() {
  return <Badge variant="neutral">Inactive</Badge>
}

export function CategoryLabel({ category, className }: { category: RequestCategory; className?: string }) {
  const Icon = CATEGORY_ICONS[category]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-muted-foreground', className)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true" />
      {CATEGORY_LABELS[category]}
    </span>
  )
}

/** Due line under a status: red when overdue, amber when due soon. Text carries the meaning, not only colour. */
export function TimingText({ timing, text, className }: { timing: RequestTiming; text: string; className?: string }) {
  if (!text) return null
  return (
    <span
      className={cn(
        'text-caption',
        timing === 'overdue' ? 'font-medium text-danger' : timing === 'due-soon' ? 'font-medium text-warning' : 'text-muted-foreground',
        className,
      )}
    >
      {text}
    </span>
  )
}
