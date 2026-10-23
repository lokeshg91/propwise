# Finance (v0.9)

Propwise **records** rent, other income, bills and payments. It does **not** process payments, connect to a bank or payment provider, send invoices or produce tax or accounting statements. Everything is stored in this browser (see [Storage](#storage)).

## Reporting basis

| Figure | Meaning |
| --- | --- |
| **Income collected** | Payments received in the period (by payment date). Cash basis. |
| **Expenses paid** | Bills paid in the period (by paid date). Cash basis. |
| **Net cash flow** | Income collected − expenses paid. |
| **Billed** | Charges due in the period (by due date), shown alongside collected. |
| **Incurred** | Bills dated in the period (by bill date), shown alongside paid. |
| **Collection rate** | Of the charges due in the period, the share paid to date. |
| **Outstanding receivables** | Open balances on charges already due, as of today, for all periods, with aging (due today, 1–30, 31–60, 61–90, 90+ days). |

Billed income and incurred expenses are separate metrics and never mixed into net cash flow. The same definitions are used by the reports in [`reports.md`](reports.md), which reconcile with these figures. A period comparison ("vs previous period") is only shown when the previous period lies entirely inside Finance history; otherwise the card says "No full previous period yet".

## Records

All amounts are integer cents in the Finance currency.

- **Charge** (income): rent from a lease, a recurring charge (parking, service charge, utility recovery, other), a late fee or a manual charge to a tenant or another payer. Fields include `issuedOn`, `dueDate`, `period` (billing month) and an optional void with a reason.
- **Payment**: money received against one charge. Partial payments are allowed; a payment can't exceed the balance (no credits), can't be in the future and **can't be dated before the charge's issue date**. Payments are voided with a reason, never edited or deleted.
- **Expense** (bill): from a completed work order (created automatically, amount and vendor locked) or added by hand (vendor or other payee). Bills are paid in full; marking one unpaid or voiding it needs a reason.
- **Recurring charge**: a monthly schedule on a current lease, posted each month like rent.
- **Finance events**: the history shown on each record (created, edited, adjusted, voided, automatic changes with their reason).

Statuses are derived, never stored. A charge is pending, partially paid, overdue, paid or void; a bill is pending, overdue, paid or void. Status is always shown in words, not only by colour.

## Rules

- **Rent posting:** each lease is billed once per month from the lease terms, in full (no proration), while the due date is inside the lease. Holdover leases keep billing. Pending leases and leases cancelled before move-in are never billed. Backdated leases are billed from the month they were recorded. Months are posted through the current month; the next month is shown as projected ("Scheduled").
- **Reconciliation** runs on load and on every save, only on Finance collections. It never changes a charge that has a payment (even a voided one), an adjustment or a void, never touches payments, and creates each work-order bill once without changing it later. Every automatic change stores a reason and a system event. Running it again changes nothing.
- **Late fees** (one definition in `src/data/domain/finance-rules.ts`; defaults shown, changeable as rule versions):
  - residential: a fixed **$50.00** per late rent charge;
  - commercial: **5 % of the full rent charge** (not the unpaid balance), rounded to the cent, with no minimum or cap;
  - rent charges only, added by hand (never automatically), once the rent is more than **5 days** (the grace period) past due with a balance still open (due Oct 1 → available from Oct 7);
  - **one late-fee record per rent charge, ever**: a voided fee stays on the charge with its reason and blocks another one. The integrity check rejects a second late-fee record.
- **Duplicates:** a repeated invoice number for the same payee is blocked. A charge, payment or bill that looks like an existing one (same payer or payee, amount and date) needs confirmation ("Save anyway").
- **Edits:** manual charges and manual bills can be edited. Lease, recurring and late-fee charges change through **Adjust amount** (with a reason). Work-order bills only allow a new due date.

## Rule versions (rent and late fees)

The grace period and late fees are **effective-dated rule versions** (`finance.rules`), edited in **Settings → Rent & late fees**:

- Each version has a start date (`effectiveFrom`), grace days (0–31), a residential fee (0.00–1,000.00) and a commercial percentage (0–25, at most 2 decimals).
- A new version must start **today or later**. Versions are never edited or removed; a later version replaces an earlier one from its start date.
- Every charge uses the version in force on its **due date** (`ruleFor`, `graceFor`): status, days overdue, paid late, late-fee eligibility and the suggested fee. Charges already due keep the rule they had, and late fees already added keep their stored amounts.
- Data from v0.8 gets one version with the v0.8 values (5 days, $50.00, 5 %), effective from the first day of Finance history, so nothing is reclassified.

**Bill payment terms** (0–120 days from the bill date, default 30) are set in Settings → Finance and apply to new bills.

## Currency and region

Propwise uses **one workspace currency** for all amounts (default USD), chosen in **Settings → Finance** from a curated list of two-decimal ISO 4217 codes. The **region** (Settings → General, default en-US) sets number and date formats.

Changing the currency **relabels amounts; it never converts them**: $1,250.00 shows as €1,250.00. No exchange rate is applied and no record is changed. Activity history keeps the text it was written with, so earlier entries may still show "$". The Settings dialog says this before you confirm, and the change is logged in the settings history.

Currency and region apply to Finance, Reports (including CSV), Properties, Tenants, Maintenance, Vendors and amount inputs. The **Dashboard** keeps its fixed sample figures in US dollars and en-US dates.

## Integrations

- **Tenant profile → Payments tab:** the tenant's charges and payments straight from the Finance ledger (voided ones included, with reasons), balance, aging, received in the last 12 months, rent paid on time, next charge, Record payment, Add income and View in Finance.
- **Property details → Finance tab:** the Finance overview for that property over 12 months, tenants with a balance and links to its transactions.
- **Maintenance:** a completed work order shows its bill (reference, amount, status) and links to it; the bill links back to the request, work order and vendor.
- **Vendor profile:** a Bills card (paid, unpaid, overdue) with View bills and Add bill. A vendor with work orders or bills can't be deleted.
- **Transactions** accepts `?party=tenant:<id>` or `?party=vendor:<id>` to show one tenant's or vendor's records.

## Storage

- Saved data format **v6**, stored in `localStorage` under `propwise-demo-data` in a compact column format (`columns-1`). The sample data uses about 1.27 million characters, roughly 25 % of the budget.
- Budget: **5,000,000 characters**. A banner under the header shows the state on every page:
  - **60 %** warning (amber, can be hidden for the session);
  - **80 %** critical (red, can't be dismissed);
  - **95 %** saves are refused (red);
  - **last save failed** (red, until the next successful save);
  - **suspended** (saved data couldn't be upgraded; red, with Reload; every change is refused and the stored data is untouched).
- A failed save never looks successful: nothing changes in memory or on screen, the form or dialog keeps the input and shows the error, and no success message appears.
- Nothing is deleted automatically. Records older than 12 months stay stored and are listed with **All dates**. Archiving settled history is planned for a later release.
- **Settings → Data & storage** shows the storage meter and offers Download backup, Restore from backup and Reset workspace (a backup must be downloaded first).

## Demo financial history (synthetic)

The Finance history shipped with the template is **fictional sample data**, not real or verified payment records:

- It covers the 12 months up to the day the data was created (fresh install or upgrade). Months before that aren't stored; the tenant Payments tab says so.
- Only the original sample leases, properties and completed work orders get history (`finance.demoScope`), and every sample record is flagged `demo` (shown as a "Demo" badge). Records you create never get invented payments or bills.
- Rent outcomes follow the v0.7 sample payment history: the same charge ids, amounts, due dates, statuses and, for almost every paid month, the same payment date. Some late payers pay in two instalments, one commercial tenant is in arrears, and one check is returned and re-paid, to show those flows.
- To keep those payment dates without dating a payment before its charge, sample rent and recurring charges are **issued 3 days before their due date** (never before the lease starts). Charges posted later, and anything you create, use the standard issue date: the 1st of the month or the lease start.
- Because the sample history isn't refreshed with new payments, newly posted months become due and overdue as time passes. Clearing site data, Reset workspace in Settings, or calling `resetDemoData()`, recreates the sample data.

## Upgrade from v0.8 (v5 → v6)

On first load, v0.8 data is upgraded automatically. Every collection is carried over unchanged; the inline grace period and late fee become the first rule version with the same values, and workspace settings and an empty settings history are added. The result must pass the Finance integrity check, and every charge keeps the same derived state. If the upgrade fails, the stored data is left untouched and the session is read-only.

## Upgrade from v0.7 (v4 → v5)

On first load, v0.7 data is upgraded automatically. Every v0.7 collection (properties, units, tenants, leases, vendors, requests, work orders and their histories) is carried over unchanged, and Finance collections and settings are added. Rent from your own leases is posted from their terms, and completed work orders with a final cost get a bill, but none of your records get invented payments. The result must pass the Finance integrity check before it is saved. If the upgrade fails, the stored data is left untouched, the session is read-only, and the upgrade is retried on the next load.

The v0.7 tenant Payments tab generated its ledger on every read and stored nothing, so no stored payment data existed to migrate.

## Known limitations

- No payment processing, bank feeds, invoices, receipts, statements, tax or accrual accounting.
- No credits, refunds, overpayments, prepayments before a charge is issued, or payments split across charges.
- Bills are paid in full; no partial bill payments.
- No proration of the first or last month of a lease.
- One currency for all records; no multi-currency or conversion. No per-property or per-lease rules.
- The Receivables page shows charges already due only; the **Receivables & Aging report** adds the Not yet due bucket.
- No archiving yet; storage grows by roughly 45–100 K characters per month of activity.
- The **Dashboard is not connected to Finance**: it keeps its original fixed sample data, so its revenue and payment figures differ from Finance.
