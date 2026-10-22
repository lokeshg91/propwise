/**
 * Money helpers. Finance amounts are integer minor units ("cents"); sums stay
 * exact because only integers are added. Dollar values from other modules
 * (lease rent, work-order costs) are converted once, at the boundary.
 */

/** Largest amount accepted for a single record: 10,000,000.00. */
export const MAX_CENTS = 1_000_000_000

/** Converts a major-unit amount (e.g. dollars) to integer cents, rounding half away from zero. */
export function toCents(amount: number): number {
  if (!Number.isFinite(amount)) throw new RangeError('Amount must be a finite number.')
  const sign = amount < 0 ? -1 : 1
  // Rounding the 6-decimal string avoids binary noise such as 1.005 → 100.49999.
  return sign * Math.round(Number((Math.abs(amount) * 100).toFixed(6)))
}

/** Major units for display and for inputs, e.g. 125050 → 1250.5. */
export function fromCents(cents: number): number {
  return cents / 100
}

export function isValidCents(value: unknown, { min = 1, max = MAX_CENTS }: { min?: number; max?: number } = {}): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
}

export function sumCents(values: Iterable<number>): number {
  let total = 0
  for (const value of values) total += value
  return total
}

/** Rounds a cents amount times a percentage, e.g. 5 % of 185000 → 9250. */
export function percentOfCents(cents: number, percent: number): number {
  return Math.round((cents * percent) / 100)
}

/** `part / whole` as a percentage with one decimal, or null when `whole` is 0. */
export function ratioPercent(part: number, whole: number): number | null {
  if (whole === 0) return null
  return Math.round((part / whole) * 1000) / 10
}

/** Number of minor digits a currency uses, e.g. USD 2, JPY 0. */
export function currencyMinorDigits(currency: string): number {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits ?? 2
}

/** Finance stores cents, so v0.8 supports currencies with two minor digits. */
export function isSupportedCurrency(currency: string): boolean {
  try {
    return /^[A-Z]{3}$/.test(currency) && currencyMinorDigits(currency) === 2
  } catch {
    return false
  }
}

/**
 * Parses an amount typed by a person ("1,250.5", "1250.50", " 75 ") into
 * cents. Returns null for anything that isn't a positive amount with at most
 * two decimals. Grouping commas are ignored; other symbols are rejected.
 */
export function parseMoneyInput(value: string): number | null {
  const text = value.trim().replace(/,/g, '')
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null
  const [whole, fraction = ''] = text.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

/** Cents as an editable string, e.g. 125050 → "1250.50". */
export const centsToInput = (cents: number): string => (cents / 100).toFixed(2)
