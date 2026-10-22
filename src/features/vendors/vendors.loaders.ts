import { data, type LoaderFunctionArgs } from 'react-router'

import { getVendorDetail, getVendorList } from '@/data/services'

export async function vendorsLoader() {
  return { vendors: await getVendorList() }
}

export async function vendorDetailLoader({ params }: LoaderFunctionArgs) {
  const detail = params.vendorId ? await getVendorDetail(params.vendorId) : null
  if (!detail) throw data('Vendor not found', { status: 404 })
  return detail
}
