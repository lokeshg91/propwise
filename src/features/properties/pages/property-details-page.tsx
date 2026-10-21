import { useCallback, useMemo, useState } from 'react'
import { useLoaderData, useNavigate, useRevalidator, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { PageContainer } from '@/components/shared/page-container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { isActiveRequest } from '@/data/domain/maintenance-rules'
import { RequestsTableCard } from '@/features/maintenance/components/requests-table-card'
import { PropertyDetailHeader } from '@/features/properties/components/property-detail-header'
import { PropertyKpis } from '@/features/properties/components/property-kpis'
import { PropertyOverviewTab } from '@/features/properties/components/property-overview-tab'
import { PropertyTimeline } from '@/features/properties/components/property-timeline'
import { PropertyUnitsTab } from '@/features/properties/components/property-units-tab'
import { type UnitDialogState, UnitFormDialog } from '@/features/properties/components/unit-form-dialog'
import { buildPropertyTimeline, getUnitStats } from '@/features/properties/lib/property-detail'
import { type propertyDetailLoader } from '@/features/properties/properties.loaders'
import { type Unit } from '@/types'

const TABS = ['overview', 'units', 'activity', 'maintenance'] as const
type DetailTab = (typeof TABS)[number]
const isTab = (value: string | null): value is DetailTab => (TABS as readonly (string | null)[]).includes(value)

export function PropertyDetailsPage() {
  const detail = useLoaderData<typeof propertyDetailLoader>()
  const { property, units } = detail
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: DetailTab = isTab(tabParam) ? tabParam : 'overview'
  const [dialog, setDialog] = useState<UnitDialogState>(null)

  const stats = useMemo(() => getUnitStats(units, property.totalUnits), [units, property.totalUnits])
  const timeline = useMemo(() => buildPropertyTimeline(detail), [detail])
  const canAddUnit = units.length < property.totalUnits
  const openRequests = detail.maintenanceRequests.filter((item) => isActiveRequest(item.request)).length

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

  const openAddUnit = () => {
    if (canAddUnit) {
      setDialog({ mode: 'create' })
      return
    }
    toast.info(`All ${property.totalUnits} units are set up`, {
      description: 'Increase total units in the property details to add more.',
      action: { label: 'Edit property', onClick: () => void navigate(`/properties/${property.id}/edit`) },
    })
  }
  const editUnit = useCallback(
    (unit: Unit) =>
      setDialog({ mode: 'edit', unit, lease: detail.currentLeases.find((lease) => lease.unitId === unit.id) ?? null }),
    [detail.currentLeases],
  )
  const handleSaved = () => {
    setDialog(null)
    void revalidator.revalidate()
  }

  return (
    <PageContainer>
      <PropertyDetailHeader property={property} canAddUnit={canAddUnit} onAddUnit={openAddUnit} />
      <PropertyKpis property={property} stats={stats} />

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger value="overview" className="px-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="units" className="px-1">
              Units
              <span className="rounded-full bg-muted px-1.5 text-caption text-muted-foreground tabular-nums">{units.length}</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-1">
              Activity
            </TabsTrigger>
            <TabsTrigger value="maintenance" className="px-1">
              Maintenance
              {openRequests > 0 ? (
                <span className="rounded-full bg-muted px-1.5 text-caption text-muted-foreground tabular-nums">{openRequests}</span>
              ) : null}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <PropertyOverviewTab
            property={property}
            stats={stats}
            timeline={timeline}
            onShowUnits={() => setTab('units')}
            onShowActivity={() => setTab('activity')}
          />
        </TabsContent>
        <TabsContent value="units">
          <PropertyUnitsTab
            property={property}
            units={units}
            leases={detail.currentLeases}
            stats={stats}
            canAddUnit={canAddUnit}
            onAddUnit={openAddUnit}
            onEditUnit={editUnit}
          />
        </TabsContent>
        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
              <CardDescription>Changes, leasing, payments and maintenance at {property.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <PropertyTimeline items={timeline} grouped />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="maintenance">
          <RequestsTableCard
            items={detail.maintenanceRequests}
            description={`Requests and work orders at ${property.name}`}
            reportHref={`/maintenance/new?propertyId=${property.id}`}
          />
        </TabsContent>
      </Tabs>

      <UnitFormDialog
        property={property}
        state={dialog}
        onOpenChange={(open) => {
          if (!open) setDialog(null)
        }}
        onSaved={handleSaved}
      />
    </PageContainer>
  )
}
