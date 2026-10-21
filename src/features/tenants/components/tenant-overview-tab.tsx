import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { ActivityTimeline, type ActivityItem } from '@/components/shared/activity-timeline'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { type TenantDetail } from '@/data/services'
import { DetailList } from '@/features/tenants/components/detail-list'
import { LeaseAlert } from '@/features/tenants/components/lease-alert'
import { LeaseStatusBadge } from '@/features/tenants/components/tenant-badges'
import { formatCurrency, formatDate } from '@/lib/format'
import { type LeaseDisplayStatus } from '@/types'

interface TenantOverviewTabProps {
  detail: TenantDetail
  leaseStatus: LeaseDisplayStatus | null
  timeline: ActivityItem[]
  onShowLease: () => void
  onShowActivity: () => void
}

export function TenantOverviewTab({ detail, leaseStatus, timeline, onShowLease, onShowActivity }: TenantOverviewTabProps) {
  const { tenant, lease, property } = detail
  const leaseRecord = detail.leases.find((entry) => entry.id === lease?.id)
  const current = lease?.status === 'active' || lease?.status === 'pending'
  const address = tenant.mailingAddress

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>{current ? 'Current lease' : 'Most recent lease'}</CardTitle>
            <CardDescription>
              {leaseRecord ? `${leaseRecord.propertyName} · ${leaseRecord.unitLabel}` : 'No lease on record'}
            </CardDescription>
            {leaseStatus ? (
              <CardAction>
                <LeaseStatusBadge status={leaseStatus} />
              </CardAction>
            ) : null}
          </CardHeader>
          {lease && leaseRecord ? (
            <CardContent className="flex flex-col gap-5">
              {leaseStatus ? <LeaseAlert lease={lease} status={leaseStatus} /> : null}
              <DetailList
                className="lg:grid-cols-3"
                items={[
                  {
                    label: 'Property',
                    value: property ? (
                      <Link to={`/properties/${property.id}?tab=units`} className="rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50">
                        {property.name}
                      </Link>
                    ) : (
                      leaseRecord.propertyName
                    ),
                  },
                  { label: 'Unit', value: leaseRecord.unitLabel },
                  { label: 'Term', value: `${formatDate(lease.startDate)} – ${formatDate(lease.endDate)}` },
                  { label: 'Monthly rent', value: <span className="font-medium tabular-nums">{formatCurrency(lease.monthlyRent)}</span> },
                  { label: 'Security deposit', value: <span className="tabular-nums">{formatCurrency(lease.securityDeposit)}</span> },
                  { label: 'Rent due', value: `Day ${lease.paymentDueDay} of each month` },
                ]}
              />
              <div>
                <Button variant="outline" size="sm" onClick={onShowLease}>
                  Manage lease
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={onShowActivity}>
                View all
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ActivityTimeline items={timeline.slice(0, 4)} emptyDescription="Lease and profile changes will appear here." />
          </CardContent>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              className="sm:grid-cols-1"
              items={[
                { label: 'Email', value: <a href={`mailto:${tenant.email}`} className="break-all text-primary underline-offset-4 hover:underline">{tenant.email}</a> },
                { label: 'Phone', value: tenant.phone },
                {
                  label: 'Mailing address',
                  value: (
                    <>
                      {address.street}
                      <br />
                      {address.city}, {address.state} {address.postalCode}
                    </>
                  ),
                },
              ]}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Emergency contact</CardTitle>
          </CardHeader>
          <CardContent>
            {tenant.emergencyContact ? (
              <DetailList
                className="sm:grid-cols-1"
                items={[
                  { label: 'Name', value: `${tenant.emergencyContact.name} (${tenant.emergencyContact.relationship})` },
                  { label: 'Phone', value: tenant.emergencyContact.phone },
                ]}
              />
            ) : (
              <p className="text-body text-muted-foreground">
                None added.{' '}
                <Link to={`/tenants/${tenant.id}/edit`} className="text-primary underline-offset-4 hover:underline">
                  Add one
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        {tenant.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-body whitespace-pre-line text-foreground">{tenant.notes}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}
