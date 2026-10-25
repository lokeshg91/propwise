import { data, type LoaderFunctionArgs } from 'react-router'

import { getStaffDetail, getStaffList, getStaffPropertyOptions } from '@/data/services'

export async function staffListLoader() {
  const [staff, properties] = await Promise.all([getStaffList(), getStaffPropertyOptions()])
  return { staff, properties }
}

export async function staffDetailLoader({ params }: LoaderFunctionArgs) {
  const detail = params.staffId ? await getStaffDetail(params.staffId) : null
  if (!detail) throw data('Staff member not found', { status: 404 })
  return detail
}

/** Edit form: the member and the properties they can be assigned to. */
export async function staffEditLoader(args: LoaderFunctionArgs) {
  const [detail, properties] = await Promise.all([staffDetailLoader(args), getStaffPropertyOptions()])
  return { ...detail, propertyOptions: properties }
}

export async function staffCreateLoader() {
  return { propertyOptions: await getStaffPropertyOptions() }
}
