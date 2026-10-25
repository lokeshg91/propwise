import { type LoaderFunctionArgs, redirect } from 'react-router'

import { getCurrentUser, getNotifications } from '@/data/services'
import { loginPathFor } from '@/lib/safe-next'
import { isSignedIn } from '@/lib/session'

/**
 * Loads data the application shell needs on every authenticated page. Signed
 * out (demo session), every app page — deep links, refreshes and Back
 * included — goes to `/login?next=…` first.
 */
export async function appLayoutLoader({ request }: LoaderFunctionArgs) {
  if (!isSignedIn()) {
    const url = new URL(request.url)
    throw redirect(loginPathFor(`${url.pathname}${url.search}${url.hash}`))
  }
  const [user, notifications] = await Promise.all([getCurrentUser(), getNotifications()])
  return { user, notifications }
}

export type AppLayoutData = Awaited<ReturnType<typeof appLayoutLoader>>
