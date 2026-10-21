import { data, type LoaderFunctionArgs } from 'react-router'

import { getAssignableUnits, getTenantDetail, getTenants } from '@/data/services'

export async function tenantsLoader() {
  return { tenants: await getTenants() }
}

export async function tenantDetailLoader({ params }: LoaderFunctionArgs) {
  const detail = params.tenantId ? await getTenantDetail(params.tenantId) : null
  if (!detail) throw data('Tenant not found', { status: 404 })
  return detail
}

export async function tenantCreateLoader() {
  return { assignable: await getAssignableUnits() }
}

export async function tenantEditLoader(args: LoaderFunctionArgs) {
  const detail = await tenantDetailLoader(args)
  const current = detail.lease && (detail.lease.status === 'active' || detail.lease.status === 'pending') ? detail.lease : null
  return { detail, assignable: await getAssignableUnits(current?.id) }
}
