import { screen, waitFor, within } from '@testing-library/react'

import { createServiceRequest, reassignVendor, setVendorActive, startWork, updateVendor } from '@/data/services'
import { readDatabase, updateDatabase } from '@/data/store/demo-store'
import { renderApp } from '@/test/render-app'
import { type ServiceRequestInput, type Vendor, type WorkOrderInput } from '@/types'

const db = () => readDatabase()
const vendorById = (id: string) => db().vendors.find((vendor) => vendor.id === id) as Vendor
const activeVendor = (except: string[] = []) => db().vendors.find((vendor) => vendor.active && !except.includes(vendor.id)) as Vendor
const workOrderPanel = () => screen.getByText('Work order', { selector: '[data-slot="card-title"]' }).closest('[data-slot="card"]') as HTMLElement

const requestInput = (title = 'Lobby light flickering'): ServiceRequestInput => ({
  title,
  description: '',
  category: 'electrical',
  priority: 'medium',
  propertyId: 'prop_101',
  unitId: null,
  area: 'Lobby',
  tenantId: null,
  source: 'staff',
  permissionToEnter: false,
  accessNotes: '',
})
const order = (vendorId: string): WorkOrderInput => ({ vendorId, scheduledFor: null, estimatedCost: 120, notes: '' })

async function openRequest(id: string) {
  const app = renderApp(`/maintenance/${id}`)
  await screen.findByRole('heading', { level: 1 })
  return app
}

const vendorInput = (vendor: Vendor, overrides: Partial<Vendor> = {}) => ({
  name: vendor.name,
  company: vendor.company,
  categories: vendor.categories,
  contactName: vendor.contactName,
  phone: vendor.phone,
  email: vendor.email,
  notes: vendor.notes,
  active: vendor.active,
  ...overrides,
})

describe('Vendor links in Maintenance', () => {
  it('links the current work-order vendor to its profile', async () => {
    const vendor = activeVendor()
    const request = await createServiceRequest(requestInput(), { assign: order(vendor.id) })
    const { user, router } = await openRequest(request.id)
    const link = within(workOrderPanel()).getByRole('link', { name: vendor.name })
    expect(link).toHaveAttribute('href', `/vendors/${vendor.id}`)
    // Contact details and costs stay plain text.
    expect(within(workOrderPanel()).getAllByRole('link')).toHaveLength(1)
    await user.click(link)
    await screen.findByRole('heading', { level: 1, name: vendor.name })
    expect(router.state.location.pathname).toBe(`/vendors/${vendor.id}`)
  })

  it('links vendors in the request table, only on the vendor name', async () => {
    const vendor = activeVendor()
    const request = await createServiceRequest(requestInput('Unique vendor link check'), { assign: order(vendor.id) })
    const { user, router } = renderApp(`/maintenance?q=${encodeURIComponent('Unique vendor link check')}`)
    const table = await screen.findByRole('table', { name: /^maintenance requests/i })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
    const row = within(table).getAllByRole('row')[1] as HTMLElement
    const hrefs = within(row).getAllByRole('link').map((link) => link.getAttribute('href'))
    expect(hrefs).toEqual(expect.arrayContaining([`/maintenance/${request.id}`, `/vendors/${vendor.id}`]))
    expect(hrefs.filter((href) => href?.startsWith('/vendors/'))).toHaveLength(1)
    await user.click(within(row).getByRole('link', { name: vendor.name }))
    await screen.findByRole('heading', { level: 1, name: vendor.name })
    expect(router.state.location.pathname).toBe(`/vendors/${vendor.id}`)
  })

  it('keeps inactive vendors reachable with their badge', async () => {
    const vendor = activeVendor()
    const request = await createServiceRequest(requestInput(), { assign: order(vendor.id) })
    await setVendorActive(vendor.id, false, { confirmOpenJobs: true })
    const { user } = await openRequest(request.id)
    const panel = workOrderPanel()
    expect(within(panel).getByText('Inactive')).toBeInTheDocument()
    await user.click(within(panel).getByRole('link', { name: vendor.name }))
    await screen.findByRole('heading', { level: 1, name: vendor.name })
    expect(screen.getByText(/can’t be assigned to new work orders/)).toBeInTheDocument()
  })

  it('resolves a renamed vendor through its stable id', async () => {
    const vendor = activeVendor()
    const request = await createServiceRequest(requestInput(), { assign: order(vendor.id) })
    await updateVendor(vendor.id, vendorInput(vendor, { name: 'Renamed Services Group' }))
    await openRequest(request.id)
    const link = within(workOrderPanel()).getByRole('link', { name: 'Renamed Services Group' })
    expect(link).toHaveAttribute('href', `/vendors/${vendor.id}`)
    expect(within(workOrderPanel()).queryByRole('link', { name: vendor.name })).not.toBeInTheDocument()
  })

  it('links both vendors of a reassigned work order', async () => {
    const first = activeVendor()
    const second = activeVendor([first.id])
    const request = await createServiceRequest(requestInput(), { assign: order(first.id) })
    await startWork(request.id)
    await reassignVendor(request.id, order(second.id), 'Faster availability')
    // The previous vendor later becomes inactive: history still links to it.
    await setVendorActive(first.id, false, { confirmOpenJobs: true })
    await openRequest(request.id)
    const panel = workOrderPanel()

    const current = within(panel).getAllByRole('link', { name: second.name })
    expect(current.every((link) => link.getAttribute('href') === `/vendors/${second.id}`)).toBe(true)
    expect(within(panel).getByText('Took over from')).toBeInTheDocument()

    const history = within(panel).getByRole('table')
    const row = within(history).getAllByRole('row')[1] as HTMLElement
    expect(within(row).getByRole('link', { name: first.name })).toHaveAttribute('href', `/vendors/${first.id}`)
    expect(within(row).getByText('Inactive')).toBeInTheDocument()
    expect(within(row).getByText('Reassigned to')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: second.name })).toHaveAttribute('href', `/vendors/${second.id}`)
  })

  it('shows a missing vendor reference as plain text without a link', async () => {
    const vendor = activeVendor()
    const request = await createServiceRequest(requestInput('Orphaned vendor reference'), { assign: order(vendor.id) })
    updateDatabase((data) => {
      for (const entry of data.workOrders) if (entry.requestId === request.id) entry.vendorId = 'ven_does_not_exist'
    })
    const { unmount } = await openRequest(request.id)
    const panel = workOrderPanel()
    expect(within(panel).getByText('Unknown vendor')).toBeInTheDocument()
    expect(within(panel).queryByRole('link')).not.toBeInTheDocument()
    expect(within(panel).queryByText('Inactive')).not.toBeInTheDocument()
    unmount()

    renderApp(`/maintenance?q=${encodeURIComponent('Orphaned vendor reference')}`)
    const table = await screen.findByRole('table', { name: /^maintenance requests/i })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(2))
    const row = within(table).getAllByRole('row')[1] as HTMLElement
    expect(within(row).getByText('Unknown vendor')).toBeInTheDocument()
    expect(within(row).getAllByRole('link').some((link) => link.getAttribute('href')?.startsWith('/vendors/'))).toBe(false)
    expect(vendorById('ven_does_not_exist')).toBeUndefined()
  })

  it('handles an invalid vendor link target with the not-found state', async () => {
    renderApp('/vendors/ven_does_not_exist')
    expect(await screen.findByRole('heading', { name: /vendor not found/i })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: /vendors/i }).length).toBeGreaterThan(0)
  })
})
