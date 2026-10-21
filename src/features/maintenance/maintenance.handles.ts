import { type RouteHandle } from '@/app/routes/route-handle'

const PARENT = { label: 'Maintenance', to: '/maintenance' }

function requestTitle(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const source = 'detail' in data ? (data as { detail: unknown }).detail : data
  if (typeof source !== 'object' || source === null || !('request' in source)) return undefined
  const { request } = source as { request: unknown }
  if (typeof request !== 'object' || request === null || !('id' in request)) return undefined
  const { id } = request as { id: unknown }
  return typeof id === 'string' ? id : undefined
}

/** Breadcrumb and document-title metadata for maintenance routes. */
export const maintenanceHandles = {
  create: { title: 'New request', section: 'Main', parent: PARENT },
  detail: { title: 'Request', section: 'Main', parent: PARENT, resolveTitle: requestTitle },
  edit: {
    title: 'Edit request',
    section: 'Main',
    parent: PARENT,
    resolveTitle: (data) => {
      const id = requestTitle(data)
      return id ? `Edit ${id}` : undefined
    },
  },
} satisfies Record<string, RouteHandle>
