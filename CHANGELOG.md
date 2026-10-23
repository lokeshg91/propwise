# Changelog

## 0.9.0 — Reports & Settings

### Added
- **Reports (`/reports`)**: a hub and five read-only reports built from the same Finance records and rules as the Finance pages, so every figure reconciles with them. See [`docs/reports.md`](docs/reports.md).
  - **Income & Expense** (cash basis): income collected, expenses paid and net cash flow by month, income category and expense category, with billed and incurred as separate figures.
  - **Rent Collection**: rent charges due in the period (optionally with recurring charges): billed, collected to date, outstanding, collection rate, and paid on time, paid late, partly paid and unpaid, by property and by tenant; rent received in the period shown separately.
  - **Receivables & Aging** (as of today): every open balance in exactly one of six buckets — **Not yet due**, Due today, 1–30, 31–60, 61–90 and 90+ days — by tenant or payer and by property. The buckets add up to the total open balance, and the due part equals the Finance receivables.
  - **Property performance**: per property, billed, collected, collection rate, expenses paid and incurred, net cash flow, maintenance paid, the open balance due today and current occupancy, with a totals row.
  - **Maintenance expenses**: Finance bills only (work-order bills and bills in the Maintenance category, each counted once by bill id), on a paid or incurred basis, by property, vendor or payee and request category, with estimate vs actual. Completed work orders without a final cost are counted, never given an amount.
  - **Filters** kept in the URL: period presets or a **custom from–to range** (up to 5 years, partial months labelled), property type, property, and record source (All, Sample, Created by you).
  - **Export CSV** with typed columns (amounts stay numeric, including negatives), formula-injection protection on text cells only, UTF-8 with BOM and CRLF line ends.
  - **Print / Save as PDF** through the browser's print dialog: light theme, no app chrome, filters printed, every row, repeated table headers.
  - Wide tables scroll inside their box with a visible scrollbar, edge fades, a hint, a pinned first column and keyboard scrolling.
- **Settings (`/settings`)** with four tabs, each saving on its own:
  - **General:** theme, region (number and date format, with a live preview) and the default report period.
  - **Finance:** workspace currency (curated list of two-decimal ISO 4217 codes) with a confirmation that amounts are **relabelled, not converted**, and bill payment terms.
  - **Rent & late fees:** effective-dated rule versions (grace days, residential fee, commercial percentage) that start today or later; charges already due keep the rule they had. Past versions are listed.
  - **Data & storage:** storage meter, **Download backup** (JSON), **Restore from backup** and **Reset workspace**, plus the settings change history.
- **Backup, restore and reset:**
  - A backup holds the saved data exactly as stored, with the app and saved-data versions and the theme and sidebar preferences.
  - Restore validates the file (format, app, version, size), upgrades it through the normal migration chain, requires the Finance integrity check, downloads a backup of the current workspace first and asks you to type RESTORE. Any failure leaves the current data untouched.
  - Reset recreates the sample workspace. It shows how many records you created, can't continue until a backup has been downloaded in the same dialog, and asks you to type RESET. Theme and sidebar preferences are kept.
- **Transactions:** a **Custom range…** option with from and to dates kept in the URL.
- **App-wide currency and region:** Properties, Tenants, Maintenance, Vendors, Finance and Reports use the workspace currency and region for amounts, inputs and dates.

### Changed
- Saved data format v5 → **v6**, upgraded automatically on first load. Every v0.8 collection is carried over unchanged; the v0.8 grace period and late fees become the first rule version with the same values, and workspace settings and an empty settings history are added. The result must pass the Finance integrity check, and every charge keeps the same status, balance and late-fee eligibility. A failed upgrade leaves the stored data untouched and makes the session read-only.
- The `/reports` and `/settings` placeholders are now real pages.

### Fixed
- **Destructive buttons in dark mode** (Reset workspace, Cancel request, Void, Delete …) now meet WCAG AA text contrast: 4.9:1 at rest and 4.6:1 on hover (were 4.4:1 and 3.6:1). Light mode is unchanged.
- **Dialogs return keyboard focus** to the button that opened them when they close (Escape, Cancel or a close button), as long as that button is still on the page, including dialogs opened from state and the page search. A dialog with its own trigger, or a caller that manages focus itself, keeps that behaviour.

### Unchanged
- The **Dashboard** keeps its code, fixed sample data, calculations and appearance (US dollars and en-US dates), also after a currency or region change.
- Finance pages and their figures. The Finance Receivables page still shows amounts already due only (no Not yet due bucket).
- No new dependencies.

### Deferred
- A selective "reset sample data only" (it can't be done safely with the current data model; see `docs/reports.md`), historical as-of aging, comparisons with a previous period in reports, generated PDF or Excel files, scheduled or emailed reports, saved report presets and a default landing page.
- Multi-currency and conversion, per-property or per-lease rules, proration, credits and refunds; archiving settled history.

### Known limitations
- Receivables & Aging is as of today only. With the sample data, Not yet due is $0.00, because no posted sample charge is due after today.
- Print uses the browser's dialog; reports with many columns print in small type on A4 portrait. On screen, wide tables scroll inside their box.
- Changing the currency relabels amounts; activity history keeps the text it was written with, so earlier entries may still show "$".
- A completed work order counts as "completed without a final cost" only when it was completed within the report period. Manual and operating maintenance bills appear under "Not linked to a request" by request category.
- Restoring a backup keeps this browser's theme and sidebar preferences. "Backup downloaded" means the file was handed to the browser and checked as restorable.
- Validation limit messages use en-US number grouping; all text is in English.
- In light mode, a destructive button's **hover** state on the page background (not on a card) measures 4.4:1, just under 4.5:1; its resting state is 5.2:1. Unchanged from v0.8.

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
