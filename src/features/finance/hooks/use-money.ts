import { useFormat } from '@/hooks/use-format'

/** Formats cents in the workspace currency, e.g. `money(125050)` → "$1,250.50". */
export function useMoney() {
  return useFormat().money
}
