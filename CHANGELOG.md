# Changelog

## 0.7.0 — Vendors module

### Added
- **Vendors listing (`/vendors`):** summary cards, search, status, service and “Has open jobs” filters kept in the URL, sorting, pagination, table on desktop and cards on tablet and mobile, empty and no-results states.
- **Vendor page (`/vendors/:id`):**
  - Overview, Work orders and Activity tabs.
  - Performance figures (on-time rate, average resolution, total spend, cost vs estimate, last job). Each one shows how many jobs it is based on, and “Not enough data” below the minimum.
- **Add and Edit vendor forms:**
  - Name and email duplicates are blocked, with a link to the existing vendor. A phone duplicate needs confirmation.
  - Save stays disabled until something changes.
- **Deactivate, Reactivate and Delete:**
  - Deactivation lists the open work orders that stay with the vendor, with an optional reason.
  - Deletion is only allowed for vendors that were never assigned. Otherwise the dialog explains why and offers Deactivate instead.
- **Vendor activity history**, which keeps the name used at the time, plus work-order milestones.
- **Vendor links in Maintenance:** the request table, cards, and current and earlier work orders link to `/vendors/:id`. They keep the Inactive badge and show “Took over from” and “Reassigned to” for reassignments. A missing vendor reference shows as plain “Unknown vendor”.
- **Demo vendors:**
  - Northstar Painting Co.: active, no jobs.
  - Lakeside Locksmiths: same phone number as SecureLock Co.
  - Prairie HVAC Partners: inactive.

### Changed
- `Vendor` gains `company`, `notes`, `deactivatedAt`, `createdAt` and `updatedAt`. There is still one vendor model, and work orders refer to vendors by id.
- Saved data format v3 → **v4**, upgraded automatically on first load. Only missing fields are filled. No existing vendor, request, work order or activity is changed or duplicated, and v1 and v2 data still upgrade in one go.
- The Maintenance read model exposes `vendor.missing`, so an unknown vendor is no longer shown as Inactive.

### Unchanged
- Dashboard and its fixed sample snapshot.
- Maintenance lifecycle, assignment rules and figures.
- Dependencies.

## 0.6.0 — Maintenance module
Requests, work orders, the lifecycle with resolution targets, unit status protection and storage format v3.

## 0.5.0 — Tenants and leases
Tenants, leases, lease lifecycle, demo payment history and storage format v2.

## 0.4.0 — Properties and units
Properties listing, details, forms, units management and the local demo store.
