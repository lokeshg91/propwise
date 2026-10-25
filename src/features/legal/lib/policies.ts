import { STORAGE_KEYS } from '@/lib/storage'

/**
 * Policy pages (Phase 10.1). The text is sample content for the template:
 * whoever deploys Propwise must review and replace it, and fill in the
 * placeholders below, before using it with real customers.
 */

export type PolicyId = 'privacy' | 'terms' | 'cookies'

export interface PolicyPage {
  id: PolicyId
  path: `/${PolicyId}`
  title: string
  /** Short label for the policy switcher and footer links. */
  label: string
  summary: string
}

export const POLICY_PAGES: readonly PolicyPage[] = [
  {
    id: 'privacy',
    path: '/privacy',
    title: 'Privacy policy',
    label: 'Privacy',
    summary: 'What information Propwise handles, where it is kept and the choices you have.',
  },
  {
    id: 'terms',
    path: '/terms',
    title: 'Terms of service',
    label: 'Terms',
    summary: 'The terms for using this Propwise workspace.',
  },
  {
    id: 'cookies',
    path: '/cookies',
    title: 'Cookies and local storage',
    label: 'Cookies',
    summary: 'What Propwise saves in your browser, and how that differs from cookies.',
  },
]

export const policyPage = (id: PolicyId): PolicyPage => POLICY_PAGES.find((page) => page.id === id) as PolicyPage

/** Details the operator fills in before production use. Shown as visible placeholders. */
export const LEGAL_DETAILS = {
  product: 'Propwise',
  operator: '[Company name]',
  contactEmail: '[privacy@your-company.com]',
  jurisdiction: '[Country or state]',
  /** Date of the current version of these sample documents (YYYY-MM-DD). */
  lastUpdated: '2026-10-24',
} as const

export interface StorageEntry {
  key: string
  purpose: string
  contents: string
  written: string
}

/** Everything Propwise saves in the browser. Keys come from `STORAGE_KEYS`, so this list can't drift from the code. */
export const STORAGE_ENTRIES: readonly StorageEntry[] = [
  {
    key: STORAGE_KEYS.demoData,
    purpose: 'Keeps your workspace between visits.',
    contents:
      'All workspace records: properties, units, tenants, leases, maintenance requests, work orders, vendors, staff members (names, contact details, roles and property assignments), finance records, settings and their history, and your notifications and which ones you’ve read. Also your profile (name, email, phone, job title and an optional photo, resized to 256 × 256 px) and notification preferences. Never a password.',
    written: 'When you first change something. Until then, the sample workspace is generated in memory and nothing is saved.',
  },
  {
    key: STORAGE_KEYS.theme,
    purpose: 'Remembers your colour theme.',
    contents: 'One value: light, dark or system.',
    written: 'When you choose a theme.',
  },
  {
    key: STORAGE_KEYS.sidebarCollapsed,
    purpose: 'Remembers whether the sidebar is collapsed.',
    contents: 'One value: true or false.',
    written: 'When you collapse or expand the sidebar.',
  },
  {
    key: STORAGE_KEYS.session,
    purpose: 'Remembers that you signed out of the demo, so Propwise shows the sign-in page.',
    contents: 'One value: “signed out”, with the time you signed out. No name, email, password or link token. Not included in backups.',
    written: 'When you sign out. Removed when you sign in. Without it, you are signed in.',
  },
]
