import { Building2, CircleUserRound, Mail, MoreHorizontal, Pencil, Phone, Trash2, UserRoundCheck, UserRoundX } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useLoaderData, useNavigate, useRevalidator, useSearchParams } from 'react-router'
import { toast } from 'sonner'

import { ActivityTimeline } from '@/components/shared/activity-timeline'
import { BackLink } from '@/components/shared/back-link'
import { DetailList } from '@/components/shared/detail-list'
import { EmptyState } from '@/components/shared/empty-state'
import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { StatusAlert } from '@/components/shared/status-alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ACCESS_AREA_LABELS, ACCESS_AREAS, ROLE_ACCESS, ROLE_DESCRIPTIONS, ROLE_LABELS } from '@/data/domain/staff-rules'
import { deleteStaff, setStaffActive } from '@/data/services'
import { StaffAvatar } from '@/features/staff/components/staff-avatar'
import { RoleBadge, StaffStatusBadge, YouBadge } from '@/features/staff/components/staff-badges'
import { StaffConfirmDialog } from '@/features/staff/components/staff-confirm-dialog'
import { buildStaffTimeline } from '@/features/staff/lib/staff-timeline'
import { type staffDetailLoader } from '@/features/staff/staff.loaders'
import { useFormat } from '@/hooks/use-format'

const TABS = ['overview', 'properties', 'activity'] as const
type DetailTab = (typeof TABS)[number]
const isTab = (value: string | null): value is DetailTab => (TABS as readonly (string | null)[]).includes(value)
const ACCESS_TEXT = { manage: 'Manage', view: 'View only', none: 'No access' } as const
const linkClass = 'rounded-sm font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50'

type Action = 'deactivate' | 'reactivate' | 'delete'

export function StaffDetailsPage() {
  const detail = useLoaderData<typeof staffDetailLoader>()
  const { member, isSelf, photo, properties, deactivateBlock } = detail
  const navigate = useNavigate()
  const revalidator = useRevalidator()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: DetailTab = isTab(tabParam) ? tabParam : 'overview'
  const [action, setAction] = useState<Action | null>(null)
  const { date: formatDate } = useFormat()
  const timeline = useMemo(() => buildStaffTimeline(detail), [detail])

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
      <div className="flex flex-col gap-3">
        <BackLink to="/staff" label="Staff" />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <StaffAvatar name={member.name} photo={photo} className="size-14 max-sm:hidden" />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-h1 text-foreground">{member.name}</h1>
                {isSelf ? <YouBadge /> : null}
                <StaffStatusBadge active={member.active} />
              </div>
              <p className="flex flex-wrap items-center gap-2 text-body text-muted-foreground">
                {member.jobTitle}
                <RoleBadge role={member.role} />
              </p>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
                <a href={`mailto:${member.email}`} className="inline-flex min-w-0 items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{member.email}</span>
                </a>
                {member.phone ? (
                  <a href={`tel:${member.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1.5 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50">
                    <Phone className="size-4 shrink-0" aria-hidden="true" />
                    {member.phone}
                  </a>
                ) : null}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link to={`/staff/${member.id}/edit`}>
                <Pencil data-icon="inline-start" />
                Edit
              </Link>
            </Button>
            {isSelf ? (
              <Button variant="outline" asChild>
                <Link to="/account">
                  <CircleUserRound data-icon="inline-start" />
                  Your account
                </Link>
              </Button>
            ) : member.active ? (
              <Button variant="outline" onClick={() => setAction('deactivate')}>
                <UserRoundX data-icon="inline-start" />
                Deactivate
              </Button>
            ) : (
              <Button onClick={() => setAction('reactivate')}>
                <UserRoundCheck data-icon="inline-start" />
                Reactivate
              </Button>
            )}
            {isSelf ? null : (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="More actions">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem variant="destructive" onSelect={() => setAction('delete')}>
                    <Trash2 aria-hidden="true" />
                    Delete staff member
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {isSelf ? (
        <StatusAlert tone="info" icon={CircleUserRound} title="This is you">
          Your name, email, phone and job title are your profile. You can’t deactivate, delete or change the role of your own record.
        </StatusAlert>
      ) : null}
      {!member.active ? (
        <StatusAlert
          tone="info"
          icon={UserRoundX}
          title={`Inactive${member.deactivatedAt ? ` since ${formatDate(member.deactivatedAt.slice(0, 10))}` : ''}`}
          action={
            <Button size="sm" variant="outline" onClick={() => setAction('reactivate')}>
              Reactivate
            </Button>
          }
        >
          {member.name} is kept for history. Their property assignments are kept and apply again if they’re reactivated.
        </StatusAlert>
      ) : null}

      <Tabs value={tab} onValueChange={setTab} className="gap-6">
        <div className="-mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 gap-4">
            <TabsTrigger value="overview" className="px-1">
              Overview
            </TabsTrigger>
            <TabsTrigger value="properties" className="px-1">
              Properties
              <span className="rounded-full bg-muted px-1.5 text-caption text-muted-foreground tabular-nums">{properties.length}</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="px-1">
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DetailList
                  items={[
                    { label: 'Job title', value: member.jobTitle },
                    { label: 'Role', value: ROLE_LABELS[member.role] },
                    { label: 'Email', value: <span className="break-all">{member.email}</span> },
                    { label: 'Phone', value: member.phone || <span className="text-muted-foreground">Not given</span> },
                    {
                      label: 'Properties',
                      value:
                        properties.length > 0 ? (
                          <button type="button" className={linkClass} onClick={() => setTab('properties')}>
                            {properties.length} assigned
                          </button>
                        ) : (
                          <span className="text-muted-foreground">No assignments</span>
                        ),
                    },
                    { label: 'On the team since', value: formatDate(member.createdAt.slice(0, 10)) },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle role="heading" aria-level={2}>
                  {ROLE_LABELS[member.role]}
                </CardTitle>
                <CardDescription>{ROLE_DESCRIPTIONS[member.role]}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 text-body">
                  {ACCESS_AREAS.map((area) => (
                    <div key={area} className="contents">
                      <dt className="text-muted-foreground">{ACCESS_AREA_LABELS[area]}</dt>
                      <dd className={ROLE_ACCESS[member.role][area] === 'manage' ? 'font-medium text-foreground' : 'text-muted-foreground'}>{ACCESS_TEXT[ROLE_ACCESS[member.role][area]]}</dd>
                    </div>
                  ))}
                </dl>
                <p className="text-caption text-muted-foreground">
                  Demo: access isn’t enforced.{' '}
                  <Link to="/staff?tab=roles" className={linkClass}>
                    Compare roles
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="properties">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Assigned properties
              </CardTitle>
              <CardDescription>Properties {member.name} looks after. Change them with Edit.</CardDescription>
            </CardHeader>
            <CardContent>
              {properties.length === 0 ? (
                <EmptyState size="sm" icon={Building2} title="No assigned properties" description={member.role === 'owner' || member.role === 'admin' ? 'Owners and admins usually cover the whole portfolio.' : 'Assign properties with Edit.'} />
              ) : (
                <ul className="grid gap-2 sm:grid-cols-2" aria-label="Assigned properties">
                  {properties.map((property) => (
                    <li key={property.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5">
                      <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="min-w-0">
                        <Link to={`/properties/${property.id}`} className={`block truncate text-body ${linkClass}`}>
                          {property.name}
                        </Link>
                        <span className="block text-caption text-muted-foreground capitalize">{property.type}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity">
          <Card>
            <CardHeader>
              <CardTitle role="heading" aria-level={2}>
                Activity
              </CardTitle>
              <CardDescription>Changes to this team member. Entries keep the name used at the time.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityTimeline items={timeline} grouped emptyDescription="Changes will appear here." />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <StaffConfirmDialog
        open={action === 'deactivate'}
        onOpenChange={(open) => !open && setAction(null)}
        title={deactivateBlock ? `${member.name} can’t be deactivated` : `Deactivate ${member.name}?`}
        description={deactivateBlock ?? `${member.name} stays in the directory as Inactive, with their history and property assignments. You can reactivate them later.`}
        confirmLabel="Deactivate"
        cancelLabel={deactivateBlock ? 'Got it' : 'Keep active'}
        hideConfirm={deactivateBlock !== null}
        destructive
        withNote={deactivateBlock ? undefined : { label: 'Reason', placeholder: 'e.g. Left the company' }}
        onConfirm={async (note) => {
          await setStaffActive(member.id, false, note)
          toast.success('Staff member deactivated', { description: member.name })
          done()
        }}
      />
      <StaffConfirmDialog
        open={action === 'reactivate'}
        onOpenChange={(open) => !open && setAction(null)}
        title={`Reactivate ${member.name}?`}
        description="They become active on the team again, with the same role and properties. The earlier deactivation stays in the activity history."
        confirmLabel="Reactivate"
        withNote={{ label: 'Reason', placeholder: 'e.g. Rejoined the team' }}
        onConfirm={async (note) => {
          await setStaffActive(member.id, true, note)
          toast.success('Staff member reactivated', { description: member.name })
          done()
        }}
      />
      <StaffConfirmDialog
        open={action === 'delete'}
        onOpenChange={(open) => !open && setAction(null)}
        title={deactivateBlock ? `${member.name} can’t be deleted` : `Delete ${member.name}?`}
        description={deactivateBlock ?? `This removes ${member.name} and their activity history permanently. To keep their history, deactivate them instead.`}
        confirmLabel="Delete permanently"
        cancelLabel={deactivateBlock ? 'Got it' : 'Cancel'}
        hideConfirm={deactivateBlock !== null}
        destructive
        onConfirm={async () => {
          const removed = await deleteStaff(member.id)
          toast.success('Staff member deleted', { description: removed.name })
          setAction(null)
          await navigate('/staff')
        }}
      />
    </PageContainer>
  )
}
