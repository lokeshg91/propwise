import { Database, LogOut } from 'lucide-react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import { useSignOut } from '@/features/auth/lib/use-sign-out'
import { SettingsCard } from '@/features/settings/components/settings-card'

/** Sign out, and where the workspace data (including this profile) is backed up or reset. */
export function SessionCard() {
  const signOut = useSignOut()
  return (
    <SettingsCard title="Session and data" description="Your profile is saved with the rest of the workspace in this browser.">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-muted-foreground">Signing out ends the demo session in this browser. Your workspace data stays.</p>
        <Button type="button" variant="outline" onClick={signOut} className="shrink-0">
          <LogOut data-icon="inline-start" />
          Sign out
        </Button>
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-muted-foreground">Backups include your profile. Resetting the workspace restores the sample profile.</p>
        <Button asChild variant="outline" className="shrink-0">
          <Link to="/settings?tab=data">
            <Database data-icon="inline-start" />
            Back up or reset
          </Link>
        </Button>
      </div>
    </SettingsCard>
  )
}
