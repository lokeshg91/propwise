import { type RouteHandle } from '@/app/routes/route-handle'

const PARENT = { label: 'Vendors', to: '/vendors' }

function vendorName(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('vendor' in data)) return undefined
  const { vendor } = data as { vendor: unknown }
  if (typeof vendor !== 'object' || vendor === null || !('name' in vendor)) return undefined
  const { name } = vendor as { name: unknown }
  return typeof name === 'string' ? name : undefined
}

/** Breadcrumb and document-title metadata for vendor routes. */
export const vendorHandles = {
  create: { title: 'Add vendor', section: 'Main', parent: PARENT },
  detail: { title: 'Vendor', section: 'Main', parent: PARENT, resolveTitle: vendorName },
  edit: {
    title: 'Edit vendor',
    section: 'Main',
    parent: PARENT,
    resolveTitle: (data) => {
      const name = vendorName(data)
      return name ? `Edit ${name}` : undefined
    },
  },
} satisfies Record<string, RouteHandle>
