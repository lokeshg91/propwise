import { type UIMatch } from 'react-router'

import { findNavItem } from '@/app/routes/navigation'

/** Metadata attached to routes via `handle` and read by the shell. */
export interface RouteHandle {
  title: string
  /** Breadcrumb parent, e.g. the sidebar section. */
  section?: string
}

export function isRouteHandle(value: unknown): value is RouteHandle {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    typeof (value as { title: unknown }).title === 'string'
  )
}

/** Builds a route handle from the navigation config. */
export function navHandle(path: string): RouteHandle {
  const match = findNavItem(path)
  if (!match) throw new Error(`No navigation item registered for "${path}"`)
  return { title: match.item.label, section: match.section.label }
}

/** Returns the handle of the deepest matched route that defines one. */
export function getActiveHandle(matches: UIMatch[]): RouteHandle | undefined {
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index]?.handle
    if (isRouteHandle(handle)) return handle
  }
  return undefined
}
