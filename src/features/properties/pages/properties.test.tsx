import { screen, waitFor, within } from '@testing-library/react'

import { createProperty } from '@/data/services'
import { readDatabase } from '@/data/store/demo-store'
import { renderApp } from '@/test/render-app'
import { type PropertyInput } from '@/types'

const listTable = () => screen.getByRole('table', { name: /^properties/i })
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)

async function openList(path = '/properties') {
  const app = renderApp(path)
  await screen.findByRole('heading', { level: 1, name: 'Properties' })
  return app
}

async function chooseOption(user: ReturnType<typeof renderApp>['user'], comboboxName: string | RegExp, option: string) {
  await user.click(screen.getByRole('combobox', { name: comboboxName }))
  await user.click(await screen.findByRole('option', { name: option }))
}

const NEW_PROPERTY: PropertyInput = {
  name: 'Juniper Commons',
  type: 'residential',
  status: 'lease-up',
  street: '18 Juniper Way',
  city: 'Boise',
  state: 'ID',
  postalCode: '83702',
  totalUnits: 3,
  description: 'Test property',
  yearBuilt: 2025,
  areaSqft: null,
}

describe('Properties listing', () => {
  it('lists, sorts and paginates properties', async () => {
    const { user } = await openList()
    const table = listTable()
    expect(bodyRows(table)).toHaveLength(8)
    expect(screen.getAllByText('Showing 1–8 of 12 properties').length).toBeGreaterThan(0)
    expect(within(bodyRows(table)[0] as HTMLElement).getByText('Bayfront Medical Plaza')).toBeInTheDocument()

    await user.click(within(table).getByRole('button', { name: 'Revenue / mo' }))
    expect(within(table).getByRole('columnheader', { name: /revenue/i })).toHaveAttribute('aria-sort', 'descending')
    expect(within(bodyRows(table)[0] as HTMLElement).getByText('Harbor View Residences')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page of properties' }))
    expect(bodyRows(table)).toHaveLength(4)
  })

  it('searches by name, city and street address', async () => {
    const { user } = await openList()
    const search = screen.getByRole('searchbox', { name: 'Search properties' })

    await user.type(search, 'pittsburgh')
    expect(bodyRows(listTable())).toHaveLength(1)
    expect(within(listTable()).getByText('Ironworks Commons')).toBeInTheDocument()

    await user.clear(search)
    await user.type(search, 'Harbor View Blvd')
    expect(within(listTable()).getByText('Harbor View Residences')).toBeInTheDocument()
    expect(bodyRows(listTable())).toHaveLength(1)
  })

  it('filters by type and status, keeps filters in the URL and clears them', async () => {
    const { user, router } = await openList()
    await user.click(screen.getByRole('radio', { name: 'Commercial' }))
    expect(bodyRows(listTable())).toHaveLength(5)

    await chooseOption(user, 'Filter by status', 'Lease-up')
    expect(bodyRows(listTable())).toHaveLength(1)
    expect(within(listTable()).getByText('Ironworks Commons')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?type=commercial&status=lease-up')

    await user.click(screen.getAllByRole('button', { name: 'Clear filters' })[0] as HTMLElement)
    expect(bodyRows(listTable())).toHaveLength(8)
    expect(router.state.location.search).toBe('')
  })

  it('shows an empty state with a clear action', async () => {
    const { user } = await openList('/properties?q=atlantis')
    expect(within(listTable()).getByText('No properties match your filters')).toBeInTheDocument()
    await user.click(within(listTable()).getByRole('button', { name: 'Clear filters' }))
    expect(bodyRows(listTable())).toHaveLength(8)
  })

  it('opens property actions', async () => {
    const { user, router } = await openList()
    await user.click(within(listTable()).getByRole('button', { name: 'Actions for Maple Court Apartments' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Edit property' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit property' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/properties/prop_101/edit')
  })
})

describe('Add and edit property', () => {
  it('validates required fields and creates a property', async () => {
    const { user, router } = renderApp('/properties/new')
    await screen.findByRole('heading', { level: 1, name: 'Add property' })

    await user.click(screen.getByRole('button', { name: 'Add property' }))
    expect(await screen.findByText(/please fix 6 fields/i)).toBeInTheDocument()
    expect(screen.getByText('Enter a property name of at least 2 characters')).toBeInTheDocument()
    expect(screen.getByText('Choose a state')).toBeInTheDocument()
    expect(screen.getByText('Enter the total number of units')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /property name/i })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: /property name/i })).toHaveAttribute('aria-invalid', 'true')

    await user.type(screen.getByRole('textbox', { name: /property name/i }), 'Juniper Commons')
    await user.click(screen.getByRole('radio', { name: /commercial/i }))
    await user.type(screen.getByRole('textbox', { name: /street address/i }), '18 Juniper Way')
    await user.type(screen.getByRole('textbox', { name: /city/i }), 'Boise')
    await chooseOption(user, /state/i, 'Idaho')
    await user.type(screen.getByRole('textbox', { name: /zip code/i }), '8370')
    await user.type(screen.getByRole('spinbutton', { name: /total units/i }), '12')
    await user.click(screen.getByRole('button', { name: 'Add property' }))
    expect(await screen.findByText('Enter a 5-digit ZIP code')).toBeInTheDocument()

    await user.type(screen.getByRole('textbox', { name: /zip code/i }), '2')
    await user.click(screen.getByRole('button', { name: 'Add property' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Juniper Commons' })).toBeInTheDocument()
    expect(router.state.location.search).toBe('?tab=units')
    expect(screen.getByText('Property added')).toBeInTheDocument()
    expect(screen.getByText('No units yet')).toBeInTheDocument()
    expect(screen.getByText('18 Juniper Way, Boise, ID 83702')).toBeInTheDocument()
  })

  it('prefills the edit form and blocks total units below existing units', async () => {
    const { user } = renderApp('/properties/prop_105/edit')
    const name = await screen.findByRole('textbox', { name: /property name/i })
    expect(name).toHaveValue('Riverside Lofts')
    const total = screen.getByRole('spinbutton', { name: /total units/i })
    expect(total).toHaveValue(52)

    await user.clear(total)
    await user.type(total, '40')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    expect(await screen.findByText(/already has 52 units/i)).toBeInTheDocument()

    await user.clear(total)
    await user.type(total, '56')
    await user.clear(name)
    await user.type(name, 'Riverside Lofts North')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Riverside Lofts North' })).toBeInTheDocument()
    expect(screen.getByText('Changes saved')).toBeInTheDocument()
    expect(screen.getByText('52 added · 4 still to add')).toBeInTheDocument()
  })
})

describe('Property details and units', () => {
  it('shows overview, units and activity tabs', async () => {
    const { user, router } = renderApp('/properties/prop_102')
    expect(await screen.findByRole('heading', { level: 1, name: 'Harbor View Residences' })).toBeInTheDocument()
    expect(screen.getByText('Property information')).toBeInTheDocument()
    expect(screen.getByText('Waterfront mid-rise with bay views, a rooftop lounge, concierge services and EV charging.')).toBeInTheDocument()
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByRole('link', { name: 'Properties' })).toHaveAttribute('href', '/properties')
    expect(within(breadcrumb).getByText('Harbor View Residences')).toHaveAttribute('aria-current', 'page')

    await user.click(screen.getByRole('tab', { name: /units/i }))
    expect(router.state.location.search).toBe('?tab=units')
    const units = screen.getByRole('table', { name: /units at harbor view/i })
    expect(screen.getAllByText('Showing 1–10 of 64 units').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('radio', { name: 'Vacant (3)' }))
    expect(bodyRows(units)).toHaveLength(3)
    await user.click(screen.getByRole('radio', { name: 'All (64)' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search units' }), 'Noah Walsh')
    expect(bodyRows(units)).toHaveLength(1)

    await user.click(screen.getByRole('tab', { name: 'Activity' }))
    expect(screen.getByText('Rent payment received')).toBeInTheDocument()
  })

  it('adds and edits units with validation', async () => {
    const property = await createProperty(NEW_PROPERTY)
    const { user } = renderApp(`/properties/${property.id}?tab=units`)
    await screen.findByRole('heading', { level: 1, name: 'Juniper Commons' })

    await user.click(screen.getByRole('button', { name: 'Add first unit' }))
    const dialog = await screen.findByRole('dialog', { name: 'Add unit' })
    // Occupancy comes from leases, so a new unit can only be vacant or under maintenance.
    expect(within(dialog).queryByRole('radio', { name: 'Occupied' })).not.toBeInTheDocument()
    expect(within(dialog).getByText('Tenants and occupancy are managed in the Tenants module.')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add unit' }))
    expect(await within(dialog).findByText('Enter a unit number')).toBeInTheDocument()

    await user.type(within(dialog).getByRole('textbox', { name: /unit number/i }), '101')
    await user.type(within(dialog).getByRole('spinbutton', { name: /size/i }), '720')
    await user.type(within(dialog).getByRole('spinbutton', { name: /asking rent/i }), '1850')
    await user.click(within(dialog).getByRole('button', { name: 'Add unit' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(await screen.findByText('Unit added')).toBeInTheDocument()

    const units = await screen.findByRole('table', { name: /units at juniper commons/i })
    expect(within(units).getByText('Unit 101')).toBeInTheDocument()
    expect(screen.getByText('1 of 3 units added · 2 remaining')).toBeInTheDocument()

    // A second unit with the same number is rejected by the service.
    await user.click(screen.getAllByRole('button', { name: 'Add unit' })[0] as HTMLElement)
    const second = await screen.findByRole('dialog', { name: 'Add unit' })
    await user.type(within(second).getByRole('textbox', { name: /unit number/i }), '101')
    await user.type(within(second).getByRole('spinbutton', { name: /size/i }), '700')
    await user.type(within(second).getByRole('spinbutton', { name: /asking rent/i }), '1700')
    await user.click(within(second).getByRole('button', { name: 'Add unit' }))
    expect(await within(second).findByText('Unit 101 already exists in this property.')).toBeInTheDocument()
    await user.click(within(second).getByRole('button', { name: 'Cancel' }))

    // A vacant unit links to tenant assignment and can go under maintenance.
    await user.click(within(units).getByRole('button', { name: 'Edit Unit 101' }))
    const edit = await screen.findByRole('dialog', { name: 'Edit Unit 101' })
    const unitId = readDatabase().units.find((unit) => unit.propertyId === property.id)?.id ?? ''
    expect(within(edit).getByRole('link', { name: 'Assign a tenant' })).toHaveAttribute(
      'href',
      `/tenants/new?propertyId=${property.id}&unitId=${unitId}`,
    )
    await user.click(within(edit).getByRole('radio', { name: 'Under maintenance' }))
    await user.click(within(edit).getByRole('button', { name: 'Save unit' }))
    expect(await screen.findByText('Unit updated')).toBeInTheDocument()
    await waitFor(() => expect(within(units).getByText('Under maintenance')).toBeInTheDocument())
  })

  it('locks status and rent for a leased unit and links to the tenant', async () => {
    const db = readDatabase()
    const lease = db.leases.find((entry) => entry.status === 'active' && entry.propertyId === 'prop_102')
    const unit = db.units.find((entry) => entry.id === lease?.unitId)
    const tenant = db.tenants.find((entry) => entry.id === lease?.tenantId)
    const { user } = renderApp('/properties/prop_102?tab=units')
    const table = await screen.findByRole('table', { name: /units at/i })
    const search = screen.getByRole('searchbox', { name: 'Search units' })
    await user.type(search, unit?.number ?? '')

    await user.click(await within(table).findByRole('button', { name: `Edit Unit ${unit?.number}` }))
    const dialog = await screen.findByRole('dialog', { name: `Edit Unit ${unit?.number}` })
    expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument()
    expect(within(dialog).getByRole('link', { name: tenant?.name })).toHaveAttribute('href', `/tenants/${tenant?.id}`)
    expect(within(dialog).getByRole('spinbutton', { name: /monthly rent|asking rent/i })).toHaveAttribute('readonly')
  })

  it('shows a not-found page for unknown properties', async () => {
    renderApp('/properties/prop_missing')
    expect(await screen.findByRole('heading', { level: 1, name: 'Property not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to properties' })).toHaveAttribute('href', '/properties')
  })
})
