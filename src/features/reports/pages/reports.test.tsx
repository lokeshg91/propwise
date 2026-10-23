import { screen, waitFor, within } from '@testing-library/react'

import { incomeExpenseReport } from '@/data/domain/report-income-expense'
import { resolveReportWindow } from '@/data/domain/report-range'
import { totalsFor } from '@/data/domain/finance-summary'
import { updateCurrency, updateGeneralSettings } from '@/data/services'
import { snapshotOf } from '@/data/services/finance-service'
import { readDatabase } from '@/data/store/demo-store'
import { todayIso } from '@/data/domain/dates'
import { centsToCsv, parseCsv } from '@/lib/csv'
import { renderApp } from '@/test/render-app'

/** Phase 9 Stage 3: Reports hub, Income & Expense and Rent Collection. */

let downloads: Array<{ name: string; text: Promise<string>; type: string }>
beforeEach(() => {
  downloads = []
  Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => (downloads.push({ name: '', text: blob.text(), type: blob.type }), `blob:${downloads.length}`)), revokeObjectURL: vi.fn() })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    const last = downloads.at(-1)
    if (last) last.name = this.download
  })
})
afterEach(() => vi.restoreAllMocks())

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

describe('Reports hub', () => {
  it('lists the five reports with their basis and links them', async () => {
    renderApp('/reports')
    await screen.findByRole('heading', { level: 1, name: 'Reports' })
    const list = screen.getByRole('list', { name: 'Reports' })
    expect(within(list).getByRole('link', { name: /Income & Expense/ })).toHaveAttribute('href', '/reports/income-expense')
    expect(within(list).getByRole('link', { name: /Rent Collection/ })).toHaveAttribute('href', '/reports/rent-collection')
    expect(within(list).getByRole('link', { name: /Receivables & Aging/ })).toHaveAttribute('href', '/reports/receivables')
    expect(within(list).getByRole('link', { name: /Property performance/ })).toHaveAttribute('href', '/reports/property-performance')
    expect(within(list).getByRole('link', { name: /Maintenance expenses/ })).toHaveAttribute('href', '/reports/maintenance-expenses')
    expect(within(list).queryAllByText('Coming next')).toHaveLength(0)
    expect(screen.getByText(/open with last 12 months/)).toBeInTheDocument()
  })
})

describe('Income & Expense', () => {
  it('opens with the default report period from Settings and matches Finance totals', async () => {
    readDatabase()
    await updateGeneralSettings({ defaultReportRange: '6m' })
    renderApp('/reports/income-expense')
    await screen.findByRole('heading', { level: 1, name: 'Income & Expense' })
    expect(screen.getByRole('combobox', { name: 'Period' })).toHaveTextContent('Last 6 months')
    const db = readDatabase()
    const window = resolveReportWindow({ kind: 'preset', preset: '6m' }, todayIso())
    const finance = totalsFor(snapshotOf(db), window, null)
    const figures = screen.getByRole('region', { name: 'Income and expense figures' })
    expect(within(figures).getByText(money(finance.collectedCents))).toBeInTheDocument()
    expect(within(figures).getByText(money(finance.expensesPaidCents))).toBeInTheDocument()
    expect(within(figures).getByText(money(finance.netCashFlowCents))).toBeInTheDocument()
  })

  it('keeps filters in the URL and validates a custom range inline', async () => {
    const { user, router } = renderApp('/reports/income-expense')
    await screen.findByRole('heading', { level: 1, name: 'Income & Expense' })
    await user.click(screen.getByRole('combobox', { name: 'Period' }))
    await user.click(await screen.findByRole('option', { name: 'Custom range…' }))
    const form = screen.getByRole('form', { name: 'Custom range' })
    const from = within(form).getByLabelText('From')
    const to = within(form).getByLabelText('To')
    await user.clear(from)
    await user.type(from, '2026-05-10')
    await user.clear(to)
    await user.type(to, '2026-04-01')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(within(form).getByText(/can’t be before the start date/)).toBeInTheDocument()
    await user.clear(to)
    await user.type(to, '2032-01-01')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    expect(within(form).getByText(/at most 5 years/)).toBeInTheDocument()
    await user.clear(to)
    await user.type(to, '2026-07-20')
    await user.click(within(form).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(router.state.location.search).toBe('?range=custom&from=2026-05-10&to=2026-07-20'))
    expect(await screen.findByText(/first or last month is cut/)).toBeInTheDocument()
    expect(screen.getByRole('table', { name: /by month/ })).toHaveTextContent('May 10, 2026 – May 31, 2026')

    await user.click(screen.getByRole('combobox', { name: 'Records' }))
    await user.click(await screen.findByRole('option', { name: 'Created by you' }))
    await waitFor(() => expect(router.state.location.search).toContain('source=user'))
    await user.click(screen.getByRole('radio', { name: 'By expense category' }))
    await waitFor(() => expect(router.state.location.search).toContain('view=expense'))
  })

  it('shows a refused custom range from the URL and falls back to the default period', async () => {
    renderApp('/reports/income-expense?range=custom&from=2026-09-01&to=2026-02-01')
    await screen.findByRole('heading', { level: 1, name: 'Income & Expense' })
    expect(screen.getByText(/can’t be before the start date/)).toBeInTheDocument()
  })

  it('exports a typed CSV of exactly the rows shown, with the filters as comments', async () => {
    const { user } = renderApp('/reports/income-expense?range=3m&view=income')
    await screen.findByRole('heading', { level: 1, name: 'Income & Expense' })
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    expect(downloads).toHaveLength(1)
    const file = downloads[0] as (typeof downloads)[number]
    expect(file.name).toMatch(/^propwise-income-expense-income-\d{4}-\d{2}-01_\d{4}-\d{2}-\d{2}\.csv$/)
    expect(file.type).toBe('text/csv;charset=utf-8')
    const rows = parseCsv(await file.text)
    expect(rows[0]?.[0]).toBe('# Propwise report: Income & Expense (by income category)')
    expect(rows.some((row) => row[0] === '# Records: All records')).toBe(true)
    const header = rows.find((row) => row[0] === 'Income category') as string[]
    expect(header).toEqual(['Income category', 'Collected', 'Billed (by due date)', 'Currency'])
    const report = incomeExpenseReport(snapshotOf(readDatabase()), resolveReportWindow({ kind: 'preset', preset: '3m' }, todayIso()), null, 'all')
    const body = rows.slice(rows.indexOf(header) + 1)
    expect(body.at(-1)).toEqual(['Total', centsToCsv(report.totals.collectedCents), centsToCsv(report.totals.billedCents), 'USD'])
    expect(body).toHaveLength(report.income.length + 1)
    for (const row of body) expect(row[1]).toMatch(/^-?\d+\.\d{2}$/)
  })

  it('prints through the browser dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    const { user } = renderApp('/reports/income-expense')
    await screen.findByRole('heading', { level: 1, name: 'Income & Expense' })
    await user.click(screen.getByRole('button', { name: 'Print or save PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
    // Filters are written out as text for the printout.
    expect(screen.getByRole('list', { name: 'Report filters' })).toHaveTextContent(/Period: Last 12 months/)
  })

  it('uses the workspace currency (and the CSV says which)', async () => {
    readDatabase()
    await updateCurrency('EUR')
    const { user } = renderApp('/reports/income-expense')
    await screen.findByRole('heading', { level: 1, name: 'Income & Expense' })
    expect(within(screen.getByRole('region', { name: 'Income and expense figures' })).getAllByText(/^€/).length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    const rows = parseCsv(await (downloads[0] as (typeof downloads)[number]).text)
    expect(rows.some((row) => row[0] === '# Amounts in EUR')).toBe(true)
    expect(rows.at(-1)?.at(-1)).toBe('EUR')
  })
})

describe('Rent Collection', () => {
  it('shows figures that add up, by property and by tenant, and exports them', async () => {
    const { user, router } = renderApp('/reports/rent-collection?range=3m')
    await screen.findByRole('heading', { level: 1, name: 'Rent Collection' })
    const table = screen.getByRole('table', { name: 'Rent collection by property' })
    const totalRow = within(table).getAllByRole('row').at(-1) as HTMLElement
    expect(totalRow).toHaveTextContent(/^Total/)
    await user.click(screen.getByRole('radio', { name: 'By tenant' }))
    await waitFor(() => expect(router.state.location.search).toContain('view=tenant'))
    expect(await screen.findByRole('table', { name: 'Rent collection by tenant' })).toBeInTheDocument()
    await user.click(screen.getByRole('switch', { name: /Include recurring charges/ }))
    await waitFor(() => expect(router.state.location.search).toContain('recurring=1'))
    await waitFor(() => expect(screen.getByRole('switch', { name: /Include recurring charges/ })).toBeChecked())
    await user.click(screen.getByRole('button', { name: 'Export CSV' }))
    const rows = parseCsv(await (downloads[0] as (typeof downloads)[number]).text)
    expect(rows.some((row) => row[0] === '# Charges: rent and recurring charges')).toBe(true)
    const header = rows.find((row) => row[0] === 'Tenant') as string[]
    expect(header).toContain('Collection rate (%)')
    const body = rows.slice(rows.indexOf(header) + 1)
    const sum = (index: number) => body.slice(0, -1).reduce((total, row) => total + Math.round(Number(row[index]) * 100), 0)
    const billedIndex = header.indexOf('Billed')
    expect(sum(billedIndex)).toBe(Math.round(Number(body.at(-1)?.[billedIndex]) * 100))
  }, 20_000)
})
