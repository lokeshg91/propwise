import { defaultAccount } from '@/data/domain/account-rules'
import { sampleNotifications } from '@/data/mock/notifications'
import { buildSampleStaff, buildSampleStaffEvents } from '@/data/mock/staff-seed'
import { type DemoDatabase, type DemoDatabaseV6 } from '@/data/store/demo-store'
import { type Account } from '@/types'

/**
 * v6 → v7 (Phase 10): adds the signed-in user's account (profile and
 * notification preferences, 10.3), the team (staff and their history, 10.4)
 * and the notification inbox (10.5): the sample profile the header has
 * always shown, the fictional sample team with the signed-in user as member
 * #1, and the five sample notifications (three unread), with notifications
 * starting from `now`, so nothing earlier is notified. Purely additive: every
 * v6 field is carried over unchanged, which `assertCarriedOver` checks
 * before the result can be saved.
 */
export function upgradeToV7(v6: DemoDatabaseV6, now: Date): DemoDatabase {
  const account = defaultAccount()
  return { ...v6, version: 7, account, ...sampleTeam(v6, account), ...sampleInbox(now) }
}

/** The sample inbox; event notifications start after `now`. */
export function sampleInbox(now: Date): Pick<DemoDatabase, 'notifications' | 'notificationsCheckedAt'> {
  return { notifications: sampleNotifications(), notificationsCheckedAt: now.toISOString() }
}

/** The sample team for a workspace: assignments only to properties it has. */
export function sampleTeam(db: Pick<DemoDatabaseV6, 'properties'>, account: Account): Pick<DemoDatabase, 'staff' | 'staffEvents'> {
  const staff = buildSampleStaff(account.profile, new Set(db.properties.map((property) => property.id)))
  return { staff, staffEvents: buildSampleStaffEvents(staff) }
}

/** Throws unless every field of the older data is present, unchanged, in the upgraded data (apart from `version`). */
export function assertCarriedOver(before: Record<string, unknown>, after: Record<string, unknown>): void {
  const changed = Object.keys(before).filter((key) => key !== 'version' && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
  if (changed.length > 0) throw new Error(`Upgrade changed existing data: ${changed.join(', ')}`)
}
