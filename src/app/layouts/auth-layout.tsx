import { Outlet } from 'react-router'

import { BrandLogo } from '@/components/shared/brand-logo'
import { ThemeSwitcher } from '@/components/shared/theme-switcher'

/** Minimal layout for unauthenticated pages such as sign-in. */
export function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-background">
      <title>Sign in · Propwise</title>
      <header className="flex h-header items-center justify-between px-4 sm:px-8">
        <BrandLogo />
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center px-4 pb-16">
        <Outlet />
      </main>
    </div>
  )
}
