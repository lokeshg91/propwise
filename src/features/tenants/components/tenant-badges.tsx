import { Badge } from '@/components/ui/badge'
import {
  LEASE_STATUS_LABELS,
  LEASE_STATUS_TONES,
  RENT_CHARGE_LABELS,
  RENT_CHARGE_TONES,
  TENANT_STATUS_LABELS,
  TENANT_STATUS_TONES,
} from '@/features/tenants/lib/tenant-meta'
import { type LeaseDisplayStatus, type RentCharge, type TenantStatus } from '@/types'

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

export function RentChargeBadge({ status }: { status: RentCharge['status'] }) {
  return <Badge variant={RENT_CHARGE_TONES[status]}>{RENT_CHARGE_LABELS[status]}</Badge>
}
