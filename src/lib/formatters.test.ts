import { downloadTextFile } from '@/lib/download'
import {
  formatCurrency,
  formatDate,
  formatMoney,
  formatMonth,
  formatNumber,
  formatPercent,
  formatShortDate,
  formatTime,
} from '@/lib/format'
import { createFormatters, DEFAULT_FORMAT } from '@/lib/formatters'
import { symbolPadding } from '@/lib/symbol-padding'

const CENTS = [0, 1, 99, 100, 125050, -125050, 99999999, 5]
const AMOUNTS = [0, 1, 1850, 148250, 1234567, 0.4, 2400.5]
const DATES = ['2026-01-01', '2026-10-24', '2026-12-31', '2024-02-29']
const TIMES = ['2026-10-24T09:30:00', '2026-10-24T00:05:00', '2026-10-24T23:59:00']
const PERCENTS: Array<[number, number | undefined]> = [
  [92.4, undefined],
  [100, 1],
  [0, 0],
  [12.345, 1],
  [12.35, 1],
  [-5, 1],
  [66.666, 0],
]

describe('createFormatters at the defaults (USD, en-US)', () => {
  const format = createFormatters(DEFAULT_FORMAT)

  it('matches the fixed helpers exactly', () => {
    for (const cents of CENTS) {
      expect(format.money(cents)).toBe(formatMoney(cents))
      expect(format.money(cents, { compact: true })).toBe(formatMoney(cents, undefined, { compact: true }))
      expect(format.money(cents, { whole: true })).toBe(formatMoney(cents, undefined, { whole: true }))
    }
    for (const value of AMOUNTS) {
      expect(format.amount(value)).toBe(formatCurrency(value))
      expect(format.amount(value, { compact: true })).toBe(formatCurrency(value, { compact: true }))
      expect(format.number(value)).toBe(formatNumber(value))
    }
    for (const iso of DATES) {
      expect(format.date(iso)).toBe(formatDate(iso))
      expect(format.shortDate(iso)).toBe(formatShortDate(iso))
      expect(format.month(iso.slice(0, 7))).toBe(formatMonth(iso.slice(0, 7)))
      expect(format.month(iso.slice(0, 7), 'long')).toBe(formatMonth(iso.slice(0, 7), 'long'))
    }
    for (const iso of TIMES) {
      expect(format.time(iso)).toBe(formatTime(iso))
      expect(format.dateTime(iso)).toBe(new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }))
    }
    for (const [value, digits] of PERCENTS) expect(format.percent(value, digits)).toBe(formatPercent(value, digits))
    expect(format.symbol).toBe('$')
    expect(format.longDate('2026-10-24')).toBe('October 24, 2026')
  })

  it('returns the same object for the same settings', () => {
    expect(createFormatters({ currency: 'USD', locale: 'en-US' })).toBe(format)
    expect(createFormatters({ currency: 'EUR', locale: 'en-US' })).not.toBe(format)
  })
})

describe('createFormatters with other settings', () => {
  it('applies the currency (relabelled, same amounts)', () => {
    const eur = createFormatters({ currency: 'EUR', locale: 'en-US' })
    expect(eur.money(125050)).toBe('€1,250.50')
    expect(eur.amount(1850)).toBe('€1,850')
    expect(eur.symbol).toBe('€')
  })

  it('applies the region to numbers, dates and times; words stay English', () => {
    const gb = createFormatters({ currency: 'GBP', locale: 'en-GB' })
    expect(gb.money(125050)).toBe('£1,250.50')
    expect(gb.date('2026-10-24')).toBe('24 Oct 2026')
    expect(gb.longDate('2026-10-24')).toBe('24 October 2026')
    expect(gb.month('2026-10', 'long')).toBe('October 2026')
    expect(gb.time('2026-10-24T21:30:00')).toBe('21:30')

    const za = createFormatters({ currency: 'ZAR', locale: 'en-ZA' })
    expect(za.number(1234567.5)).toMatch(/^1\s234\s567,5$/)
    expect(za.percent(12.5)).toBe('12,5%')

    const india = createFormatters({ currency: 'INR', locale: 'en-IN' })
    expect(india.number(1234567)).toBe('12,34,567')
    expect(india.money(12345678)).toBe('₹1,23,456.78')
  })

  it('pads currency inputs for longer symbols only', () => {
    expect(symbolPadding('$', 'pl-8')).toBe('pl-8')
    expect(symbolPadding('CA$', 'pl-8')).toBe('pl-12')
    expect(symbolPadding('R$', 'pl-7')).toBe('pl-10')
  })
})

describe('downloadTextFile', () => {
  it('downloads the text as a named file and releases it afterwards', () => {
    vi.useFakeTimers()
    const created: Blob[] = []
    const createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob)
      return 'blob:propwise-test'
    })
    const revokeObjectURL = vi.fn()
    Object.assign(URL, { createObjectURL, revokeObjectURL })
    const clicks: HTMLAnchorElement[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this)
    })

    downloadTextFile('propwise-backup.json', '{"a":1}')

    expect(clicks).toHaveLength(1)
    expect(clicks[0]?.download).toBe('propwise-backup.json')
    expect(clicks[0]?.href).toBe('blob:propwise-test')
    expect(document.querySelector('a[download]')).toBeNull() // removed after the click
    expect(created[0]?.type).toBe('application/json;charset=utf-8')
    expect(created[0]?.size).toBe(7)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1000)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:propwise-test')
    vi.useRealTimers()
    vi.restoreAllMocks()
  })
})
