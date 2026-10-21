import { screen, within } from '@testing-library/react'

import { NAV_ITEMS } from '@/app/routes/navigation'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

describe('Application shell', () => {
  it('renders every navigation item with the active page marked', async () => {
    renderApp('/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })

    for (const item of NAV_ITEMS) {
      expect(within(nav).getByRole('link', { name: new RegExp(`^${item.label}`) })).toHaveAttribute(
        'href',
        item.path,
      )
    }
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page')
  })

  it('navigates between modules and updates the breadcrumb', async () => {
    const { user, router } = renderApp('/dashboard')
    const nav = await screen.findByRole('navigation', { name: 'Main navigation' })

    await user.click(within(nav).getByRole('link', { name: 'Tenants' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Tenants' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/tenants')
    const breadcrumb = screen.getByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByText('Main')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('Tenants')).toHaveAttribute('aria-current', 'page')
  })

  it('shows the not-found page for unknown routes', async () => {
    renderApp('/does-not-exist')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Go to overview' })).toHaveAttribute('href', '/dashboard')
  })

  it('collapses the sidebar and remembers the choice', async () => {
    const { user } = renderApp('/dashboard')
    await user.click(await screen.findByRole('button', { name: 'Collapse sidebar' }))

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute('aria-expanded', 'false')
    expect(window.localStorage.getItem(STORAGE_KEYS.sidebarCollapsed)).toBe('true')

    // Collapsed links keep their accessible name and active styling.
    const nav = screen.getByRole('navigation', { name: 'Main navigation' })
    const overview = within(nav).getByRole('link', { name: 'Overview' })
    expect(overview).toHaveAttribute('aria-current', 'page')
    expect(overview).toHaveClass('bg-sidebar-accent')
    expect(within(nav).getByRole('link', { name: 'Notifications, 3 unread' })).toBeInTheDocument()
  })

  it('opens the mobile drawer and closes it after navigating', async () => {
    const { user, router } = renderApp('/dashboard')
    await user.click(await screen.findByRole('button', { name: 'Open navigation' }))

    const drawer = await screen.findByRole('dialog')
    await user.click(within(drawer).getByRole('link', { name: 'Finance' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Finance' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/finance')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('marks all notifications as read', async () => {
    const { user } = renderApp('/dashboard')
    await user.click(await screen.findByRole('button', { name: 'Notifications, 3 unread' }))
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))

    expect(await screen.findByText('You’re all caught up')).toBeInTheDocument()
  })

  it('changes the theme from the header', async () => {
    const { user } = renderApp('/dashboard')
    await user.click(await screen.findByRole('button', { name: 'Change theme' }))
    await user.click(await screen.findByRole('menuitemradio', { name: 'Dark' }))

    expect(document.documentElement).toHaveClass('dark')
    expect(window.localStorage.getItem(STORAGE_KEYS.theme)).toBe('dark')
  })

  it('searches pages with the keyboard shortcut', async () => {
    const { user, router } = renderApp('/dashboard')
    await screen.findByRole('heading', { level: 1, name: 'Overview' })

    await user.keyboard('{Control>}k{/Control}')
    const input = await screen.findByRole('combobox', { name: 'Search pages' })
    await user.type(input, 'maint{Enter}')

    expect(await screen.findByRole('heading', { level: 1, name: 'Maintenance' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/maintenance')
  })
})
