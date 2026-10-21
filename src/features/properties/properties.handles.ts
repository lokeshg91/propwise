import { type RouteHandle } from '@/app/routes/route-handle'

const PARENT = { label: 'Properties', to: '/properties' }

function propertyName(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('property' in data)) return undefined
  const { property } = data as { property: unknown }
  if (typeof property !== 'object' || property === null || !('name' in property)) return undefined
  const { name } = property as { name: unknown }
  return typeof name === 'string' ? name : undefined
}

/** Breadcrumb and document-title metadata for property routes. */
export const propertyHandles = {
  create: { title: 'Add property', section: 'Main', parent: PARENT },
  detail: { title: 'Property', section: 'Main', parent: PARENT, resolveTitle: propertyName },
  edit: {
    title: 'Edit property',
    section: 'Main',
    parent: PARENT,
    resolveTitle: (data) => {
      const name = propertyName(data)
      return name ? `Edit ${name}` : undefined
    },
  },
} satisfies Record<string, RouteHandle>
