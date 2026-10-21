import { Mail, Pencil, Phone } from 'lucide-react'
import { Link } from 'react-router'

import { BackLink } from '@/components/shared/back-link'
import { Button } from '@/components/ui/button'
import { TenantAvatar } from '@/features/tenants/components/tenant-avatar'
import { LeaseStatusBadge, TenantStatusBadge } from '@/features/tenants/components/tenant-badges'
import { TENANT_KIND_LABELS } from '@/features/tenants/lib/tenant-meta'
import { type LeaseDisplayStatus, type Tenant, type TenantStatus } from '@/types'

interface TenantDetailHeaderProps {
  tenant: Tenant
  status: TenantStatus
  leaseStatus: LeaseDisplayStatus | null
}

export function TenantDetailHeader({ tenant, status, leaseStatus }: TenantDetailHeaderProps) {
  return (
    <div className="flex flex-col gap-3">
      <BackLink to="/tenants" label="Tenants" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <TenantAvatar name={tenant.name} kind={tenant.kind} className="size-14 text-h3" />
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-h1 text-foreground">{tenant.name}</h1>
              <TenantStatusBadge status={status} />
              {leaseStatus && leaseStatus !== 'active' ? <LeaseStatusBadge status={leaseStatus} /> : null}
            </div>
            <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
              <span>{TENANT_KIND_LABELS[tenant.kind]}</span>
              <a href={`mailto:${tenant.email}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                <Mail className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{tenant.email}</span>
              </a>
              <a href={`tel:${tenant.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                <Phone className="size-4 shrink-0" aria-hidden="true" />
                {tenant.phone}
              </a>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to={`/tenants/${tenant.id}/edit`}>
              <Pencil data-icon="inline-start" />
              Edit tenant
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
