import { data, type LoaderFunctionArgs } from 'react-router'

import { getProperties, getPropertyDetail, getPropertyFinance } from '@/data/services'

export async function propertiesLoader() {
  return { properties: await getProperties() }
}

export async function propertyDetailLoader({ params }: LoaderFunctionArgs) {
  const detail = params.propertyId ? await getPropertyDetail(params.propertyId) : null
  if (!detail) {
    throw data('Property not found', { status: 404 })
  }
  return detail
}

/** Property details plus its Finance tab (12 months, cash basis). */
export async function propertyDetailsLoader(args: LoaderFunctionArgs) {
  const detail = await propertyDetailLoader(args)
  return { ...detail, finance: await getPropertyFinance(detail.property.id, '12m') }
}
