import { ArrowRight } from 'lucide-react'
import { Link } from 'react-router'

import { DetailList } from '@/components/shared/detail-list'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { isActiveWorkOrder } from '@/data/domain/maintenance-rules'
import { type VendorDetail } from '@/data/services'
import { WorkOrderStatusBadge } from '@/features/maintenance/components/request-badges'
import { CategoryChips } from '@/features/vendors/components/vendor-badges'
import { VendorPerformanceCard } from '@/features/vendors/components/vendor-performance-card'
import { locationText } from '@/features/vendors/lib/vendor-detail'
import { useFormat } from '@/hooks/use-format'
import { formatMoney } from '@/lib/format'

const linkClass = 'rounded-sm text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

export function VendorOverviewTab({ detail, onShowWorkOrders }: { detail: VendorDetail; onShowWorkOrders: () => void }) {
  const { date: formatDate, dateTime: formatDateTime } = useFormat()
  const { vendor, performance } = detail
  const open = detail.workOrders.filter((entry) => isActiveWorkOrder(entry.order))
  const breakdown = [
    { label: 'Ongoing', value: performance.open },
    { label: 'Completed', value: performance.completed },
    { label: 'Cancelled', value: performance.cancelled, note: performance.reassignedAway > 0 ? `${performance.reassignedAway} reassigned to another vendor` : undefined },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="flex min-w-0 flex-col gap-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <DetailList
              className="lg:grid-cols-3"
              items={[
                { label: 'Contact person', value: vendor.contactName },
                {
                  label: 'Email',
                  value: (
                    <a href={`mailto:${vendor.email}`} title={vendor.email} className={`[overflow-wrap:anywhere] ${linkClass}`}>
                      <EmailText email={vendor.email} />
                    </a>
                  ),
                },
                { label: 'Phone', value: <a href={`tel:${vendor.phone.replace(/[^\d+]/g, '')}`} className={linkClass}>{vendor.phone}</a> },
                { label: 'Company / legal name', value: vendor.company || <span className="text-muted-foreground">Same as vendor name</span> },
                { label: 'Added', value: formatDate(vendor.createdAt.slice(0, 10)) },
                { label: 'Last updated', value: formatDate(vendor.updatedAt.slice(0, 10)) },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Services</CardTitle>
            <CardDescription>Recommended first when assigning matching requests</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChips categories={vendor.categories} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current jobs</CardTitle>
            <CardDescription>{open.length === 0 ? 'Nothing scheduled or in progress' : `${open.length} scheduled or in progress`}</CardDescription>
            {detail.workOrders.length > 0 ? (
              <CardAction>
                <Button variant="ghost" size="sm" onClick={onShowWorkOrders}>
                  All work orders
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {open.length === 0 ? (
              <p className="text-body text-muted-foreground">{detail.workOrders.length === 0 ? 'No work orders yet.' : 'All jobs are completed or cancelled.'}</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {open.slice(0, 5).map((entry) => (
                  <li key={entry.order.id} className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                    <span className="min-w-0">
                      {entry.request ? (
                        <Link to={`/maintenance/${entry.request.id}`} className={`block truncate text-body font-medium ${linkClass}`}>
                          {entry.request.title}
                        </Link>
                      ) : null}
                      <span className="block truncate text-caption text-muted-foreground">
                        {entry.request?.id} · {locationText(entry)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2 text-caption text-muted-foreground">
                      {entry.order.scheduledFor ? formatDateTime(entry.order.scheduledFor) : 'Not scheduled'}
                      <WorkOrderStatusBadge status={entry.order.status} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {vendor.notes ? (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-body whitespace-pre-line text-foreground">{vendor.notes}</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <VendorPerformanceCard performance={performance} />
        <VendorBillsCard detail={detail} />
        <Card>
          <CardHeader>
            <CardTitle>Jobs</CardTitle>
            <CardDescription>All work orders for this vendor</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-3 gap-3">
              {breakdown.map((item) => (
                <div key={item.label} className="rounded-lg border border-border p-3">
                  <dt className="text-caption text-muted-foreground">{item.label}</dt>
                  <dd className="mt-0.5 text-h3 text-foreground tabular-nums">{item.value}</dd>
                </div>
              ))}
            </dl>
            {breakdown[2]?.note ? <p className="mt-2 text-caption text-muted-foreground">{breakdown[2].note}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function VendorBillsCard({ detail }: { detail: VendorDetail }) {
  const { vendor, bills } = detail
  const money = (cents: number) => formatMoney(cents, bills.money)
  const party = encodeURIComponent(`vendor:${vendor.id}`)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bills</CardTitle>
        <CardDescription>Finance bills paid to this vendor</CardDescription>
        {bills.count > 0 ? (
          <CardAction>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/finance/transactions?party=${party}&kind=expense&range=all`}>
                View bills
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {bills.count === 0 ? (
          <p className="text-body text-muted-foreground">No bills yet. Completing a work order with a final cost creates one.</p>
        ) : (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border p-3">
                <dt className="text-caption text-muted-foreground">Paid</dt>
                <dd className="mt-0.5 text-h3 text-foreground tabular-nums">{money(bills.paidCents)}</dd>
              </div>
              <div className="rounded-lg border border-border p-3">
                <dt className="text-caption text-muted-foreground">Unpaid</dt>
                <dd className="mt-0.5 text-h3 text-foreground tabular-nums">{money(bills.unpaidCents)}</dd>
                {bills.overdueCount > 0 ? <dd className="text-caption text-danger">{bills.overdueCount} overdue</dd> : null}
              </div>
            </dl>
            <p className="text-caption text-muted-foreground">
              {bills.count} {bills.count === 1 ? 'bill' : 'bills'}
              {bills.voidCount > 0 ? `, ${bills.voidCount} void` : ''}. Performance figures above use work-order costs.
            </p>
          </>
        )}
        {vendor.active ? (
          <Button asChild variant="outline" size="sm" className="self-start">
            <Link to={`/finance/expenses/new?vendorId=${encodeURIComponent(vendor.id)}`}>Add bill</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}

/**
 * An email address with line-break opportunities after "@" and before each
 * dot, so long addresses wrap at natural points instead of mid-word. The
 * link text and accessible name are still the full address.
 */
function EmailText({ email }: { email: string }) {
  const at = email.indexOf('@')
  if (at < 0) return email
  const [local, domain] = [email.slice(0, at), email.slice(at + 1)]
  const parts = domain.split('.')
  return (
    <>
      {local}@<wbr />
      {parts.map((part, index) => (
        <span key={index}>
          {index > 0 ? (
            <>
              <wbr />.
            </>
          ) : null}
          {part}
        </span>
      ))}
    </>
  )
}
