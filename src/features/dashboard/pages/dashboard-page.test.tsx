import { screen, waitFor, within } from '@testing-library/react'

import { renderApp } from '@/test/render-app'

const kpi = (label: string) => {
  const region = screen.getByRole('region', { name: 'Key metrics' })
  const card = within(region).getByText(label).closest('[data-slot="card"]')
  if (!(card instanceof HTMLElement)) throw new Error(`KPI "${label}" not found`)
  return within(card)
}

async function renderDashboard(path = '/dashboard') {
  const app = renderApp(path)
  await screen.findByRole('heading', { level: 1, name: 'Overview' })
  return app
}

const propertyTable = () => screen.getByRole('table', { name: /property performance/i })
const bodyRows = (table: HTMLElement) => within(table).getAllByRole('row').slice(1)

describe('Dashboard overview', () => {
  it('renders KPIs from sample data', async () => {
    await renderDashboard()
    expect(kpi('Total properties').getByText('12')).toBeInTheDocument()
    expect(kpi('Total units').getByText('374')).toBeInTheDocument()
    expect(kpi('Occupancy rate').getByText('90.9%')).toBeInTheDocument()
    expect(kpi('Monthly revenue').getByText('$1,038,710')).toBeInTheDocument()
    expect(screen.getByText('Sample data', { exact: false })).toBeInTheDocument()
  })

  it('filters every section by property type and keeps it in the URL', async () => {
    const { user, router } = await renderDashboard()
    await user.click(screen.getByRole('radio', { name: 'Commercial' }))

    expect(kpi('Total properties').getByText('5')).toBeInTheDocument()
    expect(kpi('Total units').getByText('80')).toBeInTheDocument()
    expect(router.state.location.search).toBe('?type=commercial')
    expect(bodyRows(propertyTable())).toHaveLength(5)
    expect(within(propertyTable()).queryByText('Harbor View Residences')).not.toBeInTheDocument()
  })

  it('restores filters from the URL and updates comparisons for the date range', async () => {
    const { user } = await renderDashboard('/dashboard?range=3m&type=residential')
    expect(kpi('Total properties').getByText('7')).toBeInTheDocument()
    expect(kpi('Occupancy rate').getByText('vs 3 months ago')).toBeInTheDocument()

    await user.click(screen.getByRole('combobox', { name: 'Date range' }))
    await user.click(await screen.findByRole('option', { name: 'Last 6 months' }))
    expect(kpi('Occupancy rate').getByText('vs 6 months ago')).toBeInTheDocument()
    expect(screen.getByText('Total, last 6 months')).toBeInTheDocument()
  })

  it('searches, sorts and paginates the property table', async () => {
    const { user } = await renderDashboard()
    const table = propertyTable()
    expect(bodyRows(table)).toHaveLength(6)
    expect(screen.getAllByText('Showing 1–6 of 12 properties').length).toBeGreaterThan(0)

    // Default sort: revenue, highest first.
    expect(within(bodyRows(table)[0] as HTMLElement).getByText('Harbor View Residences')).toBeInTheDocument()

    // Numeric columns sort highest first, then lowest first.
    await user.click(within(table).getByRole('button', { name: 'Units' }))
    const header = within(table).getByRole('columnheader', { name: /units/i })
    expect(header).toHaveAttribute('aria-sort', 'descending')
    expect(within(bodyRows(table)[0] as HTMLElement).getByText('Harbor View Residences')).toBeInTheDocument()
    await user.click(within(table).getByRole('button', { name: 'Units' }))
    expect(header).toHaveAttribute('aria-sort', 'ascending')
    expect(within(bodyRows(table)[0] as HTMLElement).getByText('Bayfront Medical Plaza')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Next page of properties' }))
    expect(screen.getAllByText('Showing 7–12 of 12 properties').length).toBeGreaterThan(0)

    await user.type(screen.getByRole('searchbox', { name: 'Search properties' }), 'austin')
    expect(bodyRows(table)).toHaveLength(1)
    expect(within(table).getByText('Maple Court Apartments')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: 'Search properties' }))
    await user.type(screen.getByRole('searchbox', { name: 'Search properties' }), 'no such place')
    expect(within(table).getByText('No properties match your filters')).toBeInTheDocument()
    await user.click(within(table).getByRole('button', { name: 'Clear filters' }))
    expect(bodyRows(table)).toHaveLength(6)
  })

  it('filters maintenance requests from the status tiles', async () => {
    const { user } = await renderDashboard()
    const table = screen.getByRole('table', { name: /maintenance requests/i })
    const urgent = screen.getByRole('button', { name: '2 urgent' })

    await user.click(urgent)
    expect(urgent).toHaveAttribute('aria-pressed', 'true')
    expect(bodyRows(table)).toHaveLength(2)
    expect(within(table).getAllByText('Urgent')).toHaveLength(2)

    await user.click(screen.getByRole('button', { name: /clear “urgent” filter/i }))
    expect(bodyRows(table)).toHaveLength(5)
  })

  it('shows upcoming payments and recent activity', async () => {
    await renderDashboard()
    expect(screen.getByText('Marcus Chen')).toBeInTheDocument()
    expect(screen.getAllByText('Overdue').length).toBeGreaterThan(0)
    expect(screen.getByText('Maintenance request created')).toBeInTheDocument()
  })

  it('refreshes data and confirms with a toast', async () => {
    const { user } = await renderDashboard()
    await user.click(screen.getByRole('button', { name: 'Refresh data' }))
    await waitFor(() => expect(screen.getByText('Dashboard refreshed')).toBeInTheDocument())
  })
})
