import { screen, waitFor, within } from '@testing-library/react'

import { isCurrentLease } from '@/data/domain/lease-rules'
import { getRequestTiming, isActiveRequest } from '@/data/domain/maintenance-rules'
import { assignVendor, completeRequest, createServiceRequest, startWork } from '@/data/services'
import { readDatabase, updateDatabase } from '@/data/store/demo-store'
import { renderApp } from '@/test/render-app'
import { type ServiceRequestInput, type Unit } from '@/types'

type User = ReturnType<typeof renderApp>['user']

const listTable = () => screen.getByRole('table', { name: /^maintenance requests/i })
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)

async function chooseOption(user: User, combobox: string | RegExp, option: string | RegExp, scope: HTMLElement = document.body) {
  await user.click(within(scope).getByRole('combobox', { name: combobox }))
  await user.click(await screen.findByRole('option', { name: option }))
}

const db = () => readDatabase()
const unitById = (id: string) => db().units.find((unit) => unit.id === id) as Unit
function freeVacantUnit(): Unit {
  const data = db()
  return data.units.find(
    (unit) =>
      unit.status === 'vacant' &&
      !data.leases.some((lease) => lease.unitId === unit.id && isCurrentLease(lease)) &&
      !data.serviceRequests.some((request) => request.unitId === unit.id),
  ) as Unit
}
const activeVendorId = (category = 'plumbing') => db().vendors.find((vendor) => vendor.active && vendor.categories.includes(category as never))?.id ?? ''

function requestInput(unit: Unit | null, overrides: Partial<ServiceRequestInput> = {}): ServiceRequestInput {
  return {
    title: 'Leaking kitchen faucet',
    description: '',
    category: 'plumbing',
    priority: 'medium',
    propertyId: unit?.propertyId ?? 'prop_101',
    unitId: unit?.id ?? null,
    area: unit ? null : 'Lobby',
    tenantId: null,
    source: 'staff',
    permissionToEnter: false,
    accessNotes: '',
    ...overrides,
  }
}

const workOrder = () => ({ vendorId: activeVendorId(), scheduledFor: null, estimatedCost: 200, notes: '' })

async function openDetail(id: string) {
  const app = renderApp(`/maintenance/${id}`)
  await screen.findByRole('heading', { level: 1 })
  return app
}

describe('Maintenance listing', () => {
  it('shows metrics and filters by status, priority and overdue via the URL', async () => {
    const { user, router } = renderApp('/maintenance')
    await screen.findByRole('heading', { level: 1, name: 'Maintenance' })
    const requests = db().serviceRequests
    const active = requests.filter(isActiveRequest)
    const metrics = screen.getByRole('region', { name: 'Maintenance metrics' })
    expect(within(metrics).getByText(String(active.length))).toBeInTheDocument()
    expect(screen.getAllByText(`Showing 1–10 of ${active.length} requests`).length).toBeGreaterThan(0)

    const completed = requests.filter((request) => request.status === 'completed').length
    await user.click(screen.getByRole('radio', { name: `Completed (${completed})` }))
    expect(router.state.location.search).toBe('?status=completed')
    await user.click(screen.getByRole('radio', { name: /^Active/ }))

    const overdue = active.filter((request) => getRequestTiming(request) === 'overdue')
    await user.click(screen.getByRole('switch', { name: 'Overdue only' }))
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(overdue.length))
    expect(router.state.location.search).toBe('?overdue=1')
    expect(within(listTable()).getAllByText(/^Overdue by/)).toHaveLength(overdue.length)

    await chooseOption(user, 'Filter by priority', 'Urgent')
    const urgentOverdue = overdue.filter((request) => request.priority === 'urgent').length
    await waitFor(() => expect(within(listTable()).queryAllByText(/^Overdue by/)).toHaveLength(urgentOverdue))
    expect(router.state.location.search).toContain('priority=urgent')
  })

  it('searches by id and shows a no-results state with reset', async () => {
    const { user } = renderApp('/maintenance?status=all')
    await screen.findByRole('heading', { level: 1, name: 'Maintenance' })
    const search = screen.getByRole('searchbox', { name: 'Search requests' })
    await user.click(search)
    await user.paste('MR-2049')
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(1))
    expect(within(listTable()).getByText('Roof membrane repair')).toBeInTheDocument()

    await user.clear(search)
    await user.paste('zzz-nothing')
    expect((await screen.findAllByText('No requests match your filters')).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Reset filters' })[0] as HTMLElement)
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(10))
  })
})

describe('Creating requests', () => {
  it('validates, then creates a request that takes a vacant unit offline', async () => {
    const unit = freeVacantUnit()
    const { user, router } = renderApp(`/maintenance/new?propertyId=${unit.propertyId}&unitId=${unit.id}`)
    await screen.findByRole('heading', { level: 1, name: 'New maintenance request' })

    await user.click(screen.getByRole('button', { name: 'Create request' }))
    expect(await screen.findByText(/Please fix 1 field before saving/)).toBeInTheDocument()
    expect(screen.getByText('Describe the issue in a few words')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /^title/i }), 'Replace damaged flooring')
    const offline = screen.getByRole('switch', { name: /offline while the work is done/i })
    expect(offline).toBeEnabled()
    await user.click(offline)
    expect(screen.getByText(/can’t be leased until you return it to Vacant/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Create request' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Replace damaged flooring' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/maintenance/MR-2062')
    expect(unitById(unit.id).status).toBe('maintenance')
    expect(screen.getByText(/It was taken offline for this request/)).toBeInTheDocument()
  })

  it('never offers to take an occupied unit offline', async () => {
    const unit = db().units.find((entry) => entry.status === 'occupied') as Unit
    renderApp(`/maintenance/new?propertyId=${unit.propertyId}&unitId=${unit.id}`)
    await screen.findByRole('heading', { level: 1, name: 'New maintenance request' })
    expect(screen.getByRole('switch', { name: /offline while the work is done/i })).toBeDisabled()
    expect(screen.getByText(/Occupied and reserved units are never changed by maintenance/)).toBeInTheDocument()
  })

  it('preselects the tenant when reporting from a tenant', async () => {
    const lease = db().leases.find((entry) => entry.status === 'active') ?? db().leases[0]
    const tenant = db().tenants.find((entry) => entry.id === lease?.tenantId)
    renderApp(`/maintenance/new?propertyId=${lease?.propertyId}&unitId=${lease?.unitId}&tenantId=${lease?.tenantId}&from=tenant`)
    await screen.findByRole('heading', { level: 1, name: 'New maintenance request' })
    expect(screen.getByRole('radio', { name: 'Tenant' })).toBeChecked()
    expect(screen.getByRole('combobox', { name: /^tenant/i })).toHaveTextContent(tenant?.name ?? '')
    expect(screen.getByRole('link', { name: 'Back to tenant' })).toHaveAttribute('href', `/tenants/${tenant?.id}`)
  })
})

describe('Request lifecycle in the UI', () => {
  it('assigns a vendor; inactive vendors can’t be chosen', async () => {
    const request = await createServiceRequest(requestInput(null))
    const { user } = await openDetail(request.id)
    await user.click(screen.getAllByRole('button', { name: 'Assign vendor' })[0] as HTMLElement)
    const dialog = await screen.findByRole('dialog', { name: 'Assign vendor' })
    await user.click(within(dialog).getByRole('combobox', { name: /vendor/i }))
    expect(await screen.findByRole('option', { name: /^Rapid Rooter Drains/ })).toHaveAttribute('aria-disabled', 'true')
    await user.click(screen.getByRole('option', { name: /^BlueLine Plumbing/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Assign vendor' }))
    expect(await screen.findByText('Vendor assigned')).toBeInTheDocument()
    await waitFor(() => expect(db().serviceRequests.find((entry) => entry.id === request.id)?.status).toBe('scheduled'))
    expect(await screen.findByRole('button', { name: 'Start work' })).toBeInTheDocument()
  })

  it('asks explicitly before returning the unit to Vacant, and keeps it when declined', async () => {
    const unit = freeVacantUnit()
    const request = await createServiceRequest(requestInput(unit), { takeUnitOffline: true, assign: workOrder() })
    const { user } = await openDetail(request.id)
    await user.click(screen.getByRole('button', { name: 'Complete' }))
    const dialog = await screen.findByRole('dialog', { name: 'Complete request' })
    expect(within(dialog).getByText(/is under maintenance\. Return it to Vacant\?/)).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Complete request' }))
    expect(await within(dialog).findByText('Choose whether the unit returns to Vacant')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('radio', { name: /No, keep it under maintenance/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Complete request' }))
    expect(await screen.findByText('Request completed')).toBeInTheDocument()
    expect(unitById(unit.id).status).toBe('maintenance')
  })

  it('returns the unit to Vacant when the user says yes', async () => {
    const unit = freeVacantUnit()
    const request = await createServiceRequest(requestInput(unit), { takeUnitOffline: true, assign: workOrder() })
    const { user } = await openDetail(request.id)
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel request' })
    await user.type(within(dialog).getByRole('textbox', { name: /reason/i }), 'Owner deferred the work')
    await user.click(within(dialog).getByRole('radio', { name: /Yes, return/ }))
    await user.click(within(dialog).getByRole('button', { name: 'Cancel request' }))
    expect(await screen.findByText('Request cancelled')).toBeInTheDocument()
    expect(unitById(unit.id).status).toBe('vacant')
  })

  it('keeps the previous work order when reassigning and shows it in history', async () => {
    const request = await createServiceRequest(requestInput(null), { assign: workOrder() })
    await startWork(request.id)
    const { user } = await openDetail(request.id)
    await user.click(screen.getByRole('button', { name: 'Reassign vendor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Reassign vendor' })
    await chooseOption(user, /vendor/i, /^Propwise In-house Team/, dialog)
    await user.type(within(dialog).getByRole('textbox', { name: /reason/i }), 'Faster availability')
    await user.click(within(dialog).getByRole('button', { name: 'Reassign' }))
    expect(await screen.findByText('Vendor reassigned')).toBeInTheDocument()

    expect(await screen.findByText('Earlier work orders')).toBeInTheDocument()
    expect(screen.getByText(`WO-${request.id.slice(3)}-1`)).toBeInTheDocument()
    expect(screen.getByText('Reassigned to Propwise In-house Team')).toBeInTheDocument()
    expect(db().workOrders.filter((order) => order.requestId === request.id).map((order) => order.status).sort()).toEqual(['cancelled', 'scheduled'])
  })

  it('shows completed work-order cost and treats cancelled as final', async () => {
    const request = await createServiceRequest(requestInput(null), { assign: workOrder() })
    await completeRequest(request.id, { completedOn: new Date().toISOString().slice(0, 10), actualCost: 315, notes: 'Replaced cartridge', returnUnitToVacant: false })
    const { unmount } = await openDetail(request.id)
    expect(screen.getByText('$315')).toBeInTheDocument()
    expect(screen.getByText('Replaced cartridge')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeInTheDocument()
    unmount()

    const other = await createServiceRequest(requestInput(null, { title: 'Duplicate issue' }))
    const { user } = await openDetail(other.id)
    await user.click(screen.getByRole('button', { name: 'Cancel request' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel request' })
    await user.type(within(dialog).getByRole('textbox', { name: /reason/i }), 'Duplicate')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel request' }))
    expect(await screen.findByText(/Cancelled requests are final and can’t be reopened/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('doesn’t offer Reopen after 30 days', async () => {
    const request = await createServiceRequest(requestInput(null), { assign: workOrder() })
    await completeRequest(request.id, { completedOn: new Date().toISOString().slice(0, 10), actualCost: null, notes: '', returnUnitToVacant: false })
    updateDatabase((draft) => {
      const entry = draft.serviceRequests.find((item) => item.id === request.id)
      if (entry) entry.completedAt = new Date(Date.now() - 40 * 86_400_000).toISOString()
    })
    await openDetail(request.id)
    expect(screen.getByText(/30-day reopen window has closed/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reopen' })).not.toBeInTheDocument()
  })

  it('shows earlier vendors that are now inactive', async () => {
    const request = await createServiceRequest(requestInput(null))
    await assignVendor(request.id, workOrder())
    updateDatabase((draft) => {
      const vendor = draft.vendors.find((entry) => entry.id === activeVendorId())
      if (vendor) vendor.active = false
    })
    await openDetail(request.id)
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0)
  })
})

describe('Integration with Properties and Tenants', () => {
  it('lists a property’s requests on its Maintenance tab', async () => {
    const { user } = renderApp('/properties/prop_202?tab=maintenance')
    await screen.findByRole('heading', { level: 1, name: 'Summit Business Park' })
    const table = await screen.findByRole('table', { name: /maintenance requests for this property/i })
    expect(within(table).getByText('HVAC not cooling — server room')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Report issue' })).toHaveAttribute('href', '/maintenance/new?propertyId=prop_202')
    await user.click(screen.getByRole('radio', { name: /^Completed/ }))
    expect(await within(table).findByText('Roof membrane repair')).toBeInTheDocument()
  })

  it('shows a tenant’s requests on their profile', async () => {
    const request = db().serviceRequests.find((entry) => entry.tenantId && isActiveRequest(entry))
    renderApp(`/tenants/${request?.tenantId}`)
    const card = (await screen.findByText('Maintenance requests')).closest('[data-slot="card"]') as HTMLElement
    expect(within(card).getByRole('link', { name: request?.title })).toHaveAttribute('href', `/maintenance/${request?.id}`)
  })

  it('shows a not-found page for unknown requests', async () => {
    renderApp('/maintenance/MR-0000')
    expect(await screen.findByRole('heading', { level: 1, name: 'Request not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to maintenance' })).toHaveAttribute('href', '/maintenance')
  })
})
