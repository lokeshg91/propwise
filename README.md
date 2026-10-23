# Propwise

**Property & Facility Management Admin Dashboard** — a premium, responsive React template for residential and commercial property managers.

> **Status:** v0.9.0 — design system, application shell, dashboard overview, the Properties, Tenants, Maintenance, Vendors and Finance modules, Reports and Settings. See [`CHANGELOG.md`](CHANGELOG.md) for what changed in each release.

Propwise is a **frontend-only** template. It uses local mock data and has no backend, database, real authentication, payment processing, email or SMS integrations. Finance records payments; it never moves money. Connect it to your own APIs through the service layer in `src/data/services/`.

---

## Tech stack

| Area          | Technology                       |
| ------------- | -------------------------------- |
| Framework     | React 19                         |
| Build tool    | Vite 8                           |
| Language      | TypeScript 6 (strict)            |
| Styling       | Tailwind CSS 4 (`@tailwindcss/vite`) |
| UI primitives | shadcn/ui + Radix UI             |
| Icons         | Lucide React                     |
| Routing       | React Router 8                   |
| Charts        | Recharts                         |
| Data tables   | TanStack Table                   |
| Forms         | React Hook Form + Zod            |
| Notifications | Sonner                           |
| Testing       | Vitest + React Testing Library   |
| Linting       | ESLint 10 (flat config) + typescript-eslint |
| Font          | Inter Variable (`@fontsource-variable/inter`, self-hosted) |

## Requirements

- **Node.js 22.22 or later** (required by React Router 8)
- **npm 10 or later**

## Getting started

```bash
# 1. Install dependencies from the lockfile
npm ci

# 2. (Optional) create local environment variables
cp .env.example .env.local

# 3. Start the development server
npm run dev
```

The app runs at <http://localhost:5173>.

## Scripts

| Command              | Description                                          |
| -------------------- | ---------------------------------------------------- |
| `npm run dev`        | Start the Vite development server with HMR           |
| `npm run build`      | Type-check and build for production into `dist/`     |
| `npm run preview`    | Serve the production build locally                   |
| `npm run typecheck`  | Run the TypeScript project build check               |
| `npm run lint`       | Lint the project with ESLint                         |
| `npm run lint:fix`   | Lint and auto-fix where possible                     |
| `npm run test`       | Run the test suite once                              |
| `npm run test:watch` | Run tests in watch mode                              |
| `npm run check`      | Typecheck, lint, test and build in one step          |

## Project structure

```text
propwise/
├── public/
│   ├── images/              # Static images
│   └── favicon/             # Favicons
├── src/
│   ├── app/
│   │   ├── layouts/         # Application layouts
│   │   ├── providers/       # Context providers (theme, toasts, …)
│   │   └── routes/          # Router configuration
│   ├── components/
│   │   ├── ui/              # shadcn/ui primitives
│   │   ├── shared/          # Reusable, domain-agnostic components
│   │   ├── charts/          # Chart wrappers
│   │   └── tables/          # Data-table building blocks
│   ├── features/            # Feature modules (one folder per domain)
│   │   ├── dashboard/  properties/  tenants/  maintenance/  vendors/
│   │   └── finance/    reports/     staff/    settings/
│   ├── hooks/               # Shared React hooks
│   ├── lib/                 # Utilities and helpers
│   ├── data/
│   │   ├── mock/            # Fictional sample records
│   │   └── services/        # Data-access layer (swap for real API calls)
│   ├── types/               # Shared TypeScript types
│   ├── styles/              # Global CSS and theme tokens
│   ├── test/                # Test setup
│   └── main.tsx             # Application entry point
├── docs/                    # Customization documentation
├── .env.example
├── components.json          # shadcn/ui configuration
├── eslint.config.js
├── tsconfig.json            # Project references (app, node, test)
├── vite.config.ts
└── vitest.config.ts
```

## Conventions

- **Path alias:** import from `src/` with `@/`, e.g. `import { App } from '@/app/App'`.
- **Feature-first:** business functionality lives in `src/features/<feature>/`. Shared components stay free of property-management logic.
- **Data boundary:** pages never import mock data directly; they call functions in `src/data/services/`, so you can replace mock data with API calls in one place.
- **Theming:** colors come from semantic CSS variables in `src/styles/`. Avoid raw color values in feature components.
- **Type safety:** strict mode with `noUncheckedIndexedAccess`; `any` is a lint error.

## Features

- **Design tokens:** semantic CSS variables for light and dark themes (background, surface, text, primary, status colours, charts and sidebar), a type scale, radius and elevation scale. All text pairs meet WCAG AA.
- **Theme modes:** Light, Dark and System, saved in `localStorage` and applied before first paint, so there is no flash. System mode follows OS changes live.
- **Application shell:** a 248px sidebar that collapses to a 72px icon rail (with tooltips and a saved state), a mobile drawer below 1024px, and a header with breadcrumbs, ⌘K page search, notifications, theme switcher and profile menu.
- **Dashboard overview:**
  - KPI cards with period comparisons.
  - A monthly revenue chart (Recharts) with themed tooltips, and an occupancy donut.
  - A property performance table and a maintenance overview with status filters.
  - Upcoming rent payments and recent activity.
  - The date range (3, 6 or 12 months) and property type filters update every section and are kept in the URL, so views can be shared.
- **Properties module:**
  - A listing with search (name, city, address), type and status filters kept in the URL, sorting, pagination, an actions menu and cards on tablet and mobile.
  - A details page with Overview, Units and Activity tabs.
  - Add and Edit property forms (React Hook Form + Zod) with inline errors, an error summary, focus on the first error and success toasts.
  - Units management: search, occupancy and type filters, and an add/edit dialog with conditional validation.
- **Maintenance module:**
  - A listing with metrics (open, overdue, scheduled or in progress, completed in 30 days with average resolution time), search by ID, issue, property, vendor or tenant, status, priority, category, property and overdue filters kept in the URL, sorting and cards on tablet and mobile.
  - A request page with status and priority, alerts for overdue, on-hold, completed and cancelled requests, the current work order and earlier work orders, the resolution target and the activity history.
  - New and Edit request forms: issue, category and priority (with the resolution target), unit or common area, reporter (tenant, staff or inspection), access notes, an optional “take the vacant unit offline” switch and an optional vendor assignment.
  - Action dialogs for Assign, Reassign, Reschedule, Start, Hold, Resume, Complete, Cancel and Reopen. Completing or cancelling asks explicitly whether a unit under maintenance should return to Vacant.
  - A Maintenance tab on property details, “Report an issue” in the unit dialog, and a Maintenance requests card and activity entries on tenant profiles.
- **Vendors module:**
  - A listing with summary cards (total, active, inactive, open work orders), search by name, contact, email, phone or service, status (Active by default, Inactive, All), service and “Has open jobs” filters kept in the URL, sorting, pagination and cards on tablet and mobile.
  - A vendor page with Overview (contact, company, services, current jobs, notes, performance), Work orders (ongoing, completed, cancelled, all, with links to each request and to the vendor a job was reassigned to) and Activity tabs.
  - Performance shows how many jobs each figure is based on, and “Not enough data” instead of a misleading zero.
  - Add and Edit vendor forms (Business, Contact, Services, Notes). A duplicate name or email is blocked and links to the existing vendor; a duplicate phone number asks for confirmation. Vendors are never merged automatically.
  - Deactivate (lists the open work orders that stay with the vendor), Reactivate, and Delete (only for vendors that were never assigned a work order; otherwise the dialog explains why and offers Deactivate instead).
  - Vendor names in Maintenance (request table, cards, current and earlier work orders) link to the vendor page by id, keep the Inactive badge and show both vendors of a reassignment.
- **Tenants module:**
  - A listing with portfolio metrics (active tenants, upcoming move-ins, expiring and holdover leases, rent roll), search by name, email, phone or property, tenant-status and lease-status filters kept in the URL, sorting, pagination and cards on tablet and mobile.
  - A details page with Overview, Lease, Payments and Activity tabs.
  - Add and Edit tenant forms with an optional emergency contact and a lease block: property and available-unit pickers (rent prefilled from the asking rent), move-in type, dates, rent, deposit and due day.
  - Lease management: End lease (move-out date and reason), Cancel a pending lease, Mark as moved in, renew or change terms, move to another unit, and full lease history.
  - A Payments tab built from the Finance ledger: every charge and payment for the tenant (voided ones with their reasons), balance and aging, Record payment, Add income and View in Finance. Sample records are labelled “Local demo records”.
- **Finance module** (details in [`docs/finance.md`](docs/finance.md)):
  - **Overview:** income collected, expenses paid, net cash flow and outstanding receivables (cash basis, with billed and incurred alongside), period and property filters, an income vs expenses chart, collections and aging, property performance, recent records, upcoming obligations, expenses by category and payables.
  - **Transactions:** every charge and bill with type, status, category, property, date and tenant/vendor filters, search, totals and cards on mobile. **Receivables:** balances per tenant with aging.
  - **Record pages and actions:** Add income and Add bill (with optional immediate payment and monthly recurring charges), Edit, Record and Void payment, Adjust, Void, Add late fee, End recurring charge, Mark bill paid or unpaid. Duplicates are blocked or need confirmation. Every change keeps its reason in the record's history.
  - **Integrations:** tenant Payments tab, a Finance tab on property details, bill links on completed work orders, and a Bills card on vendor profiles.
  - **Storage banner** under the header: warning, critical, failed save and read-only states. A failed save never shows as saved.
  - **Transactions custom range:** a from–to date range kept in the URL, besides the presets and All dates.
- **Reports** (details in [`docs/reports.md`](docs/reports.md)):
  - A hub and five read-only reports that reconcile with Finance: **Income & Expense** (cash basis), **Rent Collection**, **Receivables & Aging** (six buckets including Not yet due, as of today), **Property performance** and **Maintenance expenses** (Finance bills only, each bill once).
  - Period presets or a custom range (up to 5 years), property type, property and record source (All, Sample, Created by you) filters, kept in the URL.
  - **Export CSV** (typed columns, text-only formula-injection protection) and **Print / Save as PDF** through a print stylesheet.
- **Settings** (`/settings`):
  - **General:** theme, region (number and date format) and the default report period.
  - **Finance:** workspace currency (relabelled, never converted) and bill payment terms.
  - **Rent & late fees:** effective-dated rule versions that start today or later.
  - **Data & storage:** storage meter, Download backup, Restore from backup, Reset workspace (backup required first, typed confirmation) and the settings change history.
  - Currency and region apply to every module except the Dashboard.
- **Data tables:** a reusable `DataTable` built on TanStack Table v9 with sorting, search, pagination and empty states. Below 1024px it switches to a card layout with a "Sort by" control.
- **Routing:** code-split routes with React Router 8, a data loader for shell data, placeholder pages for upcoming modules, a 404 page and an error boundary.
- **Accessibility:** a skip link, visible focus rings, labelled icon buttons and keyboard-operable menus and dialogs. Status is never shown by colour alone.

## Routes

| Path | Page |
| ---- | ---- |
| `/` | Redirects to `/dashboard` |
| `/login` | Demo sign-in (no authentication) |
| `/dashboard` | Overview |
| `/properties` | Properties listing |
| `/properties/new` | Add property |
| `/properties/:propertyId` | Property details (`?tab=overview\|units\|activity\|maintenance\|finance`) |
| `/properties/:propertyId/edit` | Edit property |
| `/tenants` | Tenants listing (`?q=`, `?status=active\|pending\|past`, `?lease=`) |
| `/tenants/new` | Add tenant (`?propertyId=&unitId=` preselects a unit) |
| `/tenants/:tenantId` | Tenant details (`?tab=overview\|lease\|payments\|activity`) |
| `/tenants/:tenantId/edit` | Edit tenant and lease |
| `/maintenance` | Maintenance listing (`?q=`, `?status=active\|completed\|cancelled\|all`, `?priority=`, `?category=`, `?property=`, `?overdue=1`) |
| `/maintenance/new` | New request (`?propertyId=&unitId=&tenantId=` prefills the location and reporter) |
| `/maintenance/:requestId` | Request details, work orders and activity |
| `/maintenance/:requestId/edit` | Edit request details |
| `/properties/:propertyId?tab=maintenance` | A property's requests |
| `/vendors` | Vendors listing (`?q=`, `?status=active\|inactive\|all`, `?category=`, `?openJobs=1`) |
| `/vendors/new` | Add vendor |
| `/vendors/:vendorId` | Vendor details (`?tab=overview\|work-orders\|activity`) |
| `/vendors/:vendorId/edit` | Edit vendor |
| `/finance` | Finance overview (`?range=this-month\|3m\|6m\|12m\|ytd`, `?type=`, `?property=`) |
| `/finance/transactions` | Transactions (`?q=`, `?kind=income\|expense`, `?status=`, `?category=`, `?property=`, `?range=…\|all\|custom&from=&to=`, `?party=tenant:<id>\|vendor:<id>`) |
| `/finance/receivables` | Receivables by tenant (`?q=`, `?type=`, `?property=`, `?open=0`) |
| `/finance/income/new` | Add income (`?leaseId=` or `?propertyId=` prefills) |
| `/finance/expenses/new` | Add bill (`?propertyId=`, `?vendorId=` prefill) |
| `/finance/transactions/:id` | Charge or bill details and actions |
| `/finance/transactions/:id/edit` | Edit a manual charge or bill |
| `/reports` | Reports hub |
| `/reports/income-expense` | Income & Expense (`?range=`, `?from=&to=`, `?type=`, `?property=`, `?source=all\|sample\|user`, `?view=month\|income\|expense`) |
| `/reports/rent-collection` | Rent Collection (same filters, `?view=property\|tenant`, `?recurring=1`) |
| `/reports/receivables` | Receivables & Aging, as of today (`?type=`, `?property=`, `?source=`, `?view=tenant\|property`) |
| `/reports/property-performance` | Property performance (period filters) |
| `/reports/maintenance-expenses` | Maintenance expenses (period filters, `?view=property\|payee\|category`, `?basis=paid\|incurred`) |
| `/settings` | Settings (`?tab=general\|finance\|rules\|data`) |
| `/staff`, `/notifications` | Management modules (placeholders) |
| `*` | Not found |

## Data layer

The template ships with realistic, fictional sample data. Nothing is sent to a server.

| Layer | Location | Purpose |
| ----- | -------- | ------- |
| Types | `src/types/` | `Property`, `Unit`, `Tenant`, `Lease`, `ServiceRequest`, `WorkOrder`, `Vendor`, `VendorEvent`, `Charge`, `Payment`, `Expense`, `RecurringCharge`, `FinanceEvent`, `FinanceSettings`, `FinanceRuleVersion`, `AppSettings`, `SettingsEvent`, `RentPayment` (Dashboard), `Activity`, `PortfolioSnapshot`, dashboard view models |
| Mock data | `src/data/mock/` | Sample records. Dates are relative to today, so the demo always looks current |
| Services | `src/data/services/` | Async functions such as `getDashboardData()`, `getIncomeExpenseReport()` (`report-service.ts`), `updateCurrency()` and `addRuleVersion()` (`settings-service.ts`), `restoreBackup()` and `resetWorkspaceData()` (`backup-service.ts`). Replace their bodies with API calls |
| Selectors | `src/features/dashboard/lib/` | Pure functions that filter and aggregate data for each widget (unit-tested) |
| Domain rules | `src/data/domain/` | Date helpers, lease rules (`getLeaseDisplayStatus`, `getTenantStatus`), maintenance rules (`TRANSITIONS`, `checkTransition`, `SLA_HOURS`, `getRequestTiming`), vendor rules (`normalizeVendorName`, `findVendorConflicts`, `getVendorPerformance`) Finance rules (`money.ts`, `finance-rules.ts` with `ruleFor`, `finance-schedule.ts`, `finance-summary.ts`) and reports (`report-range.ts`, `report-*.ts`), shared by services and UI |
| Demo store | `src/data/store/demo-store.ts` | Properties, units, tenants, leases, vendors, maintenance requests, work orders, Finance records and every history, saved to `localStorage` (`propwise-demo-data`, schema v6, compact column format). Each write is a transaction that is reconciled and saved before it replaces the data in memory. `resetDemoData()` restores the sample data |
| Finance integrity | `src/data/store/finance-integrity.ts`, `finance-reconcile.ts` | `checkFinanceIntegrity()` validates every link and amount; `reconcileFinance()` posts rent and recurring charges and creates work-order bills (idempotent) |

Route loaders call services, and pages derive what they display through selectors. To connect a real backend, change the service functions only; the components stay the same.

### Property and unit rules

- **Total units:** a property's capacity. Units can be added until the count reaches it, and an edit can't set it below the number of units already added.
- **Recalculated figures:** occupied units, maintenance units and monthly revenue are recalculated from the units after every unit change.
- **Unit numbers:** must be unique within a property.
- **Occupancy comes from leases:** a unit is occupied only while it has an active lease. The unit dialog can set Vacant or Under maintenance; tenants are assigned in the Tenants module (the dialog links there). For a leased unit, status and rent are locked to the lease.
- **Vacant and maintenance units** keep an asking rent, which prefills the rent of a new lease.
- **Dashboard:** it shows the seed snapshot, so properties added in the app appear in the Properties module but not in dashboard KPIs.

### Tenant and lease rules

- **One current lease per unit:** a unit can hold at most one active or pending lease. Occupied, reserved and under-maintenance units are not offered when assigning a tenant, and the service rejects them too.
- **Lease statuses:** `pending` (signed, future move-in; reserves the unit), `active` (occupies the unit), `expired` (ended at term) and `terminated` (ended early or cancelled). Display statuses add *Expiring soon* (within 60 days), *Holdover* and *Move-in due*.
- **Expiry never vacates a unit:** when an active lease passes its end date it shows as *Holdover* and the unit stays occupied. Only **End lease** releases the unit. A pending lease past its start date shows *Move-in due* until **Mark as moved in** or **Cancel lease**.
- **Atomic changes:** every write runs in a transaction (`updateDatabase`) that updates the tenant, lease, unit, property totals and history together, or nothing at all if a check fails.
- **Tenant status:** Active if they have an active lease, Pending if only a pending one, otherwise Past. A past tenant can start a new lease from Edit tenant.
- **Payment history:** the tenant's stored Finance charges and payments (`getTenantFinance`). Rent is posted monthly from the lease terms; see [`docs/finance.md`](docs/finance.md).

### Maintenance rules

- **Lifecycle:** Open → Scheduled (vendor assigned) → In progress → Completed, with On hold and Resume from Scheduled or In progress. Cancel is allowed from any active status and is **final**: a cancelled request can't be reopened or edited. A completed request can be reopened within **30 days**. One table (`TRANSITIONS` in `maintenance-rules.ts`) drives both the buttons shown and the service checks, so the UI can't skip a rule.
- **Resolution targets:** urgent 24 hours, high 3 days, medium 7 days, low 14 days (`SLA_HOURS`). Overdue and due-soon are derived, never stored.
- **Work orders:** at most one active (scheduled or in progress) work order per request. Reassigning cancels the current one, which stays in the history, and records the change in the request activity. Completed work orders keep their final cost and completion date. Costs are plain numbers: Propwise doesn't create invoices or process payments.
- **Vendors:** inactive vendors can't take new work orders but still appear, and link, on their past and open work orders. Open work orders of a deactivated vendor can still be started, completed or reassigned.
- **Unit status protection:** only a vacant unit with no active or pending lease can be taken offline (Under maintenance), and only when you switch it on. Occupied and reserved units are never changed by maintenance. Completing or cancelling a request for a unit under maintenance asks whether it should return to Vacant; answering “No” keeps its status. A unit isn't returned while another open request still needs it offline.
- **Dashboard:** it keeps its fixed sample snapshot, so its maintenance figures differ from the Maintenance module.

### Vendor rules

- **One vendor model:** `Vendor` (`src/types/vendor.ts`) has `id`, `name`, `company`, `categories`, `contactName`, `phone`, `email`, `notes`, `active`, `deactivatedAt`, `createdAt` and `updatedAt`. Work orders refer to vendors by `id` only.
- **Duplicates:** names are compared after trimming and ignoring case, accents, punctuation, a leading “The”, `&`/“and” and legal suffixes (LLC, Inc, Co, Company, Corp, Ltd, PLC, LP, LLP, PLLC, PC), so “BlueLine Plumbing, LLC” matches “blueline plumbing”. Emails are compared case-insensitively and phones by their last 10 digits. A name or email match blocks saving and identifies the existing vendor. A phone match only warns and needs confirmation (`acknowledgePhoneMatch`). Vendors are never merged.
- **History:** renaming a vendor changes its name everywhere it is shown live, because work orders keep the id. Vendor activity and maintenance activity keep the name used at the time, and a rename is recorded as “Renamed from …”. Reactivating keeps the earlier deactivation in the history.
- **Deactivation:** allowed with open work orders after confirmation (`confirmOpenJobs`). Those work orders are not changed. Inactive vendors are rejected for new assignments and reassignments.
- **Deletion:** only for a vendor that no work order of any status (including cancelled or reassigned) has ever referenced. It removes the vendor and its activity.
- **Performance** (`getVendorPerformance`), each figure stored with the number of jobs it is based on:
  - *On-time rate:* completed work orders done by the request's resolution target ÷ eligible completed work orders (reopened requests are excluded because their target was reset).
  - *Average resolution:* from the work order's creation (assignment) to completion.
  - *Total spend:* actual cost of completed work orders that have one.
  - *Cost vs estimate:* (Σ actual − Σ estimate) ÷ Σ estimate, only for work orders with both.
  - *Last job:* most recent completed work order.
  - Rates and averages need at least 3 eligible jobs (`MIN_JOBS_FOR_RATES`); totals need 1. Otherwise the page shows “Not enough data”.
- **Missing references:** if a work order points at a vendor id that no longer exists, Maintenance shows “Unknown vendor” as plain text with no link.

### Finance rules

Summarised here; [`docs/finance.md`](docs/finance.md) has the full rules.

- **Cash basis:** income collected and expenses paid are counted by payment date, and net cash flow = collected − paid. Billed (by due date) and incurred (by bill date) are shown separately. Comparisons with a previous period appear only when that period is fully inside Finance history.
- **Amounts** are integer cents in one workspace currency, chosen in Settings → Finance (curated two-decimal ISO 4217 codes). Changing it relabels amounts; it never converts them.
- **Payments:** partial allowed, never above the balance, never in the future and never before the charge's issue date. Voided with a reason, never edited or deleted.
- **Late fees:** by default residential $50.00 fixed and commercial 5 % of the full rent charge, rounded to the cent, after a 5-day grace period. Rent only, added by hand, while a balance is open, and one late-fee record per rent charge (a voided fee still counts). Grace and fees are effective-dated rule versions (Settings → Rent & late fees): each charge uses the version in force on its due date, and new versions start today or later.
- **Reconciliation** never changes a charge with a payment, adjustment or void, never touches payments, and creates each work-order bill once.
- **Storage:** budget 5,000,000 characters; warning at 60 %, critical at 80 %, saves refused at 95 %. Nothing is deleted automatically.

### Demo data

- 18 vendors: the 15 from v0.6 (ids unchanged) with company names and notes added, plus three new ones that exercise the vendor rules: **Northstar Painting Co.** (active, no jobs, so it can be deleted and shows “Not enough data”), **Lakeside Locksmiths** (active, same phone number as SecureLock Co.) and **Prairie HVAC Partners** (inactive, no jobs).
- Two vendors are inactive: Rapid Rooter Drains and Prairie HVAC Partners.
- No requests or work orders were added in v0.7, so Maintenance figures are unchanged. MR-1005 shows a reassignment (Propwise In-house Team → Apex Door Systems).
- **Finance history is synthetic:** 12 months of fictional charges, payments, fees and bills for the original sample records only, each flagged `demo` and shown with a “Demo” badge. It follows the v0.7 sample payment history (same ids, amounts, due dates and, for almost every month, payment dates) and is not real or verified payment data. Sample rent and recurring charges are issued 3 days before they're due (never before the lease starts) so early sample payments don't predate their charge. Records you create never get invented history.

### Storage migration

Saved data is upgraded automatically on first load, one step at a time, and every step only adds records:

- **v1 → v2 (from v0.4):** each occupied unit gets a tenant and active lease built from its stored tenant name, rent and lease end. Ids derive from the unit (`ten_u_<unitId>`).
- **v2 → v3 (from v0.5):** vendors (ids derived from their names), the 17 original maintenance requests with their original ids (MR-2045 to MR-2061), and generated demo requests linked to existing units and tenants (MR-1001 to MR-1060). New requests continue from MR-2062.

- **v3 → v4 (from v0.6):** vendors gain `company`, `notes`, `deactivatedAt`, `createdAt` and `updatedAt`. Only missing fields are filled; stored names, contacts, categories and active status are kept. A `vendorEvents` collection is added with a “created” event for each vendor and a “deactivated” event for inactive ones (fixed ids `vev_<vendorId>_created` / `_deactivated`). The three new demo vendors are added unless a vendor with the same id, name or email already exists. Properties, units, tenants, leases, requests, work orders and maintenance activity are not touched.

- **v4 → v5 (from v0.7):** Finance is added: charges, payments, expenses, recurring charges, Finance events and settings, plus counters for the new references. Every v4 collection is carried over unchanged. Rent is posted from lease terms for the 12 months up to the upgrade, completed work orders with a final cost get a bill, and synthetic history is added for the original sample records only. The result must pass `checkFinanceIntegrity()` before it is saved. The v0.7 Payments tab stored nothing, so there was no payment data to migrate.

- **v5 → v6 (from v0.8):** every v0.8 collection is carried over unchanged. The v0.8 grace period and late fees become the first rule version (effective from the first day of Finance history, same values); workspace settings (`appSettings`) and an empty settings history (`settingsEvents`) are added. The result must pass `checkFinanceIntegrity()`, and every charge keeps the same derived status, balance, days overdue and late-fee eligibility.

Backups (Settings → Data & storage) hold the saved data as stored; restoring one runs it through the same upgrade chain and integrity check before it replaces the workspace.

Because every id is fixed, running the migration again never creates duplicates. The upgraded data is saved immediately. If an upgrade fails, the stored data is left untouched and the app runs on sample data in read-only mode for that session (the storage banner says so, and every change is refused); the upgrade is retried on the next load.

### Known limitations

- The Dashboard keeps its original fixed sample data and isn't connected to Finance or the other modules, so its revenue, payment and maintenance figures differ from theirs.
- Finance records payments only: no payment processing, bank feeds, invoices, credits, refunds, prepayments, partial bill payments, proration, multi-currency or conversion, accrual or tax accounting.
- Finance history starts 12 months before the data was created; there's no archiving of settled history yet.
- Reports: Receivables & Aging is as of today only; no previous-period comparisons, generated PDF or Excel files, scheduled reports or saved presets. See [`docs/reports.md`](docs/reports.md).
- Reset replaces the whole workspace (after a mandatory backup); there's no "reset sample data only".
- Vendor performance is calculated from work orders in this browser's demo store only; there is no rating, review or invoice data.
- Vendor documents, insurance and licence tracking, availability calendars, rate cards and a vendor portal are not included.
- Maintenance activity entries keep the vendor name used at the time as plain text; they don't link to the vendor.
- All data is stored in `localStorage` in one browser, within a 5,000,000-character budget. Clearing site data, Settings → Data & storage → Reset workspace, or calling `resetDemoData()` restores the sample data.
- Sample Finance history isn't refreshed, so newly posted months become due and overdue as time passes.

## Theming

All colours live in `src/styles/globals.css`. To rebrand, change the variables under `:root` (light) and `.dark` (dark). Components use utilities generated from these tokens, such as `bg-card`, `text-muted-foreground` and `bg-success/10 text-success`, never raw colour values. See [`docs/design-system.md`](docs/design-system.md) for the full token and typography reference.

The theme preference is stored under the `propwise-theme` key. An inline script in `index.html` applies it before the app loads. If you use a strict Content Security Policy, allow that script with a hash or nonce.

## Adding a module (see `src/features/tenants/` for a complete example)

1. Add an entry to `NAV_SECTIONS` in `src/app/routes/navigation.ts` (label, path, icon, description).
2. Create the page in `src/features/<module>/pages/`.
3. Register the route in `src/app/routes/router.tsx` with `handle: navHandle('/<path>')`.

The sidebar, mobile drawer, breadcrumbs and search pick up the new module automatically.

## Adding UI primitives

shadcn/ui components are copied into `src/components/ui/` and owned by the project. Add only what you need:

```bash
npx shadcn@latest add <component>
```

## Environment variables

See `.env.example`. Only variables prefixed with `VITE_` are exposed to client code. No variable is required to run the template.

## Data notice

All data in Propwise is fictional and stored locally in the browser where persistence is used. Nothing is synchronized to a server.

## License

Distributed under the license included with your UI8 purchase.
