import { screen, waitFor, within } from '@testing-library/react'

import { receivablesFor, totalsFor } from '@/data/domain/finance-summary'
import { resolveReportWindow } from '@/data/domain/report-range'
import { todayIso } from '@/data/domain/dates'
import { snapshotOf } from '@/data/services/finance-service'
import { readDatabase } from '@/data/store/demo-store'
import { filterTransactions, parseTransactionFilters, DEFAULT_TRANSACTION_FILTERS } from '@/features/finance/lib/transaction-list'
import { centsToCsv, parseCsv } from '@/lib/csv'
import { renderApp } from '@/test/render-app'

/** Phase 9 Stage 4: Receivables & Aging, Property performance, Maintenance expenses, Transactions custom range. */

let downloads: Array<{ name: string; text: Promise<string> }>
beforeEach(() => {
  downloads = []
  Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => (downloads.push({ name: '', text: blob.text() }), `blob:${downloads.length}`)), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const last = downloads.at(-1)
    if (last) last.name = this.download
  })
})
afterEach(() => vi.restoreAllMocks())

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

describe('Receivables & Aging', () => {
  it('has no period, shows six buckets and a due part equal to Finance', async () => {
    const { user } = renderApp('/reports/receivables')
    await screen.findByRole('heading', { level: 1, name: 'Receivables & Aging' })
    expect(screen.queryByRole('combobox', { name: 'Period' })).toBeNull()
    const buckets = screen.getByLabelText('Aging buckets')
    for (const label of ['Not yet due', 'Due today', '1–30 days', '31–60 days', '61–90 days', '90+ days']) expect(within(buckets).getByText(label)).toBeInTheDocument()
    const finance = receivablesFor(snapshotOf(readDatabase()), todayIso(), null)
    expect(within(screen.getByRole('region', { name: 'Receivables figures' })).getAllByText(money(finance.outstandingCents)).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    const rows = parseCsv(await (downloads[0] as (typeof downloads)[number]).text)
    expect(downloads[0]?.name).toMatch(/^propwise-receivables-tenant-\d{4}-\d{2}-\d{2}\.csv$/)
    const header = rows.find((row) => row[0] === 'Tenant or payer') as string[]
    expect(header).toEqual(['Tenant or payer', 'Property and unit', 'Open charges', 'Not yet due', 'Due today', '1–30 days', '31–60 days', '61–90 days', '90+ days', 'Total open', 'Oldest due date', 'Currency'])
    const total = rows.at(-1) as string[]
    const cents = (index: number) => Math.round(Number(total[index]) * 100)
    expect(cents(3) + cents(4) + cents(5) + cents(6) + cents(7) + cents(8)).toBe(cents(9))
    expect(cents(4) + cents(5) + cents(6) + cents(7) + cents(8)).toBe(finance.outstandingCents)
  })
})

describe('Property performance', () => {
  it('shows a row per property and totals equal to Finance', async () => {
    renderApp('/reports/property-performance?range=12m')
    await screen.findByRole('heading', { level: 1, name: 'Property performance' })
    const table = screen.getByRole('table', { name: 'Property performance by property' })
    const db = readDatabase()
    expect(within(table).getAllByRole('row')).toHaveLength(db.properties.length + 2)
    const totals = totalsFor(snapshotOf(db), resolveReportWindow({ kind: 'preset', preset: '12m' }, todayIso()), null)
    const totalRow = within(table).getAllByRole('row').at(-1) as HTMLElement
    expect(totalRow).toHaveTextContent(money(totals.collectedCents))
    expect(totalRow).toHaveTextContent(money(totals.netCashFlowCents))
  })
})

describe('Maintenance expenses', () => {
  it('switches basis and grouping in the URL and exports the bills total', async () => {
    const { user, router } = renderApp('/reports/maintenance-expenses?range=12m')
    await screen.findByRole('heading', { level: 1, name: 'Maintenance expenses' })
    expect(screen.getByText('Completed without a final cost')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'Incurred' }))
    await waitFor(() => expect(router.state.location.search).toContain('basis=incurred'))
    await user.click(screen.getByRole('radio', { name: 'By request category' }))
    await waitFor(() => expect(router.state.location.search).toContain('view=category'))
    expect(await screen.findByRole('table', { name: /by request category/ })).toHaveTextContent('Not linked to a request')
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    const rows = parseCsv(await (downloads[0] as (typeof downloads)[number]).text)
    expect(rows.some((row) => row[0] === '# Basis: Incurred (by bill date)')).toBe(true)
    const db = readDatabase()
    const window = resolveReportWindow({ kind: 'preset', preset: '12m' }, todayIso())
    const expected = db.expenses
      .filter((bill) => !bill.voidedAt && (bill.source === 'work-order' || bill.category === 'maintenance') && bill.billDate >= window.from && bill.billDate <= window.to)
      .reduce((total, bill) => total + bill.amountCents, 0)
    expect(rows.at(-1)?.[2]).toBe(centsToCsv(expected))
  })
})

describe('Transactions custom range', () => {
  it('parses a valid custom range and filters by it; an invalid one falls back to the default', () => {
    const filters = parseTransactionFilters(new URLSearchParams('range=custom&from=2026-09-01&to=2026-09-30'))
    expect(filters).toMatchObject({ range: 'custom', from: '2026-09-01', to: '2026-09-30' })
    expect(parseTransactionFilters(new URLSearchParams('range=custom&from=2026-09-30&to=2026-09-01'))).toMatchObject({ range: DEFAULT_TRANSACTION_FILTERS.range, from: '', to: '' })
    expect(parseTransactionFilters(new URLSearchParams('range=custom&from=2020-01-01&to=2026-01-01')).range).toBe(DEFAULT_TRANSACTION_FILTERS.range)
  })

  it('applies a custom range from the date filter, kept in the URL', async () => {
    const { user, router } = renderApp('/finance/transactions')
    await screen.findByRole('heading', { level: 1, name: 'Transactions' })
    await user.click(screen.getByRole('combobox', { name: 'Filter by date' }))
    await user.click(await screen.findByRole('option', { name: 'Custom range…' }))
    const form = screen.getByRole('form', { name: 'Custom range' })
    await user.clear(within(form).getByLabelText('From'))
    await user.type(within(form).getByLabelText('From'), '2026-09-01')
    await user.clear(within(form).getByLabelText('To'))
    await user.type(within(form).getByLabelText('To'), '2026-08-01')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(within(form).getByText(/can’t be before the start date/)).toBeInTheDocument()
    await user.clear(within(form).getByLabelText('To'))
    await user.type(within(form).getByLabelText('To'), '2026-09-30')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(router.state.location.search).toBe('?range=custom&from=2026-09-01&to=2026-09-30'))
    const rows = await import('@/data/services').then((services) => services.getTransactions())
    const expected = filterTransactions(rows, { ...DEFAULT_TRANSACTION_FILTERS, range: 'custom', from: '2026-09-01', to: '2026-09-30' }, todayIso())
    expect(expected.every((row) => row.date >= '2026-09-01' && row.date <= '2026-09-30')).toBe(true)
    expect(within(screen.getByLabelText('Totals for the filtered records')).getByText(new Intl.NumberFormat('en-US').format(expected.length))).toBeInTheDocument()
  }, 20_000)
})
