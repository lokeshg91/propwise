import { screen, within } from '@testing-library/react'

import { POLICY_PAGES, STORAGE_ENTRIES } from '@/features/legal/lib/policies'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

/** Phase 10.1: public policy pages, their navigation and the links to them. */

describe('policy pages', () => {
  it.each(POLICY_PAGES)('$path renders its title, the sample-content notice and the policy navigation', async (page) => {
    renderApp(page.path)
    expect(await screen.findByRole('heading', { level: 1, name: page.title })).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const notice = screen.getByRole('complementary', { name: 'About this document' })
    expect(notice).toHaveTextContent(/Sample content — review and replace before production use/)
    expect(notice).toHaveTextContent(/isn’t legal advice/)
    const policies = screen.getByRole('navigation', { name: 'Policies' })
    for (const other of POLICY_PAGES) expect(within(policies).getByRole('link', { name: other.title })).toHaveAttribute('href', other.path)
    expect(within(policies).getByRole('link', { name: page.title })).toHaveAttribute('aria-current', 'page')
    // Contents links point at sections on the page.
    const contents = screen.getByRole('complementary', { name: 'On this page' })
    for (const link of within(contents).getAllByRole('link')) {
      const id = link.getAttribute('href')?.slice(1) ?? ''
      expect(document.getElementById(id)).not.toBeNull()
    }
    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeInTheDocument()
  })

  it('moves between policies with the policy navigation', async () => {
    const { user } = renderApp('/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })
    await user.click(within(screen.getByRole('navigation', { name: 'Policies' })).getByRole('link', { name: 'Terms of service' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Terms of service' })).toBeInTheDocument()
  })

  it('documents exactly the localStorage keys the app uses, and says no cookies are used', async () => {
    expect(STORAGE_ENTRIES.map((entry) => entry.key).sort()).toEqual(Object.values(STORAGE_KEYS).sort())
    renderApp('/cookies')
    await screen.findByRole('heading', { level: 1, name: 'Cookies and local storage' })
    const table = screen.getByRole('table', { name: /local storage/ })
    for (const key of ['propwise-demo-data', 'propwise-theme', 'propwise-sidebar-collapsed', 'propwise-session']) expect(within(table).getByText(key)).toBeInTheDocument()
    expect(within(table).getAllByRole('row')).toHaveLength(5)
    // Phones get the same four entries stacked, with every field, instead of a three-column table.
    const stacked = screen.getByRole('list', { name: /local storage/ })
    const items = within(stacked).getAllByRole('listitem')
    expect(items).toHaveLength(4)
    STORAGE_ENTRIES.forEach((entry, index) => {
      const item = items[index] as HTMLElement
      for (const text of [entry.key, entry.purpose, entry.contents, entry.written]) expect(within(item).getByText(text)).toBeInTheDocument()
      expect(within(item).getByText('What it holds')).toBeInTheDocument()
      expect(within(item).getByText('When it’s saved')).toBeInTheDocument()
    })
    expect(screen.getByText(/doesn’t use cookies/)).toBeInTheDocument()
  })

  it('discloses the account profile kept in the workspace data, and that passwords are never stored (Phase 10.3)', async () => {
    const workspace = STORAGE_ENTRIES.find((entry) => entry.key === STORAGE_KEYS.demoData)
    expect(workspace?.contents).toMatch(/your profile \(name, email, phone, job title and an optional photo/)
    expect(workspace?.contents).toMatch(/notification preferences/)
    expect(workspace?.contents).toMatch(/Never a password/)
    expect(workspace?.contents).toMatch(/your notifications and which ones you’ve read/)
    expect(workspace?.contents).toMatch(/staff members \(names, contact details, roles and property assignments\)/)
    renderApp('/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Privacy policy' })
    expect(document.body.textContent).toMatch(/your profile on the Account page: name, email address, phone number, job title, an optional photo/)
    expect(document.body.textContent).toMatch(/Change password on the Account page, are a\s+demonstration/)
    expect(document.body.textContent).toMatch(/Passwords are never stored/)
    expect(document.body.textContent).toMatch(/your in-app notifications, which repeat details of the records they are about/)
    expect(document.body.textContent).toMatch(/staff members, including names, email addresses, phone numbers, job titles, roles and the properties they look after/)
  })

  it('makes no claims about servers, encryption or compliance', async () => {
    for (const page of POLICY_PAGES) {
      const { unmount } = renderApp(page.path)
      await screen.findByRole('heading', { level: 1, name: page.title })
      const text = document.querySelector('main')?.textContent ?? ''
      expect(text).not.toMatch(/encrypt|GDPR|CCPA|HIPAA|SOC ?2|ISO ?27001|compliant|secure servers?|our servers|cloud database where/i)
      unmount()
    }
  })
})

describe('links to the policies', () => {
  it('the sign-in page footer links to all three policies', async () => {
    renderApp('/login')
    await screen.findByText('Welcome back')
    const legal = screen.getByRole('navigation', { name: 'Legal' })
    for (const page of POLICY_PAGES) expect(within(legal).getByRole('link', { name: page.label })).toHaveAttribute('href', page.path)
  })

  it('Settings → Data & storage links to all three policies', async () => {
    renderApp('/settings?tab=data')
    const legal = await screen.findByRole('navigation', { name: 'Legal' })
    for (const page of POLICY_PAGES) expect(within(legal).getByRole('link', { name: page.title })).toHaveAttribute('href', page.path)
  })
})
