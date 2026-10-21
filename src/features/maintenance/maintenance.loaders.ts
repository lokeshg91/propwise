import { data, type LoaderFunctionArgs } from 'react-router'

import { getProperties, getRequestFormOptions, getServiceRequestDetail, getServiceRequests, getVendors } from '@/data/services'

export async function maintenanceLoader() {
  const [requests, properties] = await Promise.all([getServiceRequests(), getProperties()])
  return { requests, properties: properties.map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)) }
}

export async function requestDetailLoader({ params }: LoaderFunctionArgs) {
  const [detail, vendors] = await Promise.all([params.requestId ? getServiceRequestDetail(params.requestId) : null, getVendors()])
  if (!detail) throw data('Request not found', { status: 404 })
  // Vendors for the assign and reassign dialogs.
  return { ...detail, vendorsForActions: vendors }
}

export async function requestCreateLoader() {
  return { options: await getRequestFormOptions() }
}

export async function requestEditLoader(args: LoaderFunctionArgs) {
  const [detail, options] = await Promise.all([requestDetailLoader(args), getRequestFormOptions()])
  return { detail, options }
}
