import { Outlet, useMatches } from 'react-router'

import { getActiveHandle } from '@/app/routes/route-handle'
import { BrandLogo } from '@/components/shared/brand-logo'
import { ThemeSwitcher } from '@/components/shared/theme-switcher'
import { PolicyLinks } from '@/features/legal/components/policy-links'

/** Minimal layout for unauthenticated pages such as sign-in. */
export function AuthLayout() {
  const handle = getActiveHandle(useMatches())
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <title>{`${handle?.title ?? 'Sign in'} · Propwise`}</title>
      <header className="flex h-header items-center justify-between px-4 sm:px-8">
        <BrandLogo />
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-10">
        <Outlet />
      </main>
      <footer className="flex justify-center px-4 pb-6">
        <PolicyLinks />
      </footer>
    </div>
  )
}
