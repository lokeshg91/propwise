import { CircleSlash, UserRoundX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useLoaderData, useNavigate, useRevalidator, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ActivityTimeline } from '@/components/shared/activity-timeline'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { StatusAlert } from '@/components/shared/status-alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isActiveWorkOrder } from '@/data/domain/maintenance-rules'
import { deleteVendor, setVendorActive } from '@/data/services'
import { ConfirmDialog, OpenJobsList } from '@/features/vendors/components/vendor-dialogs'
import { type VendorAction, VendorDetailHeader } from '@/features/vendors/components/vendor-detail-header'
import { VendorOverviewTab } from '@/features/vendors/components/vendor-overview-tab'
import { VendorWorkOrdersTable } from '@/features/vendors/components/vendor-work-orders-table'
import { buildVendorTimeline } from '@/features/vendors/lib/vendor-detail'
import { type vendorDetailLoader } from '@/features/vendors/vendors.loaders'
import { formatDate } from '@/lib/format'

const TABS = ['overview', 'work-orders', 'activity'] as const
type DetailTab = (typeof TABS)[number]
const isTab = (value: string | null): value is DetailTab => (TABS as readonly (string | null)[]).includes(value)

export function VendorDetailsPage() {
  const detail = useLoaderData<typeof vendorDetailLoader>()
  const { vendor } = detail
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: DetailTab = isTab(tabParam) ? tabParam : 'overview'
  const [action, setAction] = useState<VendorAction | null>(null)

  const timeline = useMemo(() => buildVendorTimeline(detail), [detail])
  const openJobs = detail.workOrders.filter((entry) => isActiveWorkOrder(entry.order))
  const statusCounts = {
    completed: detail.workOrders.filter((entry) => entry.order.status === 'completed').length,
    cancelled: detail.workOrders.filter((entry) => entry.order.status === 'cancelled').length,
  }

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

  const done = () => {
    setAction(null)
    void revalidator.revalidate()
  }

  return (
    <PageContainer>
      <NavigationProgress />
      <VendorDetailHeader vendor={vendor} onAction={setAction} />

      {!vendor.active ? (
        <StatusAlert
          tone="info"
          icon={UserRoundX}
          title={`Inactive${vendor.deactivatedAt ? ` since ${formatDate(vendor.deactivatedAt.slice(0, 10))}` : ''}`}
          action={
            <Button size="sm" variant="outline" onClick={() => setAction('reactivate')}>
              Reactivate
            </Button>
          }
        >
          {vendor.name} can’t be assigned to new work orders.
          {openJobs.length > 0 ? ` ${openJobs.length} open ${openJobs.length === 1 ? 'job continues' : 'jobs continue'} and can still be completed or reassigned.` : ' Past work orders keep showing this vendor.'}
        </StatusAlert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger value="overview" className="px-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="work-orders" className="px-1">
              Work orders
              <span className="rounded-full bg-muted px-1.5 text-caption text-muted-foreground tabular-nums">{detail.workOrders.length}</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-1">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="overview">
          <VendorOverviewTab detail={detail} onShowWorkOrders={() => setTab('work-orders')} />
        </TabsContent>
        <TabsContent value="work-orders">
          <VendorWorkOrdersTable workOrders={detail.workOrders} vendorName={vendor.name} />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Profile changes and job milestones. Entries keep the vendor name used at the time.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={timeline} grouped emptyDescription="Changes and jobs will appear here." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={action === 'deactivate'}
        onOpenChange={(open) => !open && setAction(null)}
        title={`Deactivate ${vendor.name}?`}
        description={
          openJobs.length > 0
            ? `${openJobs.length} open ${openJobs.length === 1 ? 'work order stays' : 'work orders stay'} with ${vendor.name} and can still be completed or reassigned. No new work orders can be assigned while the vendor is inactive.`
            : `${vendor.name} won’t be offered for new work orders. Past work orders keep showing the vendor, marked Inactive.`
        }
        confirmLabel={openJobs.length > 0 ? `Deactivate with ${openJobs.length} open ${openJobs.length === 1 ? 'job' : 'jobs'}` : 'Deactivate vendor'}
        cancelLabel="Keep active"
        destructive
        withNote={{ label: 'Reason', placeholder: 'e.g. Contract ended' }}
        onConfirm={async (note) => {
          await setVendorActive(vendor.id, false, { confirmOpenJobs: true, note })
          toast.success('Vendor deactivated', { description: vendor.name })
          done()
        }}
      >
        {openJobs.length > 0 ? (
          <div className="flex flex-col gap-2">
            <p className="text-label text-foreground">Open work orders</p>
            <OpenJobsList jobs={openJobs} />
          </div>
        ) : null}
      </ConfirmDialog>

      <ConfirmDialog
        open={action === 'reactivate'}
        onOpenChange={(open) => !open && setAction(null)}
        title={`Reactivate ${vendor.name}?`}
        description="The vendor can be assigned to new work orders again. The earlier deactivation stays in the activity history."
        confirmLabel="Reactivate vendor"
        withNote={{ label: 'Reason', placeholder: 'e.g. New contract signed' }}
        onConfirm={async (note) => {
          await setVendorActive(vendor.id, true, { note })
          toast.success('Vendor reactivated', { description: vendor.name })
          done()
        }}
      />

      <ConfirmDialog
        open={action === 'delete'}
        onOpenChange={(open) => !open && setAction(null)}
        title={detail.canDelete ? `Delete ${vendor.name}?` : `${vendor.name} can’t be deleted`}
        description={
          detail.canDelete
            ? 'This vendor has never been assigned a work order. Deleting removes the vendor and its activity permanently.'
            : `${vendor.name} appears on ${detail.workOrders.length} ${detail.workOrders.length === 1 ? 'work order' : 'work orders'}${statusCounts.completed || statusCounts.cancelled ? ` (${[statusCounts.completed ? `${statusCounts.completed} completed` : '', statusCounts.cancelled ? `${statusCounts.cancelled} cancelled or reassigned` : '', openJobs.length ? `${openJobs.length} open` : ''].filter(Boolean).join(', ')})` : ''}. Those records must keep pointing to this vendor, so it can’t be deleted.${vendor.active ? ' Deactivate it instead to stop new assignments.' : ' It’s already inactive, so it can’t receive new work orders.'}`
        }
        confirmLabel="Delete permanently"
        cancelLabel={detail.canDelete ? 'Cancel' : 'Got it'}
        destructive
        hideConfirm={!detail.canDelete}
        extraAction={
          !detail.canDelete && vendor.active ? (
            <Button type="button" variant="destructive" onClick={() => setAction('deactivate')}>
              <CircleSlash data-icon="inline-start" />
              Deactivate instead
            </Button>
          ) : null
        }
        onConfirm={async () => {
          const removed = await deleteVendor(vendor.id)
          toast.success('Vendor deleted', { description: removed.name })
          setAction(null)
          await navigate('/vendors')
        }}
      />
    </PageContainer>
  )
}
