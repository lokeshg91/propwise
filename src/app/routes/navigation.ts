import {
  Bell,
  Building2,
  ChartColumn,
  HardHat,
  LayoutDashboard,
  type LucideIcon,
  Settings,
  UserCog,
  Users,
  Wallet,
  Wrench,
} from 'lucide-react'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  /** Short description used by placeholder pages and search. */
  description: string
}

export interface NavSection {
  label: string
  items: NavItem[]
}

/**
 * Single source of truth for the sidebar, mobile drawer, breadcrumbs and
 * search. Add a module here and register its route in `router.tsx`.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      {
        label: 'Overview',
        path: '/dashboard',
        icon: LayoutDashboard,
        description: 'Portfolio performance, occupancy and activity at a glance.',
      },
      {
        label: 'Properties',
        path: '/properties',
        icon: Building2,
        description: 'Residential and commercial buildings, units and occupancy.',
      },
      {
        label: 'Tenants',
        path: '/tenants',
        icon: Users,
        description: 'Tenant profiles, leases, renewals and communication history.',
      },
      {
        label: 'Maintenance',
        path: '/maintenance',
        icon: Wrench,
        description: 'Work orders, preventive maintenance and inspections.',
      },
      {
        label: 'Vendors',
        path: '/vendors',
        icon: HardHat,
        description: 'Contractors, service providers, contracts and compliance.',
      },
      {
        label: 'Finance',
        path: '/finance',
        icon: Wallet,
        description: 'Rent collection, invoices, expenses and cash flow.',
      },
      {
        label: 'Reports',
        path: '/reports',
        icon: ChartColumn,
        description: 'Portfolio, financial and operational reporting.',
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        label: 'Staff',
        path: '/staff',
        icon: UserCog,
        description: 'Team members, roles, assignments and schedules.',
      },
      {
        label: 'Notifications',
        path: '/notifications',
        icon: Bell,
        description: 'Alerts for work orders, payments, leases and tenants.',
      },
      {
        label: 'Settings',
        path: '/settings',
        icon: Settings,
        description: 'Workspace, profile, appearance and notification preferences.',
      },
    ],
  },
]

export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((section) => section.items)

export function findNavItem(path: string): { item: NavItem; section: NavSection } | undefined {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((entry) => entry.path === path)
    if (item) return { item, section }
  }
  return undefined
}
