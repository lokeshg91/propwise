import { CalendarX, KeyRound, LogOut, Pencil, Plus } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getLeaseDisplayStatus } from '@/data/domain/lease-rules'
import { type TenantDetail } from '@/data/services'
import { DetailList } from '@/components/shared/detail-list'
import { LeaseAlert } from '@/features/tenants/components/lease-alert'
import { type LeaseAction } from '@/features/tenants/components/lease-action-dialogs'
import { LeaseStatusBadge } from '@/features/tenants/components/tenant-badges'
import { LEASE_END_REASON_LABELS } from '@/features/tenants/lib/tenant-meta'
import { formatCurrency, formatDate } from '@/lib/format'
import { type LeaseDisplayStatus } from '@/types'

interface TenantLeaseTabProps {
  detail: TenantDetail
  leaseStatus: LeaseDisplayStatus | null
  onAction: (action: LeaseAction) => void
}

export function TenantLeaseTab({ detail, leaseStatus, onAction }: TenantLeaseTabProps) {
  const { tenant, lease } = detail
  const current = lease && (lease.status === 'active' || lease.status === 'pending') ? lease : null
  const record = detail.leases.find((entry) => entry.id === current?.id)
  const canActivate = leaseStatus === 'move-in-due'

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Current lease</CardTitle>
          <CardDescription>
            {record ? `${record.propertyName} · ${record.unitLabel}` : `${tenant.name} has no active or pending lease.`}
          </CardDescription>
          {leaseStatus && current ? (
            <CardAction>
              <LeaseStatusBadge status={leaseStatus} />
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {current && record && leaseStatus ? (
            <>
              <LeaseAlert lease={current} status={leaseStatus} />
              <DetailList
                className="lg:grid-cols-4"
                items={[
                  { label: 'Start', value: formatDate(current.startDate) },
                  { label: 'End', value: formatDate(current.endDate) },
                  { label: 'Monthly rent', value: <span className="font-medium tabular-nums">{formatCurrency(current.monthlyRent)}</span> },
                  { label: 'Security deposit', value: <span className="tabular-nums">{formatCurrency(current.securityDeposit)}</span> },
                ]}
              />
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/tenants/${tenant.id}/edit`}>
                    <Pencil data-icon="inline-start" />
                    {current.status === 'active' ? 'Edit terms or renew' : 'Edit lease'}
                  </Link>
                </Button>
                {current.status === 'active' ? (
                  <Button variant="destructive" size="sm" onClick={() => onAction('end')}>
                    <LogOut data-icon="inline-start" />
                    End lease
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      onClick={() => onAction('activate')}
                      disabled={!canActivate}
                      title={canActivate ? undefined : `Available from ${formatDate(current.startDate)}`}
                    >
                      <KeyRound data-icon="inline-start" />
                      Mark as moved in
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => onAction('cancel')}>
                      <CalendarX data-icon="inline-start" />
                      Cancel lease
                    </Button>
                  </>
                )}
              </div>
              {current.status === 'pending' && !canActivate ? (
                <p className="-mt-2 text-caption text-muted-foreground">Move-in can be recorded from {formatDate(current.startDate)}.</p>
              ) : null}
            </>
          ) : (
            <div>
              <Button size="sm" asChild>
                <Link to={`/tenants/${tenant.id}/edit`}>
                  <Plus data-icon="inline-start" />
                  Start a new lease
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="min-w-0">
        <CardHeader>
          <CardTitle>Lease history</CardTitle>
          <CardDescription>
            {detail.leases.length} {detail.leases.length === 1 ? 'lease' : 'leases'}, newest first
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[44rem]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-5">Unit</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead className="text-right">Rent / mo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-5">Outcome</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.leases.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="pl-5">
                      <span className="block font-medium text-foreground">{entry.propertyName}</span>
                      <span className="block text-caption text-muted-foreground">{entry.unitLabel}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(entry.startDate)} – {formatDate(entry.endDate)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(entry.monthlyRent)}</TableCell>
                    <TableCell>
                      <LeaseStatusBadge status={getLeaseDisplayStatus(entry)} />
                    </TableCell>
                    <TableCell className="pr-5 text-caption text-muted-foreground">
                      {entry.endedAt
                        ? `${entry.endedAt < entry.startDate ? 'Cancelled before move-in' : entry.endReason ? LEASE_END_REASON_LABELS[entry.endReason] : 'Ended'} · ${formatDate(entry.endedAt)}`
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
