import { Badge } from '@/components/ui/badge'
import {
  LEASE_STATUS_LABELS,
  LEASE_STATUS_TONES,
  TENANT_STATUS_LABELS,
  TENANT_STATUS_TONES,
} from '@/features/tenants/lib/tenant-meta'
import { type LeaseDisplayStatus, type TenantStatus } from '@/types'

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <Badge variant={TENANT_STATUS_TONES[status]}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {TENANT_STATUS_LABELS[status]}
    </Badge>
  )
}

export function LeaseStatusBadge({ status }: { status: LeaseDisplayStatus }) {
  return <Badge variant={LEASE_STATUS_TONES[status]}>{LEASE_STATUS_LABELS[status]}</Badge>
}
