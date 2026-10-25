# Notifications (v0.10)

Propwise keeps **one saved inbox**. The header menu, the sidebar badge and the `/notifications` page all read it, so they always agree and update together. Notifications are **in-app only**: nothing is emailed or pushed, and the page says so.

Rules are in `src/data/domain/notification-rules.ts`, and the inbox is read and written through `src/data/services/notification-service.ts` (`getNotifications`, `setNotificationRead`, `markAllNotificationsRead`).

## Where they appear

- **Header menu:** the newest 10. Choosing one opens its record (or `/notifications` for the samples) and marks it read. **Mark all read** is saved.
- **Sidebar badge and header dot:** the unread count. The dot shows while anything is unread.
- **`/notifications`:**
  - an unread count;
  - read-status filters (`?status=all|unread|read`) and a type filter (`?category=maintenance|payment|lease|tenant|system`), each kept in the URL and showing its count;
  - per item: icon, title, unread marker, message and time, with **Open** (goes to the record and marks it read) and **Mark read / Mark unread**;
  - **Mark all read** and **Notification settings** (opens `/account`);
  - empty and "all caught up" states.

A failed save shows a toast and changes nothing.

## Sample notifications

A fresh or upgraded workspace has the same five sample notifications as earlier versions: `ntf_2001`–`ntf_2005`, with the same text, categories and order, three of them unread. They store their **age** (12 min, 48 min, 5 h, 26 h and 3 days) rather than a timestamp, so they always read as recent, exactly as before. They have no linked record. Because of this, the Dashboard's header dot and sidebar badge "3" are unchanged.

## Event notifications

| Event | Type | Id | Opens |
| --- | --- | --- | --- |
| Payment recorded | Payments | `ntf_payment-recorded_<paymentId>` | The charge in Finance |
| Bill becomes overdue (the start of the day after its due date) | Payments | `ntf_bill-overdue_<expenseId>_<dueDate>` | The bill |
| Maintenance request created | Maintenance | `ntf_request-created_<requestId>` | The request |
| Request passes its resolution target | Maintenance | `ntf_request-overdue_<requestId>_<dueDate>` | The request |
| Lease enters its last 30 days | Leases | `ntf_lease-expiring_<leaseId>_<endDate>` | The tenant |
| Tenant added | Tenants | `ntf_tenant-added_<tenantId>` | The tenant |

### Rules

- **No duplicates.** Ids come from the record (and its date), so an event can be notified only once. Reloads, saves and restores never add it again.
- **Only events since the last check.** The workspace stores `notificationsCheckedAt`. It's set when the workspace is created or upgraded and moves forward with every save. A plain page load moves it only when it adds something, so browsing never writes. A fresh or just-upgraded workspace therefore has only the five samples, even if its history contains overdue bills or requests.
- **Records created by a save count as new**, even if the service stamped them a moment before the check.
- **Date events** (bill overdue, request overdue, lease expiring) are noticed on the next save or page load after the moment passes, and only within the last 30 days.
- **Text is stored as it read at the time**, in the workspace currency and format.
- **Preferences are respected.** A type switched off on `/account` creates nothing. Each save first catches up with the preferences as they were, so switching a type back on never notifies what happened while it was off. The samples are never affected.
- **Bounded storage:** at most 200 event notifications are kept (`NOTIFICATION_LIMITS.maxStored`), newest first, plus the five samples.

## Data

`notifications` and `notificationsCheckedAt` live in the workspace (schema v7). Each stored item has its id, kind, category, title, message, read state, a same-app link (or none) and its time (or, for samples, its age).

- **Upgrade:** v6 → v7 adds the sample inbox and sets `notificationsCheckedAt` to the moment of the upgrade. v7 data saved before the inbox existed gets it too.
- **Backups** include the inbox and read state, and a restore brings them back exactly. Damaged notifications (a link that isn't a same-app path, an unknown kind, a repeated id) make a backup unrestorable. Damaged stored items are left out on load, and nothing is written until the next change.
- **Reset workspace** brings back the sample inbox, with three unread.

## Limitations

- Nothing is emailed or pushed, and there's no background job: date events wait until the app is opened or saves something.
- Only the newest 200 event notifications are kept.
- **A saved workspace gains unread items over time.** Sample requests pass their targets and sample leases reach their last 30 days after the workspace was created, so a workspace opened days later can show more than 3 unread. A fresh or just-upgraded workspace always shows 3.
- Workspace (system) notifications come only from the samples.
