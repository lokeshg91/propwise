# Propwise

**Property & Facility Management Admin Dashboard** — a premium, responsive React template for residential and commercial property managers.

> **Status:** v0.4.0 — design system, application shell, dashboard overview and the Properties module. Tenants, maintenance, vendors and finance modules are added in later phases.

Propwise is a **frontend-only** template. It uses local mock data and has no backend, database, real authentication, payments, email or SMS integrations. Connect it to your own APIs through the service layer in `src/data/services/`.

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
| `/properties/:propertyId` | Property details (`?tab=overview\|units\|activity`) |
| `/properties/:propertyId/edit` | Edit property |
| `/tenants`, `/maintenance`, `/vendors`, `/finance`, `/reports` | Main modules (placeholders) |
| `/staff`, `/notifications`, `/settings` | Management modules |
| `*` | Not found |

## Data layer

The template ships with realistic, fictional sample data. Nothing is sent to a server.

| Layer | Location | Purpose |
| ----- | -------- | ------- |
| Types | `src/types/` | `Property`, `MaintenanceRequest`, `RentPayment`, `Activity`, `PortfolioSnapshot`, dashboard view models |
| Mock data | `src/data/mock/` | Sample records. Dates are relative to today, so the demo always looks current |
| Services | `src/data/services/` | Async functions such as `getDashboardData()`. Replace their bodies with API calls |
| Selectors | `src/features/dashboard/lib/` | Pure functions that filter and aggregate data for each widget (unit-tested) |

| Demo store | `src/data/store/demo-store.ts` | Properties, units and change history created or edited in the app, saved to `localStorage` (`propwise-demo-data`). `resetDemoData()` restores the sample data |

Route loaders call services, and pages derive what they display through selectors. To connect a real backend, change the service functions only; the components stay the same.

### Property and unit rules

- **Total units:** a property's capacity. Units can be added until the count reaches it, and an edit can't set it below the number of units already added.
- **Recalculated figures:** occupied units, maintenance units and monthly revenue are recalculated from the units after every unit change.
- **Unit numbers:** must be unique within a property.
- **Occupied units:** need a tenant name and a rent above $0. Vacant and maintenance units keep an asking rent.
- **Dashboard:** it shows the seed snapshot, so properties added in the app appear in the Properties module but not in dashboard KPIs.

## Theming

All colours live in `src/styles/globals.css`. To rebrand, change the variables under `:root` (light) and `.dark` (dark). Components use utilities generated from these tokens, such as `bg-card`, `text-muted-foreground` and `bg-success/10 text-success`, never raw colour values. See [`docs/design-system.md`](docs/design-system.md) for the full token and typography reference.

The theme preference is stored under the `propwise-theme` key. An inline script in `index.html` applies it before the app loads. If you use a strict Content Security Policy, allow that script with a hash or nonce.

## Adding a module

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
