import { type RouteHandle } from '@/app/routes/route-handle'

const PARENT = { label: 'Finance', to: '/finance' }

function reference(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const record = 'charge' in data ? (data as { charge: unknown }).charge : 'expense' in data ? (data as { expense: unknown }).expense : null
  if (typeof record !== 'object' || record === null || !('reference' in record)) return undefined
  const value = (record as { reference: unknown }).reference
  return typeof value === 'string' ? value : undefined
}

/** Breadcrumb and document-title metadata for Finance routes. */
export const financeHandles = {
  transactions: { title: 'Transactions', section: 'Main', parent: PARENT },
  receivables: { title: 'Receivables', section: 'Main', parent: PARENT },
  newIncome: { title: 'Add income', section: 'Main', parent: PARENT },
  newExpense: { title: 'Add bill', section: 'Main', parent: PARENT },
  edit: {
    title: 'Edit transaction',
    section: 'Main',
    parent: { label: 'Transactions', to: '/finance/transactions' },
    resolveTitle: (data: unknown) => {
      const detail = typeof data === 'object' && data !== null && 'detail' in data ? (data as { detail: unknown }).detail : null
      const ref = reference(detail)
      return ref ? `Edit ${ref}` : undefined
    },
  },
  detail: { title: 'Transaction', section: 'Main', parent: { label: 'Transactions', to: '/finance/transactions' }, resolveTitle: reference },
} satisfies Record<string, RouteHandle>
