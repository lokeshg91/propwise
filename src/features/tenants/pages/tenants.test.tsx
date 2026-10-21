import { screen, waitFor, within } from '@testing-library/react'

import { getLeaseDisplayStatus, isCurrentLease } from '@/data/domain/lease-rules'
import { readDatabase } from '@/data/store/demo-store'
import { renderApp } from '@/test/render-app'
import { type Lease } from '@/types'

const listTable = () => screen.getByRole('table', { name: /^tenants/i })
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)

async function openList(path = '/tenants') {
  const app = renderApp(path)
  await screen.findByRole('heading', { level: 1, name: 'Tenants' })
  return app
}

async function chooseOption(user: ReturnType<typeof renderApp>['user'], comboboxName: string | RegExp, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }))
  await user.click(await screen.findByRole('option', { name: option }))
}

/** A vacant unit with no active or pending lease. */
function freeUnit() {
  const db = readDatabase()
  const unit = db.units.find(
    (entry) => entry.status === 'vacant' && !db.leases.some((lease) => lease.unitId === entry.id && isCurrentLease(lease)),
  )
  if (!unit) throw new Error('No free unit')
  return unit
}

const leaseWhere = (predicate: (lease: Lease) => boolean) => readDatabase().leases.find(predicate) as Lease
const tenantOf = (lease: Lease) => readDatabase().tenants.find((tenant) => tenant.id === lease.tenantId)

describe('Tenants listing', () => {
  it('shows metrics and filters by tenant and lease status via the URL', async () => {
    const { user, router } = await openList()
    const metrics = screen.getByRole('region', { name: 'Tenant metrics' })
    expect(within(metrics).getByText('340')).toBeInTheDocument()
    expect(within(metrics).getByText('3 in holdover past lease end')).toBeInTheDocument()
    expect(screen.getAllByText('Showing 1–10 of 371 tenants').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('radio', { name: 'Pending (6)' }))
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(6))
    expect(router.state.location.search).toBe('?status=pending')

    await user.click(screen.getByRole('radio', { name: 'All (371)' }))
    await chooseOption(user, 'Filter by lease status', 'Holdover')
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(3))
    expect(router.state.location.search).toBe('?lease=holdover')
    expect(within(listTable()).getAllByText(/not moved out/).length).toBe(3)
  })

  it('searches by name, email, phone and property, with a no-results state', async () => {
    const tenant = readDatabase().tenants.find((entry) => entry.id.startsWith('ten_u_')) ?? readDatabase().tenants[0]
    const { user } = await openList()
    const search = screen.getByRole('searchbox', { name: 'Search tenants' })

    await user.click(search)
    await user.paste(tenant?.email ?? '')
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(1))
    expect(within(listTable()).getByText(tenant?.name ?? '')).toBeInTheDocument()

    await user.clear(search)
    await user.paste('zzz-no-match')
    expect((await screen.findAllByText('No tenants match your filters')).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement)
    await waitFor(() => expect(bodyRows(listTable())).toHaveLength(10))
  })
})

describe('Adding and editing tenants', () => {
  it('validates and creates a tenant on a preselected unit, occupying it', async () => {
    const unit = freeUnit()
    const { user, router } = renderApp(`/tenants/new?propertyId=${unit.propertyId}&unitId=${unit.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Add tenant' })

    // Rent and deposit are prefilled from the unit's asking rent.
    expect(screen.getByRole('spinbutton', { name: /monthly rent/i })).toHaveValue(unit.rent)

    await user.click(screen.getByRole('button', { name: 'Add tenant' }))
    expect(await screen.findByText(/Please fix \d+ fields before saving/)).toBeInTheDocument()
    expect(screen.getByText('Enter the tenant’s name')).toBeInTheDocument()
    expect(screen.getByText('Enter an email address')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Rowan Pierce')
    await user.type(screen.getByRole('textbox', { name: /email/i }), 'rowan.pierce@example.com')
    await user.type(screen.getByRole('textbox', { name: /^phone/i }), '(512) 555-0199')
    await user.type(screen.getByRole('textbox', { name: /street address/i }), '1 Test St')
    await user.type(screen.getByRole('textbox', { name: /city/i }), 'Austin')
    await chooseOption(user, /state/i, 'Texas')
    await user.type(screen.getByRole('textbox', { name: /zip/i }), '78701')
    await user.click(screen.getByRole('button', { name: 'Add tenant' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Rowan Pierce' })).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/tenants\/ten_/)
    expect(readDatabase().units.find((entry) => entry.id === unit.id)).toMatchObject({ status: 'occupied', tenantName: 'Rowan Pierce' })
  })

  it('shows a service conflict on the email field', async () => {
    const existing = readDatabase().tenants[0]
    const unit = freeUnit()
    const { user } = renderApp(`/tenants/new?propertyId=${unit.propertyId}&unitId=${unit.id}`)
    await screen.findByRole('heading', { level: 1, name: 'Add tenant' })
    await user.type(screen.getByRole('textbox', { name: /full name/i }), 'Duplicate Email')
    await user.type(screen.getByRole('textbox', { name: /email/i }), existing?.email ?? '')
    await user.type(screen.getByRole('textbox', { name: /^phone/i }), '(512) 555-0199')
    await user.type(screen.getByRole('textbox', { name: /street address/i }), '1 Test St')
    await user.type(screen.getByRole('textbox', { name: /city/i }), 'Austin')
    await chooseOption(user, /state/i, 'Texas')
    await user.type(screen.getByRole('textbox', { name: /zip/i }), '78701')
    await user.click(screen.getByRole('button', { name: 'Add tenant' }))
    expect(await screen.findByText('Another tenant already uses this email address.')).toBeInTheDocument()
  })

  it('keeps Save disabled until something changes, then saves', async () => {
    const lease = leaseWhere((entry) => entry.status === 'active' && getLeaseDisplayStatus(entry) === 'active')
    const tenant = tenantOf(lease)
    const { user } = renderApp(`/tenants/${tenant?.id}/edit`)
    await screen.findByRole('heading', { level: 1, name: 'Edit tenant' })
    const save = screen.getByRole('button', { name: 'Save changes' })
    expect(save).toBeDisabled()
    // A moved-in tenant can't go back to a future move-in.
    expect(screen.getByRole('radio', { name: /future move-in/i })).toBeDisabled()

    const phone = screen.getByRole('textbox', { name: /^phone/i })
    await user.clear(phone)
    await user.type(phone, '(512) 555-0111')
    expect(save).toBeEnabled()
    await user.click(save)
    expect(await screen.findByText('Changes saved')).toBeInTheDocument()
    expect(readDatabase().tenants.find((entry) => entry.id === tenant?.id)?.phone).toBe('(512) 555-0111')
  })
})

describe('Tenant details and lease management', () => {
  it('ends an active lease and releases the unit', async () => {
    const lease = leaseWhere((entry) => entry.status === 'active' && getLeaseDisplayStatus(entry) === 'active')
    const tenant = tenantOf(lease)
    const { user } = renderApp(`/tenants/${tenant?.id}?tab=lease`)
    await screen.findByRole('heading', { level: 1, name: tenant?.name })

    await user.click(screen.getByRole('button', { name: 'End lease' }))
    const dialog = await screen.findByRole('dialog', { name: 'End lease' })
    expect(within(dialog).getByText(/recorded as terminated early/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'End lease' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText(`${tenant?.name} has no active or pending lease.`)).toBeInTheDocument()
    expect(readDatabase().units.find((unit) => unit.id === lease.unitId)?.status).toBe('vacant')
    expect(readDatabase().leases.find((entry) => entry.id === lease.id)?.status).toBe('terminated')
  })

  it('explains holdover and keeps the unit occupied', async () => {
    const lease = leaseWhere((entry) => getLeaseDisplayStatus(entry) === 'holdover')
    const tenant = tenantOf(lease)
    renderApp(`/tenants/${tenant?.id}`)
    await screen.findByRole('heading', { level: 1, name: tenant?.name })
    expect(screen.getAllByText('Holdover').length).toBeGreaterThan(0)
    expect(screen.getByText(/— not moved out/)).toBeInTheDocument()
    expect(readDatabase().units.find((unit) => unit.id === lease.unitId)?.status).toBe('occupied')
  })

  it('marks a due pending tenant as moved in', async () => {
    const lease = leaseWhere((entry) => getLeaseDisplayStatus(entry) === 'move-in-due')
    const tenant = tenantOf(lease)
    const { user } = renderApp(`/tenants/${tenant?.id}?tab=lease`)
    await screen.findByRole('heading', { level: 1, name: tenant?.name })

    await user.click(screen.getByRole('button', { name: 'Mark as moved in' }))
    const dialog = await screen.findByRole('dialog', { name: 'Mark as moved in' })
    await user.click(within(dialog).getByRole('button', { name: 'Mark as moved in' }))
    expect(await screen.findByText('Tenant moved in')).toBeInTheDocument()
    expect(readDatabase().units.find((unit) => unit.id === lease.unitId)).toMatchObject({ status: 'occupied', tenantName: tenant?.name })
  })

  it('cancels a future pending lease without occupying the unit', async () => {
    const lease = leaseWhere((entry) => getLeaseDisplayStatus(entry) === 'pending')
    const tenant = tenantOf(lease)
    const { user } = renderApp(`/tenants/${tenant?.id}?tab=lease`)
    await screen.findByRole('heading', { level: 1, name: tenant?.name })
    expect(screen.getByRole('button', { name: 'Mark as moved in' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Cancel lease' }))
    const dialog = await screen.findByRole('dialog', { name: 'Cancel pending lease' })
    await user.click(within(dialog).getByRole('button', { name: 'Cancel lease' }))
    expect(await screen.findByText('Pending lease cancelled')).toBeInTheDocument()
    expect(readDatabase().units.find((unit) => unit.id === lease.unitId)?.status).toBe('vacant')
  })

  it('labels the payment history as demo data', async () => {
    const lease = leaseWhere((entry) => entry.status === 'active')
    const tenant = tenantOf(lease)
    renderApp(`/tenants/${tenant?.id}?tab=payments`)
    expect(await screen.findByText('Demo data')).toBeInTheDocument()
    expect(screen.getByText(/Generated sample records\. Propwise doesn’t process payments/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /rent charges/i })).toBeInTheDocument()
  })

  it('links the property unit to the tenant profile', async () => {
    const lease = leaseWhere((entry) => entry.status === 'active' && entry.propertyId === 'prop_102')
    const tenant = tenantOf(lease)
    const unit = readDatabase().units.find((entry) => entry.id === lease.unitId)
    const { user } = renderApp('/properties/prop_102?tab=units')
    const table = await screen.findByRole('table', { name: /units at/i })
    await user.type(screen.getByRole('searchbox', { name: 'Search units' }), unit?.number ?? '')
    expect(await within(table).findByRole('link', { name: tenant?.name })).toHaveAttribute('href', `/tenants/${tenant?.id}`)
  })

  it('shows a not-found page for unknown tenants', async () => {
    renderApp('/tenants/ten_missing')
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenant not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to tenants' })).toHaveAttribute('href', '/tenants')
  })
})
