import { screen, waitFor, within } from '@testing-library/react'

import { readDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

/** Phase 10.4: the Staff directory, roles, member pages, forms and their guards. */

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const table = () => screen.getByRole('table', { name: /Staff members/ })
const names = () => within(table()).getAllByRole('link').map((link) => link.textContent)

describe('Staff directory', () => {
  it('lists the active team with you first-marked, metrics, and saves nothing', async () => {
    renderApp('/staff')
    await h1('Staff')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(names()).toEqual(['Alex Morgan', 'Daniel Brooks', 'Ethan Wright', 'Hannah Lee', 'Jordan Patel', 'Maria Chen', 'Nadia Okafor', 'Sofia Alvarez'])
    expect(within(table()).getByText('You')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Staff metrics' })).toHaveTextContent(/Team members9/)
    expect(stored()).toBeNull()
    expect(document.title).toBe('Staff · Propwise')
  })

  it('filters by status, role, property and search, kept in the URL', async () => {
    const { user, router } = renderApp('/staff?status=all&role=maintenance')
    await h1('Staff')
    expect(names()).toEqual(['Marcus Reed', 'Sofia Alvarez'])
    await user.click(screen.getByRole('combobox', { name: 'Filter by property' }))
    await user.click(await screen.findByRole('option', { name: 'Summit Business Park' }))
    await waitFor(() => expect(names()).toEqual(['Marcus Reed']))
    expect(router.state.location.search).toBe('?status=all&role=maintenance&property=prop_202')
    await user.click(screen.getByRole('button', { name: 'Reset filters' }))
    await waitFor(() => expect(router.state.location.search).toBe(''))
    await user.type(screen.getByRole('searchbox', { name: 'Search staff' }), 'okafor')
    await waitFor(() => expect(names()).toEqual(['Nadia Okafor']))
  })

  it('shows the read-only role matrix with the demo notice', async () => {
    renderApp('/staff?tab=roles')
    await h1('Staff')
    const matrix = await screen.findByRole('table', { name: 'Access by role' })
    expect(within(matrix).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Area', 'Owner', 'Admin', 'Property manager', 'Maintenance coordinator', 'Leasing agent', 'Accountant'])
    expect(screen.getByText(/Access isn’t enforced in this demo/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull()
  })
})

describe('Staff member pages', () => {
  it('adds a member, refusing a duplicate email first', async () => {
    const { user, router } = renderApp('/staff/new')
    await h1('Add staff member')
    await user.type(screen.getByLabelText(/Full name/), 'Sam Rivera')
    await user.type(screen.getByLabelText(/Job title/), 'Leasing Agent')
    await user.type(screen.getByLabelText(/^Email/), 'Maria.Chen@example.com')
    await user.tab()
    expect(await screen.findByText(/This email address is already used by/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Add staff member' }))
    expect(await screen.findByText('Maria Chen already uses this email address.')).toBeInTheDocument()
    expect(stored()).toBeNull()

    await user.clear(screen.getByLabelText(/^Email/))
    await user.type(screen.getByLabelText(/^Email/), 'sam.rivera@example.com')
    await user.click(screen.getByRole('combobox', { name: /Role/ }))
    await user.click(await screen.findByRole('option', { name: 'Leasing agent' }))
    await user.click(screen.getByRole('checkbox', { name: /Willow Residences/ }))
    await user.click(screen.getByRole('button', { name: 'Add staff member' }))
    expect(await h1('Sam Rivera')).toBeInTheDocument()
    expect(router.state.location.pathname).toMatch(/^\/staff\/stf_/)
    expect(readDatabase().staff.find((member) => member.name === 'Sam Rivera')).toMatchObject({ role: 'leasing', propertyIds: ['prop_103'], demo: false })
  })

  it('shows field errors and saves nothing while the form is invalid', async () => {
    const { user } = renderApp('/staff/new')
    await h1('Add staff member')
    await user.click(screen.getByRole('button', { name: 'Add staff member' }))
    expect(await screen.findByText('Enter the person’s name.')).toBeInTheDocument()
    expect(screen.getByText('Enter an email address.')).toBeInTheDocument()
    expect(screen.getByText('Enter the job title.')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent(/Please fix 3 fields/)
    expect(stored()).toBeNull()
  })

  it('opens a member with overview, properties and activity; deactivates and reactivates', async () => {
    const { user } = renderApp('/staff/stf_1003')
    await h1('Maria Chen')
    expect(document.title).toBe('Maria Chen · Propwise')
    await user.click(screen.getByRole('tab', { name: /Properties/ }))
    const list = await screen.findByRole('list', { name: 'Assigned properties' })
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual(['/properties/prop_101', '/properties/prop_102', '/properties/prop_103', '/properties/prop_104'])
    await user.click(screen.getByRole('button', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate Maria Chen?' })
    await user.type(within(dialog).getByLabelText('Reason'), 'Moved abroad')
    await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }))
    expect(await screen.findByText(/^Inactive since/)).toBeInTheDocument()
    expect(readDatabase().staff.find((member) => member.id === 'stf_1003')?.active).toBe(false)
    await user.click(screen.getAllByRole('button', { name: 'Reactivate' })[0] as HTMLElement)
    const again = await screen.findByRole('dialog', { name: 'Reactivate Maria Chen?' })
    await user.click(within(again).getByRole('button', { name: 'Reactivate' }))
    await waitFor(() => expect(readDatabase().staff.find((member) => member.id === 'stf_1003')?.active).toBe(true))
    await user.click(screen.getByRole('tab', { name: 'Activity' }))
    expect(await screen.findByText('Moved abroad')).toBeInTheDocument()
  })

  it('your own record: no deactivate or delete, role locked, edits update the header', async () => {
    const { user } = renderApp('/staff/stf_1001')
    await h1('Alex Morgan')
    expect(screen.getByText('This is you')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Deactivate' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'More actions' })).toBeNull()
    await user.click(screen.getByRole('link', { name: 'Edit' }))
    await h1('Edit your staff details')
    expect(screen.getByRole('combobox', { name: /Role/ })).toBeDisabled()
    expect(screen.getByText(/You can’t change your own role/)).toBeInTheDocument()
    await user.clear(screen.getByLabelText(/Job title/))
    await user.type(screen.getByLabelText(/Job title/), 'Managing Director')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await h1('Alex Morgan')
    expect(await screen.findByText('Managing Director', { selector: 'header span' })).toBeInTheDocument()
    expect(readDatabase().account.profile.jobTitle).toBe('Managing Director')
  })

  it('deletes a member after confirming', async () => {
    const { user, router } = renderApp('/staff/stf_1008')
    await h1('Hannah Lee')
    await user.click(screen.getByRole('button', { name: 'More actions' }))
    await user.click(await screen.findByRole('menuitem', { name: 'Delete staff member' }))
    const dialog = await screen.findByRole('dialog', { name: 'Delete Hannah Lee?' })
    await user.click(within(dialog).getByRole('button', { name: 'Delete permanently' }))
    await h1('Staff')
    expect(router.state.location.pathname).toBe('/staff')
    expect(readDatabase().staff.some((member) => member.id === 'stf_1008')).toBe(false)
  })

  it('shows a not-found state for an unknown member', async () => {
    renderApp('/staff/stf_nope')
    expect(await screen.findByText(/This staff member doesn’t exist/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to staff' })).toHaveAttribute('href', '/staff')
  })
})
