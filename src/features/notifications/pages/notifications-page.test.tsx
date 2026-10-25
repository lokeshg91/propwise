import { screen, waitFor, within } from '@testing-library/react'

import { readDatabase, updateDatabase, type DemoDatabase } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

/** Phase 10.5: the Notifications page, the header menu and the sidebar badge share one saved inbox. */

const h1 = (name: string) => screen.findByRole('heading', { level: 1, name })
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const list = () => screen.getByRole('list', { name: 'Notifications' })
const titles = () => within(list()).getAllByRole('listitem').map((item) => item.querySelector('p span')?.textContent)
const bell = () => screen.getByRole('button', { name: /^Notifications/ })
const badge = () => screen.getByRole('navigation', { name: 'Main navigation' }).querySelector('a[href="/notifications"]')?.textContent

describe('Notifications page', () => {
  it('lists the five sample notifications, three unread, with the same count in the header and sidebar, saving nothing', async () => {
    renderApp('/notifications')
    await h1('Notifications')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(titles()).toEqual(['New work order', 'Rent payment received', 'Lease expiring soon', 'New tenant application', 'Monthly report ready'])
    expect(within(list()).getAllByText('(unread)')).toHaveLength(3)
    expect(bell()).toHaveAccessibleName('Notifications, 3 unread')
    expect(badge()).toMatch(/3/)
    expect(screen.getByText('3 unread')).toBeInTheDocument()
    expect(stored()).toBeNull()
    expect(document.title).toBe('Notifications · Propwise')
  })

  it('filters by read status and type, kept in the URL', async () => {
    const { user, router } = renderApp('/notifications?status=unread')
    await h1('Notifications')
    expect(titles()).toEqual(['New work order', 'Rent payment received', 'Lease expiring soon'])
    await user.click(screen.getByRole('combobox', { name: 'Filter by type' }))
    await user.click(await screen.findByRole('option', { name: 'Leases' }))
    await waitFor(() => expect(titles()).toEqual(['Lease expiring soon']))
    expect(router.state.location.search).toBe('?status=unread&category=lease')
    await user.click(screen.getByRole('radio', { name: /^Read/ }))
    expect(await screen.findByText('No notifications match your filters')).toBeInTheDocument()
  })

  it('marks one read and unread, and all read; header, sidebar and page follow, and it is saved', async () => {
    const { user } = renderApp('/notifications')
    await h1('Notifications')
    await user.click(screen.getByRole('button', { name: 'Mark as read: New work order' }))
    await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications, 2 unread'))
    expect(badge()).toMatch(/2/)
    await user.click(screen.getByRole('button', { name: 'Mark as unread: Monthly report ready' }))
    await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications, 3 unread'))
    expect(readDatabase().notifications.find((item) => item.id === 'ntf_2005')?.read).toBe(false)
    await user.click(screen.getByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(bell()).toHaveAccessibleName('Notifications'))
    expect(badge()).not.toMatch(/\d/)
    expect(readDatabase().notifications.every((item) => item.read)).toBe(true)
    expect(stored()).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Mark all read' })).toBeDisabled()
  })

  it('mark all read in the header menu is saved too', async () => {
    const { user } = renderApp('/notifications')
    await h1('Notifications')
    await user.click(bell())
    await user.click(await screen.findByRole('button', { name: 'Mark all read' }))
    await waitFor(() => expect(readDatabase().notifications.every((item) => item.read)).toBe(true))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(within(list()).queryAllByText('(unread)')).toHaveLength(0))
  })

  it('an event notification links to its record and opening it marks it read', async () => {
    updateDatabase((db) => {
      const request = structuredClone(db.serviceRequests[0] as DemoDatabase['serviceRequests'][number])
      db.serviceRequests.push({ ...request, id: 'MR-9101', title: 'Broken intercom', status: 'open', createdAt: new Date(Date.now() - 60_000).toISOString(), dueAt: new Date(Date.now() + 86_400_000).toISOString() })
    })
    const { user, router } = renderApp('/notifications')
    await h1('Notifications')
    expect(titles()[0]).toBe('New maintenance request')
    expect(bell()).toHaveAccessibleName('Notifications, 4 unread')
    await user.click(screen.getByRole('link', { name: 'Open: New maintenance request' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/maintenance/MR-9101'))
    await waitFor(() => expect(readDatabase().notifications.find((item) => item.id === 'ntf_request-created_MR-9101')?.read).toBe(true))
  })

  it('links to the notification settings on the Account page', async () => {
    renderApp('/notifications')
    await h1('Notifications')
    expect(screen.getByRole('link', { name: 'Notification settings' })).toHaveAttribute('href', '/account')
  })
})
