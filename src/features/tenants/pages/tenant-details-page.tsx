import { useCallback, useMemo, useState } from 'react'
import { useLoaderData, useRevalidator, useSearchParams } from 'react-router'

import { ActivityTimeline } from '@/components/shared/activity-timeline'
import { PageContainer } from '@/components/shared/page-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getLeaseDisplayStatus } from '@/data/domain/lease-rules'
import { type LeaseAction, LeaseActionDialog } from '@/features/tenants/components/lease-action-dialogs'
import { TenantDetailHeader } from '@/features/tenants/components/tenant-detail-header'
import { TenantLeaseTab } from '@/features/tenants/components/tenant-lease-tab'
import { TenantOverviewTab } from '@/features/tenants/components/tenant-overview-tab'
import { TenantPaymentsTab } from '@/features/tenants/components/tenant-payments-tab'
import { buildTenantTimeline, maintenanceTimelineItems } from '@/features/tenants/lib/tenant-detail'
import { type tenantDetailLoader } from '@/features/tenants/tenants.loaders'

const TABS = ['overview', 'lease', 'payments', 'activity'] as const
type DetailTab = (typeof TABS)[number]
const isTab = (value: string | null): value is DetailTab => (TABS as readonly (string | null)[]).includes(value)

export function TenantDetailsPage() {
  const detail = useLoaderData<typeof tenantDetailLoader>()
  const { tenant, lease } = detail
  const revalidator = useRevalidator()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: DetailTab = isTab(tabParam) ? tabParam : 'overview'
  const [action, setAction] = useState<LeaseAction | null>(null)

  const leaseStatus = lease ? getLeaseDisplayStatus(lease) : null
  const timeline = useMemo(
    () => [...buildTenantTimeline(detail), ...maintenanceTimelineItems(detail.maintenance)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [detail],
  )
  const record = detail.leases.find((entry) => entry.id === lease?.id)

  const setTab = useCallback(
    (next: string) => {
      if (!isTab(next)) return
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === 'overview') updated.delete('tab')
          else updated.set('tab', next)
          return updated
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  return (
    <PageContainer>
      <TenantDetailHeader tenant={tenant} status={detail.status} leaseStatus={leaseStatus} />

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger value="overview" className="px-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="lease" className="px-1">
              Lease
            </TabsTrigger>
            <TabsTrigger value="payments" className="px-1">
              Payments
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-1">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <TenantOverviewTab
            detail={detail}
            maintenance={detail.maintenance}
            leaseStatus={leaseStatus}
            timeline={timeline}
            onShowLease={() => setTab('lease')}
            onShowActivity={() => setTab('activity')}
          />
        </TabsContent>
        <TabsContent value="lease">
          <TenantLeaseTab detail={detail} leaseStatus={leaseStatus} onAction={setAction} />
        </TabsContent>
        <TabsContent value="payments">
          <TenantPaymentsTab detail={detail} />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Profile changes and lease milestones for {tenant.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={timeline} grouped emptyDescription="Lease and profile changes will appear here." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {lease ? (
        <LeaseActionDialog
          action={action}
          lease={lease}
          tenantName={tenant.name}
          unitDescription={record ? `${record.propertyName}, ${record.unitLabel}` : 'the unit'}
          onOpenChange={(open) => {
            if (!open) setAction(null)
          }}
          onDone={() => {
            setAction(null)
            void revalidator.revalidate()
          }}
        />
      ) : null}
    </PageContainer>
  )
}
