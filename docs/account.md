# Account and profile (v0.10)

`/account` holds the signed-in user's profile, a demo password form, notification preferences and sign out. It opens from **Profile** in the user menu; **Settings** still opens `/settings`. There's no sidebar item, so the sidebar is unchanged.

The data lives in the workspace (`account` inside `propwise-demo-data`) and is read and written through `src/data/services/account-service.ts`:

| Function | Purpose |
| --- | --- |
| `getCurrentUser()` | Name, job title and photo for the header and user menu |
| `getAccount()` | The full profile and notification preferences |
| `updateProfile(input)` | Validates and saves the profile; also updates your staff record |
| `updateNotificationPreferences(prefs)` | Saves the five in-app switches |

Validation and limits are in `src/data/domain/account-rules.ts`.

## Cards

| Card | Behaviour |
| --- | --- |
| **Profile** | Full name, job title (shown under the name in the header), email ("Demo: no verification email is sent"), optional phone and photo. **Save profile** is disabled until something changes, and nothing is saved before you press it. Errors appear under each field, and focus moves to the first invalid one |
| **Password** | Current, new (with the live rules) and confirm; the new password must differ from the current one. **Demo:** nothing is checked or stored. The result reads "Demo complete — no password was changed", and the form is cleared |
| **Notifications** | One in-app switch per category: Maintenance, Payments, Leases, Tenants and Workspace. The card says existing notifications stay as they are and that nothing is sent by email or push |
| **Session and data** | **Sign out** (the same flow as the user menu) and **Back up or reset**, which opens Settings → Data & storage |

The header follows the saved profile after a save, a restore or a reset; a failed save leaves it unchanged. With the sample profile, the header is exactly as in v0.9.0: Alex Morgan, Portfolio Manager, initials and no photo.

## Email

The profile email must be unique across the team (see [`staff.md`](staff.md)); a clash is refused with the member's name. Changes aren't verified.

## Photo

- **Accepted:** JPEG, PNG, WebP or GIF, up to 10 MB. SVG, unreadable files and larger files are refused with a message.
- **Processing in the browser:** the image is cropped to a centre square and scaled down to at most 256 × 256 px (never enlarged). It's then re-encoded as JPEG, so transparent areas become white and an animated GIF keeps its first frame.
- **Size cap:** the stored copy is at most 120,000 characters (`AVATAR_MAX_CHARS`). Lower quality settings are tried before the photo is refused.
- The original file is never stored or sent.

## Saving

Saves follow the Settings pattern. The success toast appears only after the data is stored. If storage refuses the save, the workspace is over budget or the session is read-only, the error appears in the card, your typed values stay, and nothing else changes.

## Data

`account` holds:

- `profile`: id `usr_1001`, name, email, phone, job title, photo (or null) and `updatedAt`;
- `notificationPreferences`: five on/off values (`maintenance`, `payment`, `lease`, `tenant`, `system`);
- `preferencesUpdatedAt`.

It never holds a password or token; a unit test checks this.

- **Upgrade:** v6 → v7 adds the sample account, with every switch on. See the README's *Storage migration*.
- **Backups** carry the profile, photo and preferences, and a restore brings them back exactly. An invalid account in a backup makes it unrestorable ("The account profile is invalid: …").
- **Damaged stored data** (only possible by editing storage by hand): the damaged fields fall back to the sample values, and nothing is written until the next change.
- **Reset workspace** restores the sample profile; theme, sidebar and the demo session are kept.
