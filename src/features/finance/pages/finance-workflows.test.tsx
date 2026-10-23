import { act, screen, waitFor, within } from '@testing-library/react'

import { addDays } from '@/data/domain/dates'
import { paymentsByCharge } from '@/data/domain/finance-rules'
import { createCharge, createExpense } from '@/data/services'
import { getStorageStatus, readDatabase, resetDemoData, STORAGE_LIMIT_CHARS, storageHooks } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { renderApp } from '@/test/render-app'
import { type Charge } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  storageHooks.limitChars = STORAGE_LIMIT_CHARS
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const db = () => readDatabase()
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
// `hidden`: an open dialog marks the rest of the page aria-hidden.
const banner = () => screen.queryByRole('region', { name: 'Saving status', hidden: true })
/** Text of the toasts on screen (sonner keeps earlier tests' toasts, so compare before/after). */
const toasts = () => Array.from(document.querySelectorAll('[data-sonner-toast]'), (node) => node.textContent ?? '')

/** The header button (the same action can also appear in an empty state). */
const pageButton = (name: string) => screen.getAllByRole('button', { name })[0] as HTMLElement
const refuseWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })

/** A late residential rent charge with no payments and no late fee. */
function lateRent(type: 'residential' | 'commercial' = 'residential'): Charge {
  const data = db()
  const payments = paymentsByCharge(data.payments)
  const fees = new Set(data.charges.map((charge) => charge.parentChargeId).filter(Boolean))
  const types = new Map(data.properties.map((property) => [property.id, property.type]))
  const charge = data.charges.find(
    (entry) =>
      entry.category === 'rent' &&
      !entry.voidedAt &&
      !fees.has(entry.id) &&
      (payments.get(entry.id) ?? []).length === 0 &&
      entry.dueDate < addDays(TODAY, -5) &&
      types.get(entry.propertyId) === type,
  )
  if (!charge) throw new Error('no late rent')
  return charge
}

async function openDetail(id: string) {
  const app = renderApp(`/finance/transactions/${id}`)
  const reference = db().charges.find((charge) => charge.id === id)?.reference ?? db().expenses.find((expense) => expense.id === id)?.reference ?? ''
  await screen.findByRole('heading', { level: 1, name: new RegExp(reference) })
  return app
}

/* ----------------------------------------------------------------- banner */

describe('storage banner', () => {
  it('stays hidden while storage is fine', async () => {
    renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    expect(banner()).toBeNull()
  })

  it('warns from 60% and can be hidden for the session, across pages', async () => {
    storageHooks.limitChars = Math.ceil(getStorageStatus().usedChars / 0.65)
    const { user, router } = renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    expect(within(banner() as HTMLElement).getByText('Browser storage is 65% full')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Hide for this session' }))
    expect(banner()).toBeNull()
    await act(() => router.navigate('/properties'))
    await screen.findByRole('heading', { level: 1, name: 'Properties' })
    expect(banner()).toBeNull()
  })

  it('shows a non-dismissible critical alert from 80%, on every page', async () => {
    storageHooks.limitChars = Math.ceil(getStorageStatus().usedChars / 0.85)
    const { router } = renderApp('/dashboard')
    await screen.findByRole('heading', { level: 1 })
    const region = banner() as HTMLElement
    expect(within(region).getByRole('alert')).toHaveTextContent('Browser storage is almost full (85%)')
    expect(within(region).queryByRole('button')).toBeNull()
    await act(() => router.navigate('/tenants'))
    await screen.findByRole('heading', { level: 1, name: 'Tenants' })
    expect(banner()).not.toBeNull()
  })

  it('reports a failed save until the next save succeeds', async () => {
    const charge = lateRent()
    const { user } = await openDetail(charge.id)
    const spy = refuseWrites()
    await user.click(pageButton('Record payment'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    await waitFor(() => expect(banner()).not.toBeNull())
    const region = banner() as HTMLElement
    expect(within(region).getByRole('alert', { hidden: true })).toHaveTextContent('Your last change wasn’t saved')
    expect(within(region).getByRole('alert', { hidden: true })).toHaveTextContent('Your previously saved data is unchanged.')
    expect(within(region).queryByRole('button', { hidden: true })).toBeNull()

    spy.mockRestore()
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    await waitFor(() => expect(banner()).toBeNull())
  })

  it('shows the read-only alert with a Reload button when saved data could not be upgraded', async () => {
    // Covered end-to-end in the store tests; here the banner reacts to the suspended mode.
    const store = await import('@/data/store/demo-store')
    const seed = structuredClone(readDatabase()) as unknown as Record<string, unknown>
    for (const key of ['charges', 'payments', 'expenses', 'recurringCharges', 'financeEvents', 'finance', 'appSettings', 'settingsEvents']) delete seed[key]
    seed.version = 4
    seed.sequences = { request: readDatabase().sequences.request }
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, JSON.stringify(seed))
    store.migrationHooks.beforeCommit = () => {
      throw new Error('simulated')
    }
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      renderApp('/finance')
      await screen.findByRole('heading', { level: 1, name: 'Finance' })
      const alert = within(banner() as HTMLElement).getByRole('alert')
      expect(alert).toHaveTextContent('Changes aren’t being saved')
      expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument()
      expect(within(alert).queryByRole('button', { name: /hide/i })).toBeNull()
    } finally {
      store.migrationHooks.beforeCommit = () => undefined
    }
  })
})

/* ---------------------------------------------------------------- income */

describe('income actions', () => {
  it('records a payment: toast and new balance only after it is saved', async () => {
    const charge = lateRent()
    const { user } = await openDetail(charge.id)
    await user.click(pageButton('Record payment'))
    const dialog = await screen.findByRole('dialog')
    const amount = within(dialog).getByRole('textbox', { name: /amount/i })
    await user.clear(amount)
    await user.type(amount, '100')
    expect(within(dialog).getByText(/Leaves .* outstanding/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText(/ recorded: \$100\.00/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(db().payments.filter((payment) => payment.chargeId === charge.id)).toHaveLength(1)
  })

  it('keeps the dialog open with the error when the save fails, and changes nothing', async () => {
    const charge = lateRent()
    const { user } = await openDetail(charge.id)
    const before = stored()
    const memory = JSON.stringify(db())
    refuseWrites()
    const shown = toasts()
    await user.click(pageButton('Record payment'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This change wasn’t saved')
    expect(toasts()).toEqual(shown)
    expect(JSON.stringify(db())).toBe(memory)
    expect(stored()).toBe(before)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('rejects an amount above the balance in the dialog', async () => {
    const charge = lateRent()
    const { user } = await openDetail(charge.id)
    await user.click(pageButton('Record payment'))
    const dialog = await screen.findByRole('dialog')
    const amount = within(dialog).getByRole('textbox', { name: /amount/i })
    await user.clear(amount)
    await user.type(amount, String(charge.amountCents / 100 + 1))
    expect(within(dialog).getByText(/Credits aren’t supported/)).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Record payment' })).toBeDisabled()
  })

  it('adds the late fee from the rule, with no amount to type', async () => {
    const charge = lateRent()
    const { user } = await openDetail(charge.id)
    await user.click(pageButton('Add late fee'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).getByText(/Residential: a fixed \$50\.00/)).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Add $50.00 late fee' }))
    expect(await screen.findByText(/added: \$50\.00 late fee/)).toBeInTheDocument()
    expect(db().charges.filter((entry) => entry.parentChargeId === charge.id)).toHaveLength(1)
    await waitFor(() => expect(screen.queryAllByRole('button', { name: 'Add late fee' })).toHaveLength(0))
  })

  it('does not add a late fee when the save fails', async () => {
    const charge = lateRent('commercial')
    const { user } = await openDetail(charge.id)
    refuseWrites()
    const shown = toasts()
    await user.click(pageButton('Add late fee'))
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: /^Add .* late fee$/ }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('wasn’t saved')
    expect(db().charges.some((entry) => entry.parentChargeId === charge.id)).toBe(false)
    expect(toasts()).toEqual(shown)
  })

  it('adds income for a tenant from a preset lease link', async () => {
    const lease = db().leases.find((entry) => entry.status === 'active')
    const { user, router } = renderApp(`/finance/income/new?leaseId=${lease?.id ?? ''}`)
    await screen.findByRole('heading', { level: 1, name: 'Add income' })
    await user.type(screen.getByRole('textbox', { name: /amount/i }), '25')
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'Guest parking permit')
    await user.click(screen.getByRole('button', { name: 'Add income' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/finance\/transactions\/chg_/))
    expect(await screen.findByText(/ added$/)).toBeInTheDocument()
    expect(db().charges.find((charge) => charge.description === 'Guest parking permit')).toMatchObject({ leaseId: lease?.id, amountCents: 2500, source: 'manual' })
  })

  it('stays on the form with the error when adding income fails', async () => {
    const lease = db().leases.find((entry) => entry.status === 'active')
    const { user, router } = renderApp(`/finance/income/new?leaseId=${lease?.id ?? ''}`)
    await screen.findByRole('heading', { level: 1, name: 'Add income' })
    const count = db().charges.length
    refuseWrites()
    await user.type(screen.getByRole('textbox', { name: /amount/i }), '25')
    await user.click(screen.getByRole('button', { name: 'Add income' }))
    expect(await screen.findByText(/This change wasn’t saved/, { selector: 'main *' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/finance/income/new')
    expect(db().charges).toHaveLength(count)
    expect(screen.getByRole('textbox', { name: /amount/i })).toHaveValue('25')
  })

  it('edits a manual charge and redirects records that cannot be edited', async () => {
    const charge = await createCharge({ propertyId: 'prop_101', payerName: 'Vending Co', category: 'other-income', description: 'Vending', amountCents: 9000, dueDate: TODAY })
    const { user, router } = renderApp(`/finance/transactions/${charge.id}/edit`)
    await screen.findByRole('heading', { level: 1, name: new RegExp(`Edit ${charge.reference}`) })
    const amount = screen.getByRole('textbox', { name: /amount/i })
    await user.clear(amount)
    await user.type(amount, '95')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/finance/transactions/${charge.id}`))
    expect(db().charges.find((entry) => entry.id === charge.id)?.amountCents).toBe(9500)

    const rent = lateRent()
    await act(() => router.navigate(`/finance/transactions/${rent.id}/edit`))
    await waitFor(() => expect(router.state.location.pathname).toBe(`/finance/transactions/${rent.id}`))
  })
})

/* ---------------------------------------------------------------- bills */

describe('bill actions', () => {
  it('adds a bill for another payee and opens it', async () => {
    const { user, router } = renderApp('/finance/expenses/new?propertyId=prop_101')
    await screen.findByRole('heading', { level: 1, name: 'Add bill' })
    await user.click(screen.getByRole('radio', { name: /Other payee/ }))
    await user.type(screen.getByRole('textbox', { name: /payee name/i }), 'Larkspur Power & Water')
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'Common-area electricity')
    await user.type(screen.getByRole('textbox', { name: /^amount/i }), '410')
    await user.click(screen.getByRole('button', { name: 'Add bill' }))
    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/finance\/transactions\/exp_/))
    expect(db().expenses.find((expense) => expense.description === 'Common-area electricity')).toMatchObject({ payeeName: 'Larkspur Power & Water', amountCents: 41000, dueDate: addDays(TODAY, 30) })
  })

  it('stays on the form when adding a bill fails', async () => {
    const { user, router } = renderApp('/finance/expenses/new?propertyId=prop_101')
    await screen.findByRole('heading', { level: 1, name: 'Add bill' })
    const count = db().expenses.length
    await user.click(screen.getByRole('radio', { name: /Other payee/ }))
    await user.type(screen.getByRole('textbox', { name: /payee name/i }), 'Larkspur Power & Water')
    await user.type(screen.getByRole('textbox', { name: /description/i }), 'Common-area electricity')
    await user.type(screen.getByRole('textbox', { name: /^amount/i }), '410')
    refuseWrites()
    await user.click(screen.getByRole('button', { name: 'Add bill' }))
    expect(await screen.findByText(/This change wasn’t saved/, { selector: 'main *' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/finance/expenses/new')
    expect(db().expenses).toHaveLength(count)
  })

  it('marks a bill paid, and keeps it unpaid when the save fails', async () => {
    const expense = await createExpense({ category: 'utilities', payeeName: 'Larkspur Power & Water', propertyId: 'prop_101', description: 'Electricity', amountCents: 41000, billDate: TODAY })
    const { user } = await openDetail(expense.id)
    const spy = refuseWrites()
    await user.click(screen.getByRole('button', { name: 'Mark as paid' }))
    let dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('wasn’t saved')
    expect(db().expenses.find((entry) => entry.id === expense.id)?.paidOn).toBeUndefined()
    spy.mockRestore()
    await user.click(within(dialog).getByRole('button', { name: 'Mark as paid' }))
    expect(await screen.findByText(`${expense.reference} marked as paid`)).toBeInTheDocument()
    expect(db().expenses.find((entry) => entry.id === expense.id)?.paidOn).toBe(TODAY)
    // Paid bills can't be voided until they are marked unpaid.
    await user.click(await screen.findByRole('button', { name: /^Void/ }))
    dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Mark the bill as unpaid before voiding it.')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Void bill' })).toBeDisabled()
  })
})

describe('header actions', () => {
  it('offers Add income and Add bill on Overview and Transactions', async () => {
    const { router } = renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    expect(screen.getByRole('link', { name: 'Add income' })).toHaveAttribute('href', '/finance/income/new')
    expect(screen.getByRole('link', { name: 'Add bill' })).toHaveAttribute('href', '/finance/expenses/new')
    await act(() => router.navigate('/finance/transactions'))
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    expect(screen.getByRole('link', { name: 'Add income' })).toBeInTheDocument()
  })
})
