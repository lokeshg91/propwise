import { useCallback } from 'react'
import { useLoaderData, useRevalidator } from 'react-router'

import { NavigationProgress } from '@/components/shared/navigation-progress'
import { PageContainer } from '@/components/shared/page-container'
import { PageHeader } from '@/components/shared/page-header'
import { type accountLoader } from '@/features/account/account.loaders'
import { NotificationPreferencesCard } from '@/features/account/components/notification-preferences-card'
import { PasswordCard } from '@/features/account/components/password-card'
import { ProfileCard } from '@/features/account/components/profile-card'
import { SessionCard } from '@/features/account/components/session-card'

/** Account (Phase 10.3): profile, demo password change, notification preferences, sign out. Each card saves on its own. */
export function AccountPage() {
  const { account } = useLoaderData<typeof accountLoader>()
  const revalidator = useRevalidator()
  const refresh = useCallback(() => void revalidator.revalidate(), [revalidator])

  return (
    <PageContainer>
      <NavigationProgress />
      <PageHeader title="Account" description="Your profile, password and notification preferences." />
      <div className="flex max-w-4xl flex-col gap-6">
        <ProfileCard account={account} onSaved={refresh} />
        <PasswordCard email={account.profile.email} />
        <NotificationPreferencesCard account={account} onSaved={refresh} />
        <SessionCard />
      </div>
    </PageContainer>
  )
}
