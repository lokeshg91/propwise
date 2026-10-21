import { data, type LoaderFunctionArgs } from 'react-router'

import { getProperties, getPropertyDetail } from '@/data/services'

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
