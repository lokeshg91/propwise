import { ArrowLeft, LogIn } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { Link, Outlet, useMatches } from 'react-router'

import { getActiveHandle } from '@/app/routes/route-handle'
import { BrandLogo } from '@/components/shared/brand-logo'
import { ThemeSwitcher } from '@/components/shared/theme-switcher'
import { Button } from '@/components/ui/button'
import { PolicyLinks } from '@/features/legal/components/policy-links'
import { LEGAL_DETAILS } from '@/features/legal/lib/policies'
import { isSignedIn, subscribeSession } from '@/lib/session'

/** Layout for public pages such as the policies: reachable with or without signing in. */
export function PublicLayout() {
  const handle = getActiveHandle(useMatches())
  const signedIn = useSyncExternalStore(subscribeSession, isSignedIn, isSignedIn)

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <title>{handle ? `${handle.title} · Propwise` : 'Propwise'}</title>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <header className="border-b border-border bg-card/60 print:hidden">
        <div className="mx-auto flex h-header w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link to="/dashboard" aria-label="Propwise home" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <BrandLogo />
          </Link>
          <div className="flex items-center gap-1 sm:gap-2">
            {signedIn ? (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard" aria-label="Back to Propwise">
                  <ArrowLeft data-icon="inline-start" />
                  <span className="sm:hidden">Back</span>
                  <span className="max-sm:hidden">Back to Propwise</span>
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" asChild>
                <Link to="/login">
                  <LogIn data-icon="inline-start" />
                  Sign in
                </Link>
              </Button>
            )}
            <ThemeSwitcher />
          </div>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
        <Outlet />
      </main>
      <footer className="border-t border-border print:hidden">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <p className="text-caption text-muted-foreground">
            © {new Date().getFullYear()} {LEGAL_DETAILS.operator}. Sample policy content.
          </p>
          <PolicyLinks />
        </div>
      </footer>
    </div>
  )
}
