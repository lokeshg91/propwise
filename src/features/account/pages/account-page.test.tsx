import { screen, waitFor, within } from '@testing-library/react'

import { defaultAccount } from '@/data/domain/account-rules'
import { readDatabase } from '@/data/store/demo-store'
import type * as avatarImage from '@/features/account/lib/avatar-image'
import { AvatarError, avatarCrop, avatarFileProblem, prepareAvatar } from '@/features/account/lib/avatar-image'
import { isSignedIn } from '@/lib/session'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

/** Phase 10.3: the Account page, the header following the saved profile, and the demo password form. */

vi.mock('@/features/account/lib/avatar-image', async (importOriginal) => {
  const original = await importOriginal<typeof avatarImage>()
  return { ...original, prepareAvatar: vi.fn() }
})

const PHOTO = `data:image/jpeg;base64,${'Q'.repeat(400)}`
const h1 = (name: string) => screen.findByRole('heading', { level: 1, name })
const card = (name: string) => screen.getByRole('heading', { level: 2, name }).closest('[data-slot="card"]') as HTMLElement
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const NO_SUCCESS_CLAIMS = /password updated|password has been changed|your password was changed|password changed successfully/i

afterEach(() => vi.mocked(prepareAvatar).mockReset())

describe('avatar images', () => {
  it('accepts JPEG, PNG, WebP and GIF up to 10 MB only', () => {
    expect(avatarFileProblem({ type: 'image/jpeg', size: 1000 })).toBeNull()
    expect(avatarFileProblem({ type: 'image/gif', size: 1000 })).toBeNull()
    expect(avatarFileProblem({ type: 'image/svg+xml', size: 1000 })).toMatch(/JPEG, PNG, WebP or GIF/)
    expect(avatarFileProblem({ type: 'text/plain', size: 1000 })).toMatch(/JPEG/)
    expect(avatarFileProblem({ type: 'image/png', size: 0 })).toMatch(/empty/)
    expect(avatarFileProblem({ type: 'image/png', size: 10 * 1024 * 1024 + 1 })).toMatch(/10 MB/)
  })

  it('crops the centre square and never enlarges', () => {
    expect(avatarCrop(4000, 3000)).toEqual({ sx: 500, sy: 0, side: 3000, size: 256 })
    expect(avatarCrop(300, 900)).toEqual({ sx: 0, sy: 300, side: 300, size: 256 })
    expect(avatarCrop(64, 80)).toEqual({ sx: 0, sy: 8, side: 64, size: 64 })
  })
})

describe('Account page', () => {
  it('opens from Profile in the user menu, with one h1 and the four sections', async () => {
    const { user } = renderApp('/dashboard')
    await user.click(await screen.findByRole('button', { name: /Account menu for Alex Morgan/ }))
    const profile = await screen.findByRole('menuitem', { name: 'Profile' })
    expect(profile).toHaveAttribute('href', '/account')
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toHaveAttribute('href', '/settings')
    await user.click(profile)
    expect(await h1('Account')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    for (const name of ['Profile', 'Password', 'Notifications', 'Session and data']) expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    expect(document.title).toBe('Account · Propwise')
  }, 20_000)

  it('shows the sample profile, with Save disabled until something changes', async () => {
    renderApp('/account')
    await h1('Account')
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Alex Morgan')
    expect(screen.getByLabelText(/Job title/)).toHaveValue('Portfolio Manager')
    expect(screen.getByLabelText(/^Email/)).toHaveValue('alex.morgan@example.com')
    expect(screen.getByLabelText(/^Phone/)).toHaveValue('')
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save preferences' })).toBeDisabled()
    expect(stored()).toBeNull()
  })

  it('saves the profile and the header follows straight away', async () => {
    const { user } = renderApp('/account')
    await h1('Account')
    await user.clear(screen.getByLabelText(/Full name/))
    await user.type(screen.getByLabelText(/Full name/), 'Sam Lee')
    await user.clear(screen.getByLabelText(/Job title/))
    await user.type(screen.getByLabelText(/Job title/), 'Owner')
    await user.type(screen.getByLabelText(/^Phone/), '(512) 555-0134')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByRole('button', { name: /Account menu for Sam Lee/ })).toBeInTheDocument()
    expect(screen.getByText('Owner', { selector: 'span' })).toBeInTheDocument()
    expect(readDatabase().account.profile).toMatchObject({ name: 'Sam Lee', jobTitle: 'Owner', phone: '(512) 555-0134' })
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled())
  })

  it('shows field errors and saves nothing while the profile is invalid', async () => {
    const { user } = renderApp('/account')
    await h1('Account')
    await user.clear(screen.getByLabelText(/Full name/))
    await user.clear(screen.getByLabelText(/^Email/))
    await user.type(screen.getByLabelText(/^Email/), 'sam@')
    await user.type(screen.getByLabelText(/^Phone/), 'call me')
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText(/Enter a valid email address/)).toBeInTheDocument()
    expect(screen.getByText(/Enter a valid phone number/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toHaveAttribute('aria-invalid', 'true')
    expect(stored()).toBeNull()
    expect(screen.getByRole('button', { name: /Account menu for Alex Morgan/ })).toBeInTheDocument()
  })

  it('keeps what was typed and shows the error when saving fails', async () => {
    const { user } = renderApp('/account')
    await h1('Account')
    await user.clear(screen.getByLabelText(/Full name/))
    await user.type(screen.getByLabelText(/Full name/), 'Sam Lee')
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    expect(await within(card('Profile')).findByRole('alert')).toHaveTextContent(/wasn’t saved/)
    setItem.mockRestore()
    expect(screen.getByLabelText(/Full name/)).toHaveValue('Sam Lee')
    expect(screen.getByRole('button', { name: /Account menu for Alex Morgan/ })).toBeInTheDocument()
    expect(readDatabase().account).toEqual(defaultAccount())
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeEnabled()
  })

  it('adds and removes a photo, saved only with the profile', async () => {
    vi.mocked(prepareAvatar).mockResolvedValue(PHOTO)
    const { user, container } = renderApp('/account')
    await h1('Account')
    const input = container.querySelector<HTMLInputElement>('input[type="file"]') as HTMLInputElement
    expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp,image/gif')
    await user.upload(input, new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await screen.findByRole('button', { name: 'Remove photo' })).toBeInTheDocument()
    expect(stored()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(readDatabase().account.profile.avatar).toBe(PHOTO))
    await user.click(screen.getByRole('button', { name: 'Remove photo' }))
    await user.click(screen.getByRole('button', { name: 'Save profile' }))
    await waitFor(() => expect(readDatabase().account.profile.avatar).toBeNull())
  })

  it('explains a photo that can’t be used and keeps the current one', async () => {
    vi.mocked(prepareAvatar).mockRejectedValue(new AvatarError('Choose a JPEG, PNG, WebP or GIF image.'))
    const { user, container } = renderApp('/account')
    await h1('Account')
    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, new File(['x'], 'me.png', { type: 'image/png' }))
    expect(await screen.findByText('Choose a JPEG, PNG, WebP or GIF image.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Remove photo' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Save profile' })).toBeDisabled()
  })

  it('the password form is a demo: validates, stores nothing and never claims a change', async () => {
    const { user } = renderApp('/account')
    await h1('Account')
    const password = card('Password')
    expect(password).toHaveTextContent(/Demo: passwords aren’t checked or stored/)
    await user.click(within(password).getByRole('button', { name: 'Change password' }))
    expect(await within(password).findByText('Enter your current password.')).toBeInTheDocument()
    expect(within(password).getByText('Enter a password.')).toBeInTheDocument()

    await user.type(within(password).getByLabelText(/Current password/), 'old-secret-1')
    await user.type(within(password).getByLabelText(/^New password/), 'NewSecret42')
    await user.type(within(password).getByLabelText(/Confirm new password/), 'NewSecret42')
    const before = { ...window.localStorage }
    await user.click(within(password).getByRole('button', { name: 'Change password' }))
    expect(await within(password).findByText(/Demo complete — no password was changed/)).toBeInTheDocument()
    expect(within(password).getByLabelText(/Current password/)).toHaveValue('')
    expect({ ...window.localStorage }).toEqual(before)
    const everything = Object.values({ ...window.localStorage }).join(' ')
    expect(everything).not.toMatch(/NewSecret42|old-secret-1/)
    expect(document.body.textContent).not.toMatch(NO_SUCCESS_CLAIMS)
  })

  it('saves notification preferences', async () => {
    const { user } = renderApp('/account')
    await h1('Account')
    const notifications = card('Notifications')
    const lease = within(notifications).getByRole('switch', { name: /Leases/ })
    expect(lease).toBeChecked()
    await user.click(lease)
    await user.click(within(notifications).getByRole('button', { name: 'Save preferences' }))
    await waitFor(() => expect(readDatabase().account.notificationPreferences.lease).toBe(false))
    await waitFor(() => expect(within(notifications).getByRole('button', { name: 'Save preferences' })).toBeDisabled())
    // The sample inbox is unchanged: 3 unread.
    expect(screen.getByRole('button', { name: /Notifications/ })).toHaveAccessibleName(/3 unread/)
  })

  it('signs out from the Account page and links to Data & storage', async () => {
    const { user, router } = renderApp('/account')
    await h1('Account')
    expect(within(card('Session and data')).getByRole('link', { name: 'Back up or reset' })).toHaveAttribute('href', '/settings?tab=data')
    await user.click(within(card('Session and data')).getByRole('button', { name: 'Sign out' }))
    expect(await h1('Welcome back')).toBeInTheDocument()
    expect(isSignedIn()).toBe(false)
    expect(router.state.location.pathname).toBe('/login')
  })
})
