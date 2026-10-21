import { Badge } from '@/components/ui/badge'
import { type PaymentStatus } from '@/types'

const STATUS: Record<PaymentStatus, { label: string; variant: 'success' | 'danger' | 'info' | 'neutral' }> = {
  paid: { label: 'Paid', variant: 'success' },
  overdue: { label: 'Overdue', variant: 'danger' },
  scheduled: { label: 'Autopay', variant: 'info' },
  pending: { label: 'Pending', variant: 'neutral' },
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const { label, variant } = STATUS[status]
  return <Badge variant={variant}>{label}</Badge>
}
