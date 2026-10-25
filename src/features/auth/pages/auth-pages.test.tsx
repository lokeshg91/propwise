import { screen, waitFor, within } from '@testing-library/react'

import { createDemoToken } from '@/features/auth/lib/demo-tokens'
import { isSignedIn, signOut } from '@/lib/session'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'

/** Phase 10.2: demo auth pages, validation, demo outcomes and the route guard. */

const h1 = (name: string | RegExp) => screen.findByRole('heading', { level: 1, name })
// Success claims the demo must never make.
const NO_SUCCESS_CLAIMS = /password updated|password changed|your password has been|email verified|your email (address )?has been verified|account created|your account has been created/i

describe('auth pages', () => {
  it.each([
    ['/login', 'Welcome back'],
    ['/signup', 'Create your account'],
    ['/forgot-password', 'Reset your password'],
    ['/check-email?for=reset', 'Check your email'],
    ['/check-email?for=verify', 'Verify your email'],
    ['/reset-password', 'This link is invalid or has expired'],
    ['/verify-email', 'Verify your email'],
  ])('%s renders one h1, the demo notice and the policy links', async (path, title) => {
    renderApp(path)
    expect(await h1(title)).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('navigation', { name: 'Legal' })).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/Demo|demonstration/)
  })

  it('the login form has no "Keep me signed in" and keeps the demo credentials prefilled', async () => {
    renderApp('/login')
    await h1('Welcome back')
    expect(screen.queryByText(/Keep me signed in/i)).toBeNull()
    expect(screen.getByLabelText('Email')).toHaveValue('alex.morgan@example.com')
    expect(screen.getByLabelText('Password')).toHaveValue('demo-password')
    expect(screen.getByRole('link', { name: 'Forgot password?' })).toHaveAttribute('href', '/forgot-password')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute('href', '/signup')
  })

  it('login validates and focuses the first invalid field', async () => {
    const { user } = renderApp('/login')
    await h1('Welcome back')
    await user.clear(screen.getByLabelText('Email'))
    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.clear(screen.getByLabelText('Password'))
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByText(/Enter a valid email address/)).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true')
  })

  it('the password field can be shown and hidden', async () => {
    const { user } = renderApp('/login')
    await h1('Welcome back')
    const input = screen.getByLabelText('Password')
    expect(input).toHaveAttribute('type', 'password')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(input).toHaveAttribute('type', 'text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('a signed-in user still sees the login form; signing in goes to the Dashboard', async () => {
    const { user, router } = renderApp('/login')
    await h1('Welcome back')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  })

  it('reports a sign-in that the browser refuses to save', async () => {
    signOut()
    const { user, router } = renderApp('/login')
    await h1('Welcome back')
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => undefined)
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/didn’t allow Propwise to save the sign-in/)
    expect(router.state.location.pathname).toBe('/login')
    remove.mockRestore()
  })

  it('sign-up validates every rule, including the terms', async () => {
    const { user } = renderApp('/signup')
    await h1('Create your account')
    const [password, confirm] = screen.getAllByLabelText(/password/i, { selector: 'input' })
    await user.type(password as HTMLElement, 'short')
    await user.type(confirm as HTMLElement, 'other')
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument()
    expect(screen.getByText('Enter your email address.')).toBeInTheDocument()
    expect(screen.getByText('Use at least 8 characters.')).toBeInTheDocument()
    expect(screen.getByText('The passwords don’t match.')).toBeInTheDocument()
    expect(screen.getByText(/Accept the Terms of service and Privacy policy/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Full name/)).toHaveFocus()
    const rules = screen.getByRole('list', { name: 'Password rules' })
    expect(within(rules).getByText(/8–128 characters/)).toHaveTextContent('(not met yet)')
    expect(within(rules).getByText(/At least one letter/)).toHaveTextContent('(met)')
  })

  it('sign-up → check email → demo link → verify → continue signs in as the demo user, saving nothing typed', async () => {
    signOut()
    const { user, router } = renderApp('/signup?next=%2Ffinance%3Frange%3D12m')
    await h1('Create your account')
    const [password, confirm] = screen.getAllByLabelText(/password/i, { selector: 'input' })
    await user.type(screen.getByLabelText(/Full name/), 'Jordan Typed')
    await user.type(screen.getByLabelText(/Work email/), 'jordan.typed@example.com')
    await user.type(password as HTMLElement, 'Secret-pass-123')
    await user.type(confirm as HTMLElement, 'Secret-pass-123')
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await h1('Verify your email')).toBeInTheDocument()
    expect(screen.getByText('jordan.typed@example.com')).toBeInTheDocument()
    expect(router.state.location.search).not.toContain('jordan')
    await user.click(screen.getByRole('button', { name: 'Demo: open the link from the email' }))
    expect(await h1('Demo complete — no email was verified')).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/No email address was checked or verified, and no account was created/)
    expect(document.body.textContent).not.toMatch(NO_SUCCESS_CLAIMS)
    await waitFor(() => expect(router.state.location.search).not.toContain('token'))
    await user.click(screen.getByRole('button', { name: 'Continue to Propwise' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/finance'))
    expect(router.state.location.search).toBe('?range=12m')
    expect(isSignedIn()).toBe(true)
    const stored = Object.values({ ...window.localStorage }).join('\n')
    expect(stored).not.toMatch(/Jordan Typed|jordan\.typed@example\.com|Secret-pass-123|demo-verify-/)
    expect(window.sessionStorage.length).toBe(0)
  })

  it('forgot → check email → demo link → choose a password → demo complete (no password changed)', async () => {
    const { user, router } = renderApp('/forgot-password')
    await h1('Reset your password')
    await user.click(screen.getByRole('button', { name: 'Get reset link' }))
    expect(await screen.findByText('Enter your email address.')).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Email/), 'reset.me@example.com')
    await user.click(screen.getByRole('button', { name: 'Get reset link' }))
    expect(await h1('Check your email')).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/In a live app, we’d send a link to choose a new password to reset\.me@example\.com\. This demo doesn’t send email\./)
    await user.click(screen.getByRole('button', { name: 'Resend email' }))
    expect(screen.getByText(/Demo: nothing was sent/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Resend available in/ })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Demo: open the link from the email' }))
    expect(await h1('Choose a new password')).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).toBe(''))
    const [password, confirm] = screen.getAllByLabelText(/new password/i, { selector: 'input' })
    await user.type(password as HTMLElement, 'Another-pass-9')
    await user.type(confirm as HTMLElement, 'Another-pass-8')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await screen.findByText('The passwords don’t match.')).toBeInTheDocument()
    await user.clear(confirm as HTMLElement)
    await user.type(confirm as HTMLElement, 'Another-pass-9')
    await user.click(screen.getByRole('button', { name: 'Set new password' }))
    expect(await h1('Demo complete — no password was changed')).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/Your new password wasn’t saved, and no account password was changed/)
    expect(document.body.textContent).not.toMatch(NO_SUCCESS_CLAIMS)
    expect(Object.values({ ...window.localStorage }).join('\n')).not.toMatch(/Another-pass|reset\.me|demo-reset-/)
  })

  it.each([
    ['/reset-password?token=abc', 'This link is invalid or has expired'],
    [`/reset-password?token=${createDemoToken('verify')}`, 'This link is invalid or has expired'],
    ['/verify-email?token=demo-verify-xyz', 'This verification link is invalid or has expired'],
    [`/verify-email?token=${createDemoToken('reset')}`, 'This verification link is invalid or has expired'],
  ])('rejects malformed and wrong-kind tokens: %s', async (path, title) => {
    const { router } = renderApp(path)
    expect(await h1(title)).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.search).not.toContain('token'))
  })

  it('a used reset link shows as expired after the token is removed and the page reloads', async () => {
    const token = createDemoToken('reset')
    const first = renderApp(`/reset-password?token=${token}`)
    expect(await h1('Choose a new password')).toBeInTheDocument()
    await waitFor(() => expect(first.router.state.location.search).toBe(''))
    first.unmount()
    renderApp(first.router.state.location.pathname)
    expect(await h1('This link is invalid or has expired')).toBeInTheDocument()
  })
})

describe('route guard', () => {
  it('a fresh browser is signed in: app routes open directly', async () => {
    expect(window.localStorage.getItem(STORAGE_KEYS.session)).toBeNull()
    const { router } = renderApp('/finance?range=12m')
    expect(await h1('Finance')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/finance')
  })

  it('signed out, a deep link goes to sign-in and back to the exact page afterwards', async () => {
    signOut()
    const { router, user } = renderApp('/finance/transactions?range=custom&from=2026-09-01&to=2026-09-30')
    expect(await h1('Welcome back')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/finance/transactions?range=custom&from=2026-09-01&to=2026-09-30')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/finance/transactions'))
    expect(router.state.location.search).toBe('?range=custom&from=2026-09-01&to=2026-09-30')
  })

  it('an unsafe next falls back to the Dashboard', async () => {
    signOut()
    const { router, user } = renderApp('/login?next=%2F%2Fevil.com')
    await h1('Welcome back')
    await user.click(screen.getByRole('button', { name: 'Sign in' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
  })

  it('Sign out in the user menu signs out, and Back can’t reopen the app', async () => {
    const { router, user } = renderApp('/dashboard')
    await user.click(await screen.findByRole('button', { name: /Account menu for Alex Morgan/ }))
    await user.click(await screen.findByRole('menuitem', { name: 'Sign out' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(isSignedIn()).toBe(false)
    expect(await screen.findByText('Signed out')).toBeInTheDocument()
    await router.navigate(-1)
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(await h1('Welcome back')).toBeInTheDocument()
  })

  it('signing out in another tab sends this one to sign-in, keeping the page to return to', async () => {
    const { router } = renderApp('/vendors')
    await h1('Vendors')
    window.localStorage.setItem(STORAGE_KEYS.session, JSON.stringify({ status: 'signed-out', at: new Date().toISOString() }))
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEYS.session }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'))
    expect(new URLSearchParams(router.state.location.search).get('next')).toBe('/vendors')
  })

  it('policy pages stay public; signed out, their header offers Sign in', async () => {
    signOut()
    renderApp('/privacy')
    expect(await h1('Privacy policy')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login')
  })
})
