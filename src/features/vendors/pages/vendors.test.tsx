import { screen, waitFor, within } from '@testing-library/react'

import { isActiveWorkOrder } from '@/data/domain/maintenance-rules'
import { readDatabase } from '@/data/store/demo-store'
import { vendorIdFor } from '@/data/mock/vendor-seed'
import { renderApp } from '@/test/render-app'
import { type Vendor } from '@/types'

type User = ReturnType<typeof renderApp>['user']

const db = () => readDatabase()
const vendorTable = () => screen.getByRole('table', { name: /^vendors/i })
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)
const vendorByName = (name: string) => db().vendors.find((vendor) => vendor.name === name) as Vendor
const openJobsFor = (id: string) => db().workOrders.filter((order) => order.vendorId === id && isActiveWorkOrder(order))
/** An active vendor with at least one open job. */
const busyVendor = () => db().vendors.find((vendor) => vendor.active && openJobsFor(vendor.id).length > 0) as Vendor

async function openDetail(id: string, search = '') {
  const app = renderApp(`/vendors/${id}${search}`)
  await screen.findByRole('heading', { level: 1 })
  return app
}

async function fillNewVendor(user: User, values: { name: string; email: string; phone: string; contact?: string }) {
  await user.type(screen.getByLabelText(/^Vendor name/), values.name)
  await user.type(screen.getByLabelText(/^Contact person/), values.contact ?? 'Jamie Cole')
  await user.type(screen.getByLabelText(/^Email/), values.email)
  await user.type(screen.getByLabelText(/^Phone/), values.phone)
  await user.click(screen.getByRole('checkbox', { name: 'Cleaning' }))
}

describe('Vendors listing', () => {
  it('shows summary cards and active vendors by default', async () => {
    renderApp('/vendors')
    await screen.findByRole('heading', { level: 1, name: 'Vendors' })
    const vendors = db().vendors
    const active = vendors.filter((vendor) => vendor.active)
    const metrics = screen.getByRole('region', { name: 'Vendor metrics' })
    expect(within(metrics).getByText(String(active.length))).toBeInTheDocument()
    const open = db().workOrders.filter((order) => isActiveWorkOrder(order)).length
    expect(within(metrics).getByText(String(open))).toBeInTheDocument()
    expect(screen.getAllByText(`Showing 1–10 of ${active.length} vendors`).length).toBeGreaterThan(0)
  })

  it('filters by status, service and open jobs through the URL', async () => {
    const { user, router } = renderApp('/vendors')
    await screen.findByRole('heading', { level: 1, name: 'Vendors' })
    const inactive = db().vendors.filter((vendor) => !vendor.active)
    await user.click(screen.getByRole('radio', { name: `Inactive (${inactive.length})` }))
    expect(router.state.location.search).toBe('?status=inactive')
    await waitFor(() => expect(bodyRows(vendorTable())).toHaveLength(inactive.length))
    expect(within(vendorTable()).getByText('Prairie HVAC Partners')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /^All/ }))
    await user.click(screen.getByRole('switch', { name: 'Has open jobs' }))
    const busy = db().vendors.filter((vendor) => openJobsFor(vendor.id).length > 0)
    await waitFor(() => expect(bodyRows(vendorTable())).toHaveLength(Math.min(busy.length, 10)))
    expect(router.state.location.search).toContain('openJobs=1')

    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    expect(router.state.location.search).toBe('')
  })

  it('restores filters from the URL and filters by service', async () => {
    renderApp('/vendors?status=all&category=cleaning')
    await screen.findByRole('heading', { level: 1, name: 'Vendors' })
    const cleaners = db().vendors.filter((vendor) => vendor.categories.includes('cleaning'))
    await waitFor(() => expect(bodyRows(vendorTable())).toHaveLength(cleaners.length))
    expect(within(vendorTable()).getByText('Northstar Painting Co.')).toBeInTheDocument()
  })

  it('searches by name, contact or phone and shows a no-results state', async () => {
    const { user } = renderApp('/vendors?status=all')
    await screen.findByRole('heading', { level: 1, name: 'Vendors' })
    const search = screen.getByRole('searchbox', { name: 'Search vendors' })
    await user.type(search, 'lakeside')
    await waitFor(() => expect(bodyRows(vendorTable())).toHaveLength(1))
    expect(within(vendorTable()).getByRole('link', { name: 'Lakeside Locksmiths' })).toHaveAttribute('href', `/vendors/${vendorIdFor('Lakeside Locksmiths')}`)

    await user.clear(search)
    await user.type(search, 'zzz-no-such-vendor')
    expect((await screen.findAllByText('No vendors match your filters')).length).toBeGreaterThan(0)
  })
})

describe('Add vendor', () => {
  it('validates required fields', async () => {
    const { user } = renderApp('/vendors/new')
    await screen.findByRole('heading', { level: 1, name: 'Add vendor' })
    await user.click(screen.getByRole('button', { name: 'Add vendor' }))
    expect(await screen.findByText(/Please fix \d+ fields before saving/)).toBeInTheDocument()
    expect(screen.getByLabelText(/^Vendor name/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('blocks a duplicate name and links to the existing vendor', async () => {
    const { user } = renderApp('/vendors/new')
    await screen.findByRole('heading', { level: 1, name: 'Add vendor' })
    const existing = db().vendors[0] as Vendor
    await user.type(screen.getByLabelText(/^Vendor name/), `  ${existing.name.toUpperCase()} LLC `)
    await user.tab()
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('A vendor with this name already exists')
    expect(within(notice).getByRole('link', { name: new RegExp(existing.name) })).toHaveAttribute('href', `/vendors/${existing.id}`)

    // Saving is still blocked by the service.
    await user.type(screen.getByLabelText(/^Contact person/), 'Jamie Cole')
    await user.type(screen.getByLabelText(/^Email/), 'new@unique.example')
    await user.type(screen.getByLabelText(/^Phone/), '(555) 000-1111')
    await user.click(screen.getByRole('checkbox', { name: 'Cleaning' }))
    const before = db().vendors.length
    await user.click(screen.getByRole('button', { name: 'Add vendor' }))
    await waitFor(() => expect(screen.getByLabelText(/^Vendor name/)).toHaveAttribute('aria-invalid', 'true'))
    expect(db().vendors).toHaveLength(before)
  })

  it('blocks a duplicate email case-insensitively', async () => {
    const { user } = renderApp('/vendors/new')
    await screen.findByRole('heading', { level: 1, name: 'Add vendor' })
    const existing = db().vendors[1] as Vendor
    await user.type(screen.getByLabelText(/^Email/), existing.email.toUpperCase())
    await user.tab()
    const notice = await screen.findByRole('alert')
    expect(notice).toHaveTextContent('This email belongs to')
    expect(within(notice).getByRole('link', { name: new RegExp(existing.name) })).toBeInTheDocument()
  })

  it('asks for confirmation when the phone matches, then saves', async () => {
    const { user, router } = renderApp('/vendors/new')
    await screen.findByRole('heading', { level: 1, name: 'Add vendor' })
    const secure = vendorByName('SecureLock Co.')
    await fillNewVendor(user, { name: 'Brightside Painters', email: 'hello@brightside.example', phone: secure.phone })
    expect(await screen.findByText(/Same phone number as the vendor below/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add vendor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Same phone number' })
    expect(within(dialog).getByRole('link', { name: /SecureLock Co\./ })).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: 'Go back' }))
    expect(db().vendors.some((vendor) => vendor.name === 'Brightside Painters')).toBe(false)

    await user.click(screen.getByRole('button', { name: 'Add vendor' }))
    await user.click(within(await screen.findByRole('dialog', { name: 'Same phone number' })).getByRole('button', { name: 'Save anyway' }))
    await screen.findByRole('heading', { level: 1, name: 'Brightside Painters' })
    const created = vendorByName('Brightside Painters')
    expect(router.state.location.pathname).toBe(`/vendors/${created.id}`)
    expect(created).toMatchObject({ active: true, categories: ['cleaning'], phone: secure.phone })
  })
})

describe('Edit vendor', () => {
  it('keeps Save disabled until something changes and records a rename', async () => {
    const vendor = busyVendor()
    const { user } = renderApp(`/vendors/${vendor.id}/edit`)
    await screen.findByRole('heading', { level: 1, name: 'Edit vendor' })
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    const name = screen.getByLabelText(/^Vendor name/)
    await user.clear(name)
    await user.type(name, `${vendor.name} Group`)
    expect(save).toBeEnabled()
    await user.click(save)
    await screen.findByRole('heading', { level: 1, name: `${vendor.name} Group` })
    // Work orders still point at the same vendor id.
    expect(openJobsFor(vendor.id).length).toBeGreaterThan(0)
    expect(db().vendorEvents.some((event) => event.vendorId === vendor.id && event.description.includes(`Renamed from ${vendor.name}`))).toBe(true)
  })

  it('lists open jobs before saving a deactivation', async () => {
    const vendor = busyVendor()
    const jobs = openJobsFor(vendor.id)
    const { user } = renderApp(`/vendors/${vendor.id}/edit`)
    await screen.findByRole('heading', { level: 1, name: 'Edit vendor' })
    await user.click(screen.getByRole('radio', { name: /^Inactive/ }))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    const dialog = await screen.findByRole('dialog', { name: `Deactivate ${vendor.name}?` })
    expect(within(within(dialog).getByRole('list', { name: 'Open work orders' })).getAllByRole('listitem')).toHaveLength(jobs.length)
    await user.click(within(dialog).getByRole('button', { name: 'Save and deactivate' }))
    await screen.findByRole('heading', { level: 1, name: vendor.name })
    expect(db().vendors.find((entry) => entry.id === vendor.id)?.active).toBe(false)
    // The open jobs stay with the vendor.
    expect(openJobsFor(vendor.id)).toHaveLength(jobs.length)
  })
})

describe('Vendor details', () => {
  it('shows overview, work orders and activity tabs', async () => {
    const vendor = busyVendor()
    const { user, router } = await openDetail(vendor.id)
    expect(screen.getByRole('heading', { level: 1, name: vendor.name })).toBeInTheDocument()
    expect(screen.getByText('Performance')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Work orders/ }))
    expect(router.state.location.search).toBe('?tab=work-orders')
    const orders = db().workOrders.filter((order) => order.vendorId === vendor.id)
    const table = await screen.findByRole('table', { name: /work orders/i })
    expect(bodyRows(table).length).toBeGreaterThan(0)
    const request = db().serviceRequests.find((entry) => entry.id === orders[0]?.requestId)
    if (request) expect(screen.getAllByRole('link', { name: request.title }).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('tab', { name: 'Activity' }))
    expect(router.state.location.search).toBe('?tab=activity')
    expect(await screen.findByText(/Profile changes and job milestones/)).toBeInTheDocument()
  })

  it('says “Not enough data” for a vendor without jobs', async () => {
    await openDetail(vendorIdFor('Northstar Painting Co.'))
    expect(screen.getAllByText('Not enough data').length).toBeGreaterThanOrEqual(4)
    expect(screen.queryByText('0%')).not.toBeInTheDocument()
  })

  it('deactivates after showing the affected work orders', async () => {
    const vendor = busyVendor()
    const jobs = openJobsFor(vendor.id)
    const { user } = await openDetail(vendor.id)
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('dialog', { name: `Deactivate ${vendor.name}?` })
    expect(within(within(dialog).getByRole('list', { name: 'Open work orders' })).getAllByRole('listitem')).toHaveLength(jobs.length)
    await user.type(within(dialog).getByLabelText(/^Reason/), 'Contract ended')
    await user.click(within(dialog).getByRole('button', { name: new RegExp(`^Deactivate with ${jobs.length} open`) }))
    expect(await screen.findByText(/can’t be assigned to new work orders/)).toBeInTheDocument()
    const updated = db().vendors.find((entry) => entry.id === vendor.id)
    expect(updated?.active).toBe(false)
    expect(db().vendorEvents.some((event) => event.vendorId === vendor.id && event.kind === 'deactivated' && event.description.includes('Contract ended'))).toBe(true)

    // Reactivate from the inline alert.
    await user.click(screen.getAllByRole('button', { name: 'Reactivate' })[0] as HTMLElement)
    await user.click(within(await screen.findByRole('dialog', { name: `Reactivate ${vendor.name}?` })).getByRole('button', { name: 'Reactivate vendor' }))
    await waitFor(() => expect(db().vendors.find((entry) => entry.id === vendor.id)?.active).toBe(true))
    const kinds = db().vendorEvents.filter((event) => event.vendorId === vendor.id).map((event) => event.kind)
    expect(kinds).toEqual(expect.arrayContaining(['deactivated', 'reactivated']))
  })

  it('explains why a vendor with history can’t be deleted', async () => {
    const vendor = busyVendor()
    const { user } = await openDetail(vendor.id)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete vendor' }))
    const dialog = await screen.findByRole('dialog', { name: `${vendor.name} can’t be deleted` })
    expect(dialog).toHaveTextContent('must keep pointing to this vendor')
    expect(within(dialog).queryByRole('button', { name: 'Delete permanently' })).not.toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Deactivate instead' })).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Got it' }))
    expect(db().vendors.some((entry) => entry.id === vendor.id)).toBe(true)
  })

  it('deletes a vendor that was never assigned', async () => {
    const id = vendorIdFor('Northstar Painting Co.')
    const { user, router } = await openDetail(id)
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete vendor' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Northstar Painting Co.?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }))
    await screen.findByRole('heading', { level: 1, name: 'Vendors' })
    expect(router.state.location.pathname).toBe('/vendors')
    expect(db().vendors.some((entry) => entry.id === id)).toBe(false)
  })

  it('shows a not-found state for an unknown vendor', async () => {
    renderApp('/vendors/ven_missing')
    expect(await screen.findByRole('heading', { name: /vendor not found/i })).toBeInTheDocument()
  })
})
