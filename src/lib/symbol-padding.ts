/**
 * Left padding for an input with a currency symbol prefix: one-character
 * symbols ("$", "€") keep the original padding; longer ones ("CA$", "CHF")
 * get room so the value never sits under the symbol.
 */
export function symbolPadding(symbol: string, single: string): string {
  if (symbol.length <= 1) return single
  return symbol.length === 2 ? 'pl-10' : 'pl-12'
}
