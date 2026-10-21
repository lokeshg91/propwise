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

## States

- **Hover:** neutral `muted` fill. Primary buttons darken by 12%.
- **Focus:** a 3px `ring/50` ring on controls and a 2px outline elsewhere. Always visible with the keyboard.
- **Disabled:** 50% opacity with no pointer events. Use `aria-disabled` when focus must stay on the control.
- **Active navigation:** `sidebar-accent` background with a primary-coloured icon, plus `aria-current="page"`.
