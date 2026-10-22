import { screen, waitFor, within } from '@testing-library/react'

import { chargeState, paymentsByCharge } from '@/data/domain/finance-rules'
import { resolveRange, totalsFor } from '@/data/domain/finance-summary'
import { getReceivables, getTransactions, updateFinanceSettings } from '@/data/services'
import { snapshotOf } from '@/data/services/finance-service'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
import { DEFAULT_TRANSACTION_FILTERS, filterTransactions } from '@/features/finance/lib/transaction-list'
import { STORAGE_KEYS } from '@/lib/storage'
import { formatMoney } from '@/lib/format'
import { renderApp } from '@/test/render-app'
import { type Charge } from '@/types'

const NOW = new Date('2026-10-12T12:00:00')
const TODAY = '2026-10-12'
const usd = (cents: number) => formatMoney(cents, { currency: 'USD', locale: 'en-US' }, { whole: true })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  resetDemoData()
})
afterEach(() => {
  vi.useRealTimers()
})

const db = () => readDatabase()
const figures = () => screen.getByRole('region', { name: 'Finance figures' })

describe('Finance overview', () => {
  it('shows cash-basis figures from the service and updates them with the period', async () => {
    const { user, router } = renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    const three = totalsFor(snapshotOf(db()), resolveRange('3m', TODAY), null)
    expect(within(figures()).getByText(usd(three.collectedCents))).toBeInTheDocument()
    expect(within(figures()).getByText(usd(three.expensesPaidCents))).toBeInTheDocument()
    expect(within(figures()).getByText(usd(three.netCashFlowCents))).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: '12M' }))
    await waitFor(() => expect(router.state.location.search).toBe('?range=12m'))
    const year = totalsFor(snapshotOf(db()), resolveRange('12m', TODAY), null)
    expect(await within(figures()).findByText(usd(year.collectedCents))).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /^Property performance/ })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Recent transactions' })).toBeInTheDocument()
    expect(screen.getByText(/Rent for November 2026/)).toBeInTheDocument()
  })

  it('filters by property type and property through the URL', async () => {
    renderApp('/finance?type=commercial')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    const commercial = new Set(db().properties.filter((property) => property.type === 'commercial').map((property) => property.id))
    const totals = totalsFor(snapshotOf(db()), resolveRange('3m', TODAY), commercial)
    expect(within(figures()).getByText(usd(totals.collectedCents))).toBeInTheDocument()
    const rows = within(screen.getByRole('table', { name: /^Property performance/ })).getAllByRole('row').slice(1)
    expect(rows).toHaveLength(commercial.size)
  })

  it('formats every amount in the configured currency', async () => {
    await updateFinanceSettings({ currency: 'EUR', locale: 'de-DE' })
    renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    const text = figures().textContent ?? ''
    expect(text).toContain('€')
    expect(text).not.toContain('$')
  })

  it('never writes to storage while browsing Finance', async () => {
    const before = window.localStorage.getItem(STORAGE_KEYS.demoData)
    const { user } = renderApp('/finance')
    await screen.findByRole('heading', { level: 1, name: 'Finance' })
    await user.click(screen.getByRole('link', { name: 'Transactions' }))
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    await user.click(screen.getByRole('link', { name: 'Receivables' }))
    await screen.findByRole('heading', { level: 1, name: 'Receivables' })
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toBe(before)
  })
})

describe('Transactions', () => {
  it('lists the last three months by default and filters by type, status and search', async () => {
    const { user, router } = renderApp('/finance/transactions')
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    const rows = await getTransactions()
    const expected = filterTransactions(rows, DEFAULT_TRANSACTION_FILTERS, TODAY).length
    expect(screen.getAllByText(`Showing 1–20 of ${expected} records`).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('radio', { name: 'Expenses' }))
    expect(router.state.location.search).toBe('?kind=expense')
    const expenses = filterTransactions(rows, { ...DEFAULT_TRANSACTION_FILTERS, kind: 'expense' }, TODAY).length
    expect(await screen.findAllByText(`Showing 1–20 of ${expenses} records`)).not.toHaveLength(0)

    const overdueBill = rows.find((row) => row.kind === 'expense' && row.status === 'overdue')
    await user.type(screen.getByRole('searchbox', { name: 'Search transactions' }), overdueBill?.reference ?? '')
    const table = screen.getByRole('table', { name: /^Transactions/ })
    await waitFor(() => expect(within(table).getAllByRole('row')).toHaveLength(overdueBill && overdueBill.date >= '2026-08-01' ? 2 : 1))
  })

  it('restores filters from the URL and shows a no-results state with reset', async () => {
    const { user, router } = renderApp('/finance/transactions?kind=income&status=partially-paid&range=all')
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    const rows = await getTransactions()
    const partial = rows.filter((row) => row.kind === 'income' && row.state.status === 'partially-paid')
    const table = screen.getByRole('table', { name: /^Transactions/ })
    expect(within(table).getAllByRole('row').slice(1)).toHaveLength(Math.min(partial.length, 20))
    expect(within(table).getAllByText('Partially paid').length).toBe(Math.min(partial.length, 20))

    await user.type(screen.getByRole('searchbox', { name: 'Search transactions' }), 'zzz-nothing')
    expect((await screen.findAllByText('No records match your filters')).length).toBeGreaterThan(0)
    await user.click(screen.getAllByRole('button', { name: 'Reset filters' })[0] as HTMLElement)
    expect(router.state.location.search).toBe('')
  })
})

describe('Receivables', () => {
  it('shows what tenants owe today, by age', async () => {
    const { user } = renderApp('/finance/receivables')
    await screen.findByRole('heading', { level: 1, name: 'Receivables' })
    const rows = await getReceivables()
    const owing = rows.filter((row) => row.balanceCents > 0)
    const total = owing.reduce((sum, row) => sum + row.balanceCents, 0)
    expect(screen.getByText(formatMoney(total))).toBeInTheDocument()
    expect(screen.getAllByText(`Showing 1–20 of ${owing.length} tenants`).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('switch', { name: 'Only with a balance' }))
    expect(await screen.findAllByText(`Showing 1–20 of ${rows.length} tenants`)).not.toHaveLength(0)
  })
})

describe('Record details', () => {
  const findCharge = (predicate: (charge: Charge, state: ReturnType<typeof chargeState>) => boolean) => {
    const payments = paymentsByCharge(db().payments)
    return db().charges.find((charge) => predicate(charge, chargeState(charge, payments.get(charge.id), TODAY))) as Charge
  }

  it('shows a partially paid, overdue rent charge with its payments and the late-fee rule', async () => {
    const charge = findCharge((entry, state) => entry.category === 'rent' && state.status === 'partially-paid' && state.daysOverdue > 5)
    renderApp(`/finance/transactions/${charge.id}`)
    expect(await screen.findByRole('heading', { level: 1, name: charge.reference })).toBeInTheDocument()
    expect(screen.getByText(/^Overdue by \d+ days$/)).toBeInTheDocument()
    expect(screen.getAllByText('Partially paid').length).toBeGreaterThan(0)
    const payments = db().payments.filter((payment) => payment.chargeId === charge.id)
    expect(within(screen.getByRole('table')).getAllByRole('row').slice(1)).toHaveLength(payments.length)
    expect(screen.getByText(/Residential: a fixed \$50\.00 per late rent charge\. Commercial: 5% of the full rent charge \(not the unpaid balance\)/)).toBeInTheDocument()
    expect(screen.getAllByText('Demo').length).toBeGreaterThan(0)
  })

  it('explains a charge voided by hand', async () => {
    const charge = findCharge((entry) => entry.voidedBy === 'user')
    renderApp(`/finance/transactions/${charge.id}`)
    await screen.findByRole('heading', { level: 1, name: charge.reference })
    expect(screen.getByText('Voided')).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(charge.voidReason ?? 'x')).length).toBeGreaterThan(0)
  })

  it('shows a work-order bill as locked to its work order', async () => {
    const bill = db().expenses.find((expense) => expense.source === 'work-order') ?? null
    if (!bill) throw new Error('no bill')
    renderApp(`/finance/transactions/${bill.id}`)
    await screen.findByRole('heading', { level: 1, name: bill.reference })
    expect(screen.getByText('Amount set by the work order')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: new RegExp(bill.requestId ?? 'MR') })).toHaveAttribute('href', `/maintenance/${bill.requestId}`)
    const vendor = db().vendors.find((entry) => entry.id === bill.vendorId)
    expect(screen.getByRole('link', { name: vendor?.name })).toHaveAttribute('href', `/vendors/${vendor?.id}`)
  })

  it('shows a not-found state for an unknown record', async () => {
    renderApp('/finance/transactions/chg_missing')
    expect(await screen.findByRole('heading', { name: /transaction not found/i })).toBeInTheDocument()
  })
})
