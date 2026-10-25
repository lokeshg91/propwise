# Staff (v0.10)

The Staff module manages the people who work in the workspace: their contact details, role and property assignments. **Roles describe access only; this demo doesn't enforce them**, so anyone using the browser can do everything. Every page that shows roles says so. Adding a member sends no invitation and creates no login.

Rules are in `src/data/domain/staff-rules.ts`, and reads and writes go through `src/data/services/staff-service.ts` (`getStaffList`, `getStaffDetail`, `createStaff`, `updateStaff`, `setStaffActive`, `deleteStaff`).

## Pages

| Route | Contents |
| --- | --- |
| `/staff` | **Team:** counts (team members, active, owners and admins, properties covered); search; filters; sortable table, with cards on mobile. Your own row is marked **You** |
| `/staff?tab=roles` | **Roles and access:** the six roles with descriptions and active member counts, and a read-only matrix of 7 areas × 6 roles (a list on phones) |
| `/staff/new` | Name, job title, email, optional phone, role and property checkboxes ("n of 12 selected"). "Demo: no invitation is sent" |
| `/staff/:staffId` | Name, badges, job title and contact links; Edit, Deactivate/Reactivate and Delete; **Overview**, **Properties** and **Activity** tabs (`?tab=`) |
| `/staff/:staffId/edit` | The same form; Save is disabled until something changes |

An unknown or deleted member shows a not-found page with **Back to staff**.

### Search and filters

All are kept in the URL, so they survive refresh and Back; unknown values fall back to the defaults.

- `?q=`: name, job title, email, phone (digits match too, ignoring formatting) and assigned property name.
- `?status=active|inactive|all`: **Active** by default.
- `?role=owner|admin|property-manager|maintenance|leasing|accounting`.
- `?property=<property id>|unassigned`: members assigned to a property, or members with no assignments.

## Roles

| Role | Description |
| --- | --- |
| Owner | Full access, including staff, settings and workspace data |
| Admin | Manages everything day to day, including staff and settings |
| Property manager | Runs assigned properties: units, tenants, leases and maintenance |
| Maintenance coordinator | Handles maintenance requests, work orders and vendors |
| Leasing agent | Works with tenants and leases; views properties |
| Accountant | Records income, payments and bills; runs reports |

The matrix (`ROLE_ACCESS`) gives each role **Manage**, **View** or **No access** for Properties and units, Tenants and leases, Maintenance and vendors, Finance, Reports, Staff, and Settings and data. To enforce roles with a real backend, check `ROLE_ACCESS` on the server and hide what a role can't use.

## Rules

- **Unique email.** Case and surrounding spaces are ignored, across the whole team and your own profile on `/account`. A duplicate is flagged when you leave the field, with a link to the member who has it, and refused again on save.
- **Deactivate and reactivate** take an optional reason. History and assignments are kept, and inactive members are hidden from the default list.
- **Delete** removes the member and their history permanently, after confirmation.
- **Your own record** can't be deactivated or deleted, and its role can't change. The buttons aren't shown, the role field is locked with the reason, and the service refuses too.
- **The last active Owner or Admin** can't be deactivated or deleted, or moved to a role without staff and settings access. The dialog explains why and has no confirm button; the service refuses as well.
- **Your record and your profile stay in sync.** Editing yourself in Staff updates the profile and header, and saving on `/account` updates your staff record.
- **History:** every change is recorded — details, renames, role changes (for example "Leasing agent → Property manager"), assignments added or removed, deactivation and reactivation. Entries keep the name the member had at the time.
- **Failed saves change nothing.** The error appears on the form or in the dialog.

## Data

`staff` and `staffEvents` live in the workspace (schema v7). Each `StaffMember` has `id`, `userId` (set only on your own record), name, email, phone, job title, `role`, `propertyIds`, `active`, `deactivatedAt`, `demo`, `createdAt` and `updatedAt`. Nothing stored is a password or token.

- **Sample team:** you as **Owner** (built from your profile) and 8 fictional members flagged `demo`, with fixed ids, dates and assignments: an Admin, three property managers, a maintenance coordinator, a leasing agent, an accountant and one inactive member with a "Deactivated" history entry.
- **Upgrade:** v6 → v7 adds the team. v7 data saved before the team existed gets it, built from the saved profile.
- **Record counts** in Data & storage and the reset and restore dialogs include **Staff members**, split into sample and created by you.
- **Backups** include the team and its history; restoring brings both back exactly. Damaged team data makes a backup unrestorable ("The staff data is invalid: …"). Damaged stored data opens a read-only session and leaves the stored data untouched.
- **Reset workspace** brings back the sample team.

## Limitations

- Roles aren't enforced, and property assignments don't filter other modules.
- No invitations, invite acceptance, schedules or request assignment.
- Your own record is the Owner in a fresh workspace, and its role can't change from the UI.
