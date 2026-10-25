import { useState } from 'react'

import { Switch } from '@/components/ui/switch'
import { NOTIFICATION_CATEGORIES, updateNotificationPreferences } from '@/data/services'
import { SaveFooter, SettingsCard } from '@/features/settings/components/settings-card'
import { useSaveAction } from '@/features/settings/hooks/use-save-action'
import { type Account, type NotificationCategory, type NotificationPreferences } from '@/types'

const PREFERENCE_LABELS: Record<NotificationCategory, { label: string; description: string }> = {
  maintenance: { label: 'Maintenance', description: 'New requests, work order updates and overdue jobs.' },
  payment: { label: 'Payments', description: 'Payments recorded, and rent and bills that fall due.' },
  lease: { label: 'Leases', description: 'Leases that are about to end, renewed or ended.' },
  tenant: { label: 'Tenants', description: 'New tenants and changes to tenant details.' },
  system: { label: 'Workspace', description: 'Reports and other messages about this workspace.' },
}

/** In-app notifications per category. Nothing is sent by email or push. */
export function NotificationPreferencesCard({ account, onSaved }: { account: Account; onSaved: () => void }) {
  const [saved, setSaved] = useState<NotificationPreferences>(account.notificationPreferences)
  const [draft, setDraft] = useState<NotificationPreferences>(account.notificationPreferences)
  const { pending, error, run } = useSaveAction(onSaved)
  const dirty = NOTIFICATION_CATEGORIES.some((category) => draft[category] !== saved[category])
  const enabled = NOTIFICATION_CATEGORIES.filter((category) => draft[category]).length

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void run(
          async () => {
            const result = await updateNotificationPreferences(draft)
            setSaved(result.notificationPreferences)
          },
          { title: 'Notification preferences saved', description: `${enabled} of ${NOTIFICATION_CATEGORIES.length} notification types on.` },
        )
      }}
    >
      <SettingsCard
        title="Notifications"
        description="Choose which activity creates in-app notifications. Notifications already in your inbox stay as they are. Propwise doesn’t send email or push notifications."
        footer={<SaveFooter error={error} pending={pending} dirty={dirty} label="Save preferences" />}
      >
        <fieldset className="flex flex-col divide-y divide-border rounded-lg border border-border">
          <legend className="sr-only">In-app notifications</legend>
          {NOTIFICATION_CATEGORIES.map((category) => {
            const { label, description } = PREFERENCE_LABELS[category]
            const id = `notify-${category}`
            return (
              <div key={category} className="flex items-center justify-between gap-4 px-4 py-3">
                <label htmlFor={id} className="min-w-0 cursor-pointer">
                  <span className="block text-body font-medium text-foreground">{label}</span>
                  <span id={`${id}-description`} className="block text-caption text-muted-foreground">
                    {description}
                  </span>
                </label>
                <Switch
                  id={id}
                  checked={draft[category]}
                  disabled={pending}
                  aria-describedby={`${id}-description`}
                  onCheckedChange={(checked) => setDraft((current) => ({ ...current, [category]: checked }))}
                />
              </div>
            )
          })}
        </fieldset>
      </SettingsCard>
    </form>
  )
}
