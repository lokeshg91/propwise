# Reports (v0.9)

Reports are **read-only** views of the Finance records described in [`finance.md`](finance.md). Each report is a pure function in `src/data/domain/report-*.ts` over the same charges, payments, bills and rule versions the Finance pages use, served by `src/data/services/report-service.ts`. Nothing is stored and nothing is sent anywhere.

Open them from **Reports** (`/reports`):

| Report | Route | Basis |
| --- | --- | --- |
| Income & Expense | `/reports/income-expense` | Cash basis, for a period |
| Rent Collection | `/reports/rent-collection` | Charges due in a period, as they stand today |
| Receivables & Aging | `/reports/receivables` | As of today (no period) |
| Property performance | `/reports/property-performance` | Period figures, plus occupancy and open balance as of today |
| Maintenance expenses | `/reports/maintenance-expenses` | Finance bills only, paid or incurred basis |

## Filters

All filters are kept in the URL, so a report view can be bookmarked or shared.

- **Period** (`?range=`): This month, Last month, Last 3, 6 or 12 months, Year to date, Last calendar year (whole calendar months, as in Finance), or **Custom range** (`?range=custom&from=YYYY-MM-DD&to=YYYY-MM-DD`). A custom range uses inclusive local calendar dates, needs from ≤ to and can span at most 5 years; the end date may be in the future. Months cut by a custom range are labelled as partial (for example "Oct 1–15"). An invalid range in the URL is shown with its error and isn't applied.
- **Before Finance history:** dates before Finance history starts are allowed; a notice says that no records exist there. Nothing is estimated or invented.
- **Property type** (`?type=`) and **property** (`?property=`).
- **View** (`?view=`) and report options: `?recurring=1` (Rent Collection), `?basis=incurred` (Maintenance expenses).
- **Records** (`?source=all|sample|user`): All records, Sample records or Created by you. Sample records are the ones flagged `demo` (Finance) or created by the seed (work orders). A notice says when sample records are included.
- **Default period:** set in Settings → General.

## Definitions

### Income & Expense
- **Income collected** and **expenses paid** are counted by payment date and paid date; **net cash flow = collected − paid**. It isn't profit, net income or NOI.
- **Billed** (charges by due date) and **incurred** (bills by bill date) are separate, labelled figures and are never added into net cash flow.
- Views: by month, by income category, by expense category.
- Reconciles with `totalsFor`, `monthlyTrend` and `expenseBreakdown` for the same window and scope.

### Rent Collection
- Rent charges **due in the period** (an option adds recurring charges such as parking or service charges).
- Against those charges, as of today: billed, collected to date, outstanding, collection rate, and counts paid on time, paid late, partly paid and unpaid. "Paid late" uses the rule version in force on each charge's due date.
- **Rent received in the period** (cash, by payment date) is shown separately.
- Views: by property, by tenant.

### Receivables & Aging
- Every non-void posted charge with an open balance today, each in **exactly one** bucket:

  | Bucket | Rule |
  | --- | --- |
  | Not yet due | due date after today |
  | Due today | due date = today |
  | 1–30, 31–60, 61–90, 90+ days | days past the due date |

- **Identity:** the six buckets add up to the total open balance, which equals the sum of the rows (by tenant or payer, or by property).
- **Due and overdue** (Due today … 90+) equals the Finance **Outstanding receivables** and its aging. Not yet due is shown separately, so the Finance figure keeps its meaning: **Total open = Due and overdue + Not yet due**.
- Projected (not yet posted) rent isn't a receivable. Payers who aren't tenants are listed by name and property.

### Property performance
- Per property for the period: billed, collected, collection rate (payments to date on charges due in the period ÷ billed), expenses paid and incurred, net cash flow and maintenance paid.
- As of today: **current** occupancy and the open balance due (due today and overdue).
- A totals row. Reconciles with Finance `propertyPerformance` and `totalsFor` per property.

### Maintenance expenses
- **Finance bills only.** Included: every non-void bill with source `work-order` **or** category Maintenance (work-order, manual and operating bills). Each bill counts **once**, by bill id.
- `WorkOrder.actualCost` is **never** added up. A completed work order without a final cost has no bill; it's counted ("Completed without a final cost", when completed in the period) and never given an amount.
- Basis (`?basis=`): **paid** (by paid date, default) or **incurred** (by bill date).
- Figures: total, number of bills, average, estimate vs actual (bills with an estimate) and the split by bill source.
- Views: by property, by vendor or payee, by request category (bills not linked to a request: "Not linked to a request").
- A manual bill that repeats a work-order bill is a separate bill (Finance warns when it's entered) and counts separately.
- Reconciles with the Maintenance line of `expenseBreakdown` (work-order bills are always in the Maintenance category).

## Export CSV

`propwise-<report>[-<view>][-<basis>]-<from>_<to>.csv` (for example `propwise-maintenance-expenses-payee-paid-2025-11-01_2026-10-31.csv`); Receivables & Aging uses its as-of date instead of a range (`propwise-receivables-tenant-2026-10-23.csv`). The file has the same columns and rows as the table on screen (plus export-only columns and a Currency column).

- **Typed columns:** amounts are plain numbers with a dot decimal and an optional minus (`-1250.00`, `0.00`), never quoted or prefixed, so spreadsheets read them as numbers. Numbers and percentages are plain numerals; dates are `YYYY-MM-DD`.
- **Formula-injection protection on text cells only:** a text cell starting with `=`, `+`, `-`, `@`, a tab or a carriage return is prefixed with `'`.
- RFC 4180 quoting, UTF-8 with BOM, CRLF line ends. The report name, filters and generation time are written above the table as comment lines starting with `#`.

## Print / Save as PDF

**Print or save PDF** opens the browser's print dialog; choose "Save as PDF" there to make a file. The print view uses the light theme, hides the app chrome and controls, prints the filters as text, prints every row (not only the first 25) and repeats table headers on each page. Reports with many columns use smaller type to fit A4 portrait. No PDF library is used.

## Screen layout

Below 768 px, report tables become cards. On wider screens a table that is wider than its box scrolls inside the box: a hint above it, a visible scrollbar, edge fades and a pinned first column show there is more, and the table can be focused with Tab and scrolled with the arrow keys.

## Reset, backup and restore

Settings → Data & storage offers **Download backup**, **Restore from backup** and **Reset workspace**. A selective "reset sample data only" isn't offered: the sample data is generated relative to today and user records refer to sample records (a payment on a sample charge, a tenant on a sample unit), so regenerating the sample records next to yours could break those links. A full reset with a mandatory backup, and restore from that backup, is offered instead. See the CHANGELOG for the details of each flow.

## Known limitations

- Receivables & Aging is as of today; historical "as of" aging isn't available.
- No comparison with a previous period, no generated PDF or Excel files, no scheduled or emailed reports and no saved presets.
- With the sample data, Not yet due is $0.00, because no posted sample charge is due after today.
- The Finance Receivables page doesn't show the Not yet due bucket.
- Wide tables print in small type on A4 portrait.
- "Completed without a final cost" counts work orders completed within the period only.
- The Dashboard isn't a report: it keeps its fixed sample data.
