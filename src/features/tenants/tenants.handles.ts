import { type RouteHandle } from '@/app/routes/route-handle'

const PARENT = { label: 'Tenants', to: '/tenants' }

function tenantName(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const source = 'detail' in data ? (data as { detail: unknown }).detail : data
  if (typeof source !== 'object' || source === null || !('tenant' in source)) return undefined
  const { tenant } = source as { tenant: unknown }
  if (typeof tenant !== 'object' || tenant === null || !('name' in tenant)) return undefined
  const { name } = tenant as { name: unknown }
  return typeof name === 'string' ? name : undefined
}

/** Breadcrumb and document-title metadata for tenant routes. */
export const tenantHandles = {
  create: { title: 'Add tenant', section: 'Main', parent: PARENT },
  detail: { title: 'Tenant', section: 'Main', parent: PARENT, resolveTitle: tenantName },
  edit: {
    title: 'Edit tenant',
    section: 'Main',
    parent: PARENT,
    resolveTitle: (data) => {
      const name = tenantName(data)
      return name ? `Edit ${name}` : undefined
    },
  },
} satisfies Record<string, RouteHandle>
