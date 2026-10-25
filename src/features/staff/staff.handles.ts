import { type RouteHandle } from '@/app/routes/route-handle'

const PARENT = { label: 'Staff', to: '/staff' }

function memberName(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null || !('member' in data)) return undefined
  const { member } = data as { member: unknown }
  if (typeof member !== 'object' || member === null || !('name' in member)) return undefined
  const { name } = member as { name: unknown }
  return typeof name === 'string' ? name : undefined
}

/** Breadcrumb and document-title metadata for staff routes. */
export const staffHandles = {
  create: { title: 'Add staff member', section: 'Management', parent: PARENT },
  detail: { title: 'Staff member', section: 'Management', parent: PARENT, resolveTitle: memberName },
  edit: {
    title: 'Edit staff member',
    section: 'Management',
    parent: PARENT,
    resolveTitle: (data) => {
      const name = memberName(data)
      return name ? `Edit ${name}` : undefined
    },
  },
} satisfies Record<string, RouteHandle>
