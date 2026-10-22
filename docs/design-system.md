# Propwise design system

All tokens are defined in `src/styles/globals.css`. Tailwind utilities are generated from them, so `bg-primary`, `text-muted-foreground` and `border-border` always follow the active theme.

## Colour tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `background` | `#F8FAFC` | `#0F172A` | App canvas |
| `foreground` | `#0F172A` | `#F1F5F9` | Primary text |
| `card` / `popover` | `#FFFFFF` | `#1E293B` | Surfaces, menus, dialogs |
| `primary` | `#1D4ED8` | `#5A9CF8` | Primary actions, links, active state |
| `secondary` / `muted` | `#F1F5F9` | `#273449` | Subtle fills |
| `muted-foreground` | `#5B6A7E` | `#94A3B8` | Secondary text |
| `accent` | `#F1F5F9` | `#273449` | Hover and focus fills in menus |
| `border` / `input` | `#E2E8F0` / `#CBD5E1` | slate at 16% / 28% | Dividers, field borders |
| `ring` | `#1D4ED8` | `#5A9CF8` | Focus rings |
| `success` | `#166534` | `#4ADE80` | Paid, completed, healthy |
| `warning` | `#92400E` | `#FBBF24` | Pending, attention needed |
| `danger` | `#B91C1C` | `#FB8A8A` | Overdue, errors, destructive |
| `info` | `#0369A1` | `#38BDF8` | Neutral information |

Status colours are designed for **tinted** use: `bg-success/10 text-success` (light) and `dark:bg-success/15` (dark). Each pair meets WCAG AA (≥ 4.5:1). shadcn/ui's `destructive` token maps to `danger`.

The dark primary is lighter than the light primary and uses dark text (`primary-foreground: #0F172A`). This keeps both button labels and primary-coloured text accessible on dark surfaces.

## Typography

Inter Variable, with `cv11` and `ss01` font features. Use `tabular-nums` for figures in tables and KPIs.

| Utility | Size / line height | Weight | Use |
| --- | --- | --- | --- |
| `text-display` | 30 / 36 | 650 | Marketing-style hero numbers |
| `text-h1` | 24 / 32 | 650 | Page titles |
| `text-h2` | 20 / 28 | 600 | Section and empty-state titles |
| `text-h3` | 16 / 24 | 600 | Card titles |
| `text-body-lg` | 16 / 24 | 400 | Emphasised body copy |
| `text-body` | 14 / 20 | 400 | Default body text |
| `text-label` | 13 / 18 | 500 | Form labels, KPI labels |
| `text-caption` | 12 / 16 | 400 | Metadata, timestamps, helper text |

## Radius, elevation and layout

- **Radius:** base `--radius` is 10px. Buttons and inputs use `rounded-lg`, cards and dialogs `rounded-xl`, badges are pill-shaped.
- **Elevation:** `shadow-xs` for cards and controls, `shadow-lg` for menus, popovers and dialogs. Dark mode uses deeper black shadows.
- **Layout:** `w-sidebar` (248px), `w-sidebar-collapsed` (72px), `h-header` (64px) and `max-w-content` (1440px).
- **Spacing:** Tailwind's 4px scale. Pages use `PageContainer` (16 / 24 / 32px gutters by breakpoint). Cards use 20px padding (16px for `size="sm"` and on mobile).

## Components

| Component | Location | Notes |
| --- | --- | --- |
| Button | `components/ui/button.tsx` | Variants: default, outline, secondary, ghost, destructive, link. Sizes: xs–lg, icon sizes |
| IconButton | `components/shared/icon-button.tsx` | Requires `label`; adds an accessible name and tooltip |
| Badge | `components/ui/badge.tsx` | Adds `success`, `warning`, `danger`, `info`, `neutral` and `brand` variants |
| Card, Input, Select, Table, Tabs, Dialog, Sheet, Dropdown, Tooltip, Avatar, Skeleton, Separator | `components/ui/` | shadcn/ui (radix-nova) tuned to Propwise tokens |
| PageHeader, PageContainer, EmptyState | `components/shared/` | Page layout primitives |
| BrandMark, BrandLogo | `components/shared/` | Token-coloured logo; the favicon uses the same geometry |
| ThemeSwitcher | `components/shared/theme-switcher.tsx` | Header dropdown plus reusable radio items |
| SegmentedControl | `components/shared/segmented-control.tsx` | Single-select pill group (Radix ToggleGroup) for filters |
| SearchInput | `components/shared/search-input.tsx` | Search field with icon, clear button and required accessible label |
| TrendIndicator | `components/shared/trend-indicator.tsx` | Up/down change chip; direction shown by icon and sign, not only colour |
| DataTable | `components/tables/data-table.tsx` | TanStack Table v9: sortable headers with `aria-sort`, search, pagination, empty state, optional mobile card layout |
| Chart helpers | `components/charts/` | `chartAxisProps`, `chartGridProps`, `CHART_COLORS`, `ChartTooltipCard`, `ChartLegend` |
| FormField | `components/forms/form-field.tsx` | Label, required marker, hint and error with `aria-invalid` and `aria-describedby` wired automatically |
| FormSection | `components/forms/form-section.tsx` | Card section with a title column on wide screens |
| Textarea, RadioGroup | `components/ui/` | shadcn-style primitives matching the other inputs |
| BackLink | `components/shared/back-link.tsx` | "← Parent" link above detail and form page titles |
| ActivityTimeline | `components/shared/activity-timeline.tsx` | Icon + title + description + time feed; optional day grouping. Items carry a Lucide icon and a tone (`primary`, `info`, `success`, `warning`, `danger`, `neutral`) |
| Switch | `components/ui/switch.tsx` | Toggles optional form sections (emergency contact, new lease) |
| DetailList | `components/shared/detail-list.tsx` | Label/value pairs in a responsive grid |
| StatusAlert | `components/shared/status-alert.tsx` | Tinted notice (`danger`, `warning`, `info`, `success`) with an icon, title, next step and optional actions |
| RouteErrorState | `components/shared/route-error-state.tsx` | 404 / load-error screen for a record, with a back button |
| NavigationProgress | `components/shared/navigation-progress.tsx` | Thin top bar while the next page's data loads; respects reduced motion |
| Domain badges | `features/*/components/` | `PropertyStatusBadge`, `MaintenancePriorityBadge`, `MaintenanceStatusBadge`, `PaymentStatusBadge`, `UnitStatusBadge`, `TenantStatusBadge`, `LeaseStatusBadge`, `RentChargeBadge`, `RequestStatusBadge`, `WorkOrderStatusBadge`, `VendorStatusBadge`, `InactiveVendorBadge` |
| CategoryChips | `features/vendors/components/vendor-badges.tsx` | Service chips with an icon; `limit` shows “+N more” |
| VendorLink | `features/maintenance/components/vendor-link.tsx` | Vendor name linking to `/vendors/:id` in table-link style (foreground text, primary + underline on hover, focus ring), with the Inactive badge; a missing vendor is plain muted text |
| ConfirmDialog | `features/vendors/components/vendor-dialogs.tsx` | Confirmation with optional note field, inline error, extra action and hidden confirm for actions that aren't allowed |

### Lease status colours

| Status | Badge | Meaning |
| --- | --- | --- |
| Active | success | Lease running, more than 60 days left |
| Expiring soon | warning | Ends within 60 days |
| Holdover | danger | End date passed, tenant hasn’t moved out; the unit stays occupied |
| Pending move-in | info | Signed, starts in the future; the unit is reserved |
| Move-in due | warning | Start date reached; waiting for “Mark as moved in” |
| Expired, Terminated | neutral | Ended at term, or early / cancelled |

Statuses that need action also show a tinted alert with the next step (End lease, Mark as moved in).

### Maintenance status colours

| Status | Badge | Notes |
| --- | --- | --- |
| Open | brand | Waiting for a vendor |
| Scheduled | info | Vendor assigned |
| In progress | warning | Work started |
| On hold | neutral | Reason shown in a warning alert |
| Completed | success | Reopen possible for 30 days |
| Cancelled | neutral | Final |

### Vendor status colours

| Status | Badge | Notes |
| --- | --- | --- |
| Active | success | Can be assigned to new work orders |
| Inactive | neutral | Kept for history; an info alert on the vendor page explains what still works |

Duplicate name or email notices use the danger tone (blocking); a duplicate phone uses the warning tone (confirm to continue). Performance figures without enough jobs show “Not enough data” in muted text rather than a number.

Priority badges reuse the Dashboard's `MaintenancePriorityBadge` (urgent danger, high warning, medium info, low neutral). The due line under a status is red when overdue and amber when due soon, and always says so in words.

### Finance status colours

| Record | Status | Badge |
| --- | --- | --- |
| Charge | Pending | info |
| Charge | Partially paid | warning |
| Charge | Overdue | danger, with “Overdue by N days” in words |
| Charge | Paid | success (“Paid late” noted in words when after the grace period) |
| Charge / bill | Void | neutral, amount struck through, reason shown |
| Bill | Pending | warning |
| Bill | Overdue | danger |
| Bill | Paid | success |
| Payment | Received / Voided | success / neutral with the reason |
| Projected rent | Scheduled | neutral |

Sample records carry a neutral **Demo** badge. Aging buckets use token colours that darken with age (`AGING_COLORS`: info → warning → danger → danger mixed with foreground) and are always labelled with the bucket and amount, never colour alone.

**Finance components:** `MoneyInput` (currency-symbol prefix, decimal keypad), `ActionDialog` (one Finance action; errors and duplicate confirmations stay in the dialog and the success toast only follows a completed save), `AgingBar`, `ChargeStatusBadge`, `ExpenseStatusBadge`, `DemoBadge`, `MoneyProvider`/`useMoney()` (the Finance currency outside the Finance section) and the app-shell `StorageBanner` (amber warning that can be hidden for the session; red critical, failed-save and read-only alerts that can't be dismissed).

## Charts

- **Colours:** series use `chart-1`–`chart-5` through `CHART_COLORS`, so they switch with the theme automatically.
- **Status fills:** non-text status fills (bars, donut segments) use `chart-3` amber. The text-grade `warning` token is reserved for text and tinted badges.
- **Axes and grid:** axes have no lines, `muted-foreground` 12px ticks and dashed `border` gridlines.
- **Tooltips and legends:** tooltips use `ChartTooltipCard` (popover surface, swatch, label, tabular value). Legends are rendered as HTML outside the SVG so they wrap responsively.
- **Accessibility:** each chart has a text summary (`role="img"` with an `aria-label`), and the donut has a numeric legend, so no value is available only on hover.

## Forms

- **Schemas:** forms use React Hook Form with Zod schemas kept in each feature's `lib/` folder. Shared number helpers live in `src/lib/form-schema.ts`.
- **When errors appear:** fields validate on blur after the first interaction. On submit, an error summary appears and focus moves to the first invalid field.
- **Messages:** errors say what to do ("Enter a 5-digit ZIP code") and appear below the field next to an icon.
- **Required fields:** marked with a red asterisk; the asterisk is hidden from screen readers, and `aria-required` carries the meaning instead.
- **Save buttons:** they show a spinner while saving. Edit forms keep Save disabled until something changes.
- **Service errors:** a conflict from the data layer (duplicate email, unit already leased) is shown on the matching field.
- **Confirmations:** actions that change occupancy or a request's status (End lease, Mark as moved in, Complete, Cancel, Reopen…) use a dialog, never a browser `confirm()`. Destructive actions use the `destructive` button.
- **Explicit answers:** when a choice changes another record (returning a unit to Vacant), the dialog asks a required yes/no question with no default.

## States

- **Hover:** neutral `muted` fill. Primary buttons darken by 12%.
- **Focus:** a 3px `ring/50` ring on controls and a 2px outline elsewhere. Always visible with the keyboard.
- **Disabled:** 50% opacity with no pointer events. Use `aria-disabled` when focus must stay on the control.
- **Active navigation:** `sidebar-accent` background with a primary-coloured icon, plus `aria-current="page"`.
