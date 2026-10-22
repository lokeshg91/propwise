import { act, screen, waitFor, within } from '@testing-library/react'

import { addDays } from '@/data/domain/dates'
import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { addLateFee, getReceivables, voidCharge } from '@/data/services'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
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
  vi.restoreAllMocks()
  vi.useRealTimers()
})

const db = () => readDatabase()
const stored = () => window.localStorage.getItem(STORAGE_KEYS.demoData)
const refuseWrites = () =>
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new DOMException('Quota exceeded', 'QuotaExceededError')
  })
const toasts = () => Array.from(document.querySelectorAll('[data-sonner-toast]'), (node) => node.textContent ?? '')
const chargesTable = () => screen.getByRole('table', { name: /charges billed to this tenant/i })

async function owingTenant() {
  const row = (await getReceivables()).find((entry) => entry.balanceCents > 0 && entry.demo)
  if (!row) throw new Error('nobody owes')
  return row
}

describe('tenant Payments tab', () => {
  it('records a payment against a charge and shows it only after it is saved', async () => {
    const row = await owingTenant()
    const { user } = renderApp(`/tenants/${row.tenantId}?tab=payments`)
    const table = await screen.findByRole('table', { name: /charges billed to this tenant/i })
    const button = within(table).getAllByRole('button', { name: /^Record payment for / })[0] as HTMLElement
    const reference = button.getAttribute('aria-label')?.replace('Record payment for ', '') ?? ''
    const charge = db().charges.find((entry) => entry.reference === reference) as Charge
    const paymentsBefore = db().payments.filter((payment) => payment.chargeId === charge.id).length
    await user.click(button)
    const dialog = await screen.findByRole('dialog')
    const amount = within(dialog).getByRole('textbox', { name: /amount/i })
    await user.clear(amount)
    await user.type(amount, '10')
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    expect(await screen.findByText(/ recorded: \$10\.00/)).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(db().payments.filter((payment) => payment.chargeId === charge.id)).toHaveLength(paymentsBefore + 1)
    const payments = screen.getByRole('table', { name: /payments received from this tenant/i })
    await waitFor(() => expect(within(payments).getAllByRole('link', { name: reference }).length).toBeGreaterThan(0))
  })

  it('keeps the dialog open with the error when the save fails, and changes nothing', async () => {
    const row = await owingTenant()
    const { user } = renderApp(`/tenants/${row.tenantId}?tab=payments`)
    await screen.findByRole('table', { name: /charges billed to this tenant/i })
    const memory = JSON.stringify(db())
    const raw = stored()
    const shown = toasts()
    refuseWrites()
    await user.click(within(chargesTable()).getAllByRole('button', { name: /^Record payment for / })[0] as HTMLElement)
    const dialog = await screen.findByRole('dialog')
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }))
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This change wasn’t saved')
    expect(toasts()).toEqual(shown)
    expect(JSON.stringify(db())).toBe(memory)
    expect(stored()).toBe(raw)
    expect(screen.getByRole('region', { name: 'Saving status', hidden: true })).toHaveTextContent('Your last change wasn’t saved')
  })

  it('links to Finance: each record, Add income for the lease, and the filtered Transactions list', async () => {
    const row = await owingTenant()
    const { user, router } = renderApp(`/tenants/${row.tenantId}?tab=payments`)
    await screen.findByRole('table', { name: /charges billed to this tenant/i })
    expect(screen.getByRole('link', { name: 'Add income' })).toHaveAttribute('href', `/finance/income/new?leaseId=${encodeURIComponent(row.leaseId)}`)
    await user.click(screen.getByRole('link', { name: 'View in Finance' }))
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    expect(router.state.location.search).toContain(`party=tenant%3A${row.tenantId}`)
    expect(screen.getByText(row.tenantName, { selector: 'p span span' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Show records for everyone' }))
    await waitFor(() => expect(router.state.location.search).not.toContain('party='))
  })
})

describe('property Finance tab', () => {
  it('shows the figures and links into Finance', async () => {
    renderApp('/properties/prop_101?tab=finance')
    const figures = await screen.findByRole('region', { name: 'Finance figures' })
    expect(within(figures).getByText('Net cash flow')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /^Transactions/ })).toHaveAttribute('href', '/finance/transactions?property=prop_101&range=12m')
    expect(screen.getByRole('link', { name: /Open in Finance/ })).toHaveAttribute('href', '/finance?property=prop_101&range=12m')
    expect(screen.getByRole('link', { name: 'Add income' })).toHaveAttribute('href', '/finance/income/new?propertyId=prop_101')
    expect(screen.getByRole('link', { name: 'Add bill' })).toHaveAttribute('href', '/finance/expenses/new?propertyId=prop_101')
    const owing = (await getReceivables()).filter((entry) => entry.propertyId === 'prop_101' && entry.balanceCents > 0)
    if (owing.length > 0) {
      const list = screen.getByRole('list', { name: 'Tenants with a balance' })
      expect(within(list).getAllByRole('listitem')).toHaveLength(owing.length)
      expect(within(list).getAllByRole('link')[0]).toHaveAttribute('href', expect.stringMatching(/^\/tenants\/.+\?tab=payments$/))
    }
  })

  it('pre-fills the property when adding a bill from it', async () => {
    const { user } = renderApp('/properties/prop_101?tab=finance')
    await screen.findByRole('region', { name: 'Finance figures' })
    await user.click(screen.getByRole('link', { name: 'Add bill' }))
    await screen.findByRole('heading', { level: 1, name: 'Add bill' })
    expect(screen.getByRole('combobox', { name: /^Property/ })).toHaveTextContent(db().properties.find((property) => property.id === 'prop_101')?.name ?? '')
  })
})

describe('maintenance and vendor links', () => {
  it('a completed work order links to its bill with the bill status', async () => {
    const bill = db().expenses.find((expense) => expense.source === 'work-order') ?? null
    const order = db().workOrders.find((entry) => entry.id === bill?.workOrderId)
    if (!bill || !order) throw new Error('no bill')
    renderApp(`/maintenance/${order.requestId}`)
    const link = await screen.findByRole('link', { name: bill.reference })
    expect(link).toHaveAttribute('href', `/finance/transactions/${bill.id}`)
  })

  it('the vendor profile shows bill totals, links to the vendor’s bills and explains why it can’t be deleted', async () => {
    const bill = db().expenses.find((expense) => expense.vendorId && expense.source === 'work-order')
    const vendorId = bill?.vendorId ?? ''
    const { user, router } = renderApp(`/vendors/${vendorId}`)
    const card = (await screen.findByText('Finance bills paid to this vendor')).closest('[data-slot="card"]') as HTMLElement
    expect(within(card).getByText('Paid')).toBeInTheDocument()
    expect(within(card).getByText('Unpaid')).toBeInTheDocument()
    await user.click(within(card).getByRole('link', { name: /View bills/ }))
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    expect(router.state.location.search).toContain(`party=vendor%3A${vendorId}`)
    const count = db().expenses.filter((expense) => expense.vendorId === vendorId).length
    expect(screen.getByText(new RegExp(`^Showing 1–${Math.min(count, 20)} of ${count} `))).toBeInTheDocument()
  })
})

describe('late-fee record', () => {
  it('a voided late fee stays shown with its reason and no other fee can be added', async () => {
    const payments = paymentsByCharge(db().payments)
    const fees = new Set(db().charges.map((charge) => charge.parentChargeId).filter(Boolean))
    const late = db().charges.find((charge) => charge.category === 'rent' && !fees.has(charge.id) && chargeState(charge, payments.get(charge.id), TODAY).balanceCents > 0 && charge.dueDate < addDays(TODAY, -5)) as Charge
    const fee = await addLateFee(late.id)
    await voidCharge(fee.id, 'Waived as a courtesy')
    renderApp(`/finance/transactions/${late.id}`)
    expect(await screen.findByText(/was added and later voided \(Waived as a courtesy\)\. Only one late fee per charge is allowed/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: fee.reference })).toBeInTheDocument()
    expect(screen.queryAllByRole('button', { name: 'Add late fee' })).toHaveLength(0)
  })

  it('opening a tenant from Finance lands on the Payments tab', async () => {
    const row = await owingTenant()
    const { user, router } = renderApp('/finance/receivables')
    await screen.findByRole('heading', { level: 1, name: 'Receivables' })
    await user.click(screen.getAllByRole('link', { name: row.tenantName })[0] as HTMLElement)
    await waitFor(() => expect(router.state.location.pathname).toBe(`/tenants/${row.tenantId}`))
    expect(router.state.location.search).toBe('?tab=payments')
    await act(() => Promise.resolve())
    expect(await screen.findByRole('table', { name: /charges billed to this tenant/i })).toBeInTheDocument()
  })
})

describe('period comparisons', () => {
  it('shows no comparison when the previous period starts before Finance history', async () => {
    renderApp('/finance?range=12m')
    const figures = await screen.findByRole('region', { name: 'Finance figures' })
    expect(within(figures).getAllByText('No full previous period yet')).toHaveLength(3)
    expect(within(figures).queryByText(/vs previous period/)).toBeNull()
  })

  it('still compares when the previous period is covered', async () => {
    renderApp('/finance?range=6m')
    const figures = await screen.findByRole('region', { name: 'Finance figures' })
    expect(within(figures).queryByText('No full previous period yet')).toBeNull()
    expect(within(figures).getAllByText(/vs previous period/).length).toBeGreaterThan(0)
  })
})
