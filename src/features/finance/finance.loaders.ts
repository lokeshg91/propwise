import { data, type LoaderFunctionArgs, redirect } from 'react-router'

import { getFinanceFormOptions, getFinanceOverview, getFinanceSettings, getProperties, getReceivables, getTransactionDetail, getTransactions } from '@/data/services'
import { parseOverviewFilters, toServiceFilters } from '@/features/finance/lib/finance-filters'

/** Currency settings for every Finance page. */
export async function financeLayoutLoader() {
  return { settings: await getFinanceSettings() }
}

export interface PropertyOption {
  id: string
  name: string
  type: 'residential' | 'commercial'
}

const propertyOptions = async (): Promise<PropertyOption[]> =>
  (await getProperties()).map((property) => ({ id: property.id, name: property.name, type: property.type })).sort((a, b) => a.name.localeCompare(b.name))

export async function financeOverviewLoader({ request }: LoaderFunctionArgs) {
  const filters = parseOverviewFilters(new URL(request.url).searchParams)
  const [overview, properties] = await Promise.all([getFinanceOverview(toServiceFilters(filters)), propertyOptions()])
  return { overview, properties }
}

export async function transactionsLoader() {
  const [rows, properties] = await Promise.all([getTransactions(), propertyOptions()])
  return { rows, properties }
}

export async function receivablesLoader() {
  const [rows, properties] = await Promise.all([getReceivables(), propertyOptions()])
  return { rows, properties }
}

export async function transactionDetailLoader({ params }: LoaderFunctionArgs) {
  const detail = params.transactionId ? await getTransactionDetail(params.transactionId) : null
  if (!detail) throw data('Transaction not found', { status: 404 })
  return detail
}

export async function financeFormLoader() {
  return getFinanceFormOptions()
}

/** Only records added by hand can be edited; anything else goes back to its detail page. */
export async function transactionEditLoader({ params }: LoaderFunctionArgs) {
  const id = params.transactionId ?? ''
  const [detail, options] = await Promise.all([getTransactionDetail(id), getFinanceFormOptions()])
  if (!detail) throw data('Transaction not found', { status: 404 })
  const editable = detail.kind === 'income' ? detail.charge.source === 'manual' && !detail.charge.voidedAt : detail.expense.source !== 'work-order' && !detail.expense.voidedAt
  if (!editable) throw redirect(`/finance/transactions/${id}`)
  return { detail, options }
}
