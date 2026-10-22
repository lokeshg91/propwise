# Changelog

## 0.8.0 — Finance module

### Added
- **Finance (`/finance`)** with Overview, Transactions and Receivables, all with filters kept in the URL. See [`docs/finance.md`](docs/finance.md).
  - **Overview:** income collected, expenses paid, **net cash flow** and outstanding receivables (cash basis, with billed and incurred alongside); an income vs expenses chart; collections and aging; property performance; recent records, upcoming obligations, expenses by category and payables.
  - **Transactions:** every charge and bill with type, status, category, property, date and tenant/vendor filters, search, totals, sorting and pagination.
  - **Receivables:** open balances per tenant with aging (due today, 1–30, 31–60, 61–90, 90+ days).
  - **Record pages:** amounts, payments (voided ones with their reasons), alerts, links to the tenant, property, vendor, request and work order, and a full history.
- **Finance actions:** Add income (tenant or other payer, optional immediate payment, monthly recurring charges), Add bill (vendor or other payee, optional immediate payment), Edit, Record payment (partial allowed), Void payment, Adjust amount, Void charge, Add late fee, End recurring charge, Mark bill paid/unpaid, Void bill and Change due date for work-order bills. Every reason-based change is kept in the record's history.
- **Late fees** from one central rule: residential $50.00 fixed, commercial 5 % of the full rent charge rounded to the cent; rent only, added by hand, after the 5-day grace period, while a balance is open, and **one late-fee record per rent charge** (a voided fee still counts).
- **Duplicate protection:** repeated invoice numbers per payee are blocked; look-alike charges, payments and bills need confirmation.
- **Storage banner** under the header on every page: warning at 60 % (can be hidden for the session), critical at 80 %, refused saves at 95 %, last save failed, and suspended (read-only after a failed upgrade, with Reload).
- **Integrations:** the tenant Payments tab reads the Finance ledger; a Finance tab on property details; work-order bill links in Maintenance; a Bills card on vendor profiles; Finance links that open the tenant's Payments tab and the property's Finance tab.
- **Currency:** one configurable currency (any two-decimal ISO 4217 code) with locale-aware formatting through `formatMoney`.

### Changed
- Saved data format v4 → **v5**, upgraded automatically on first load. Every v0.7 collection is carried over unchanged; Finance records and settings are added, and the result must pass the Finance integrity check before it is saved. A failed upgrade leaves the stored data untouched and makes the session read-only until reload.
- The saved text uses a compact column format, so the full sample data uses about a quarter of the 5,000,000-character budget.
- **Failed saves are never shown as successful:** if storage refuses a save, nothing changes in memory or on screen, the error is shown where the change was made, and the banner reports it. Earlier versions could keep an unsaved change in memory.
- **Tenant Payments tab:** the ledger generated on every read (`generateRentLedger`) is replaced by the stored Finance ledger, labelled "Local demo records" for sample data. It keeps the v0.7 charge ids, amounts, due dates, outcomes and almost all payment dates. Months before the Finance history window (12 months up to the upgrade) aren't stored.
- Vendors with Finance bills can't be deleted, and the delete dialog says why.

### Demo data
- 12 months of **synthetic** Finance history for the original sample records only, flagged as demo: rent and recurring charges, payments (including partial, late and instalment payments, an arrears tenant and a returned check), late fees, laundry income, operating bills and work-order bills. It is fictional, not verified payment history.
- Sample rent and recurring charges are issued 3 days before their due date, never before the lease starts, so early sample payments keep their dates without predating their charge. Records you create use the standard issue date and never get invented history.

### Unchanged
- Dashboard and its fixed sample data. It isn't connected to Finance, so its revenue and payment figures differ.
- Properties, Tenants, Maintenance and Vendors behaviour, apart from the Finance links and the tenant Payments tab above.
- Dependencies.

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
