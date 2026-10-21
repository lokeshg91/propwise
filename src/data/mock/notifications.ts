import { type AppNotification } from '@/types'

const minutesAgo = (minutes: number): string =>
  new Date(Date.now() - minutes * 60_000).toISOString()

/**
 * Fictional notifications. Timestamps are relative to page load so the demo
 * always looks current.
 */
export const notifications: AppNotification[] = [
  {
    id: 'ntf_2001',
    category: 'maintenance',
    title: 'New work order',
    message: 'Leaking kitchen faucet reported at Maple Court, Unit 4B.',
    createdAt: minutesAgo(12),
    read: false,
  },
  {
    id: 'ntf_2002',
    category: 'payment',
    title: 'Rent payment received',
    message: 'Jordan Ellis paid $1,850.00 for Harbor View, Unit 12.',
    createdAt: minutesAgo(48),
    read: false,
  },
  {
    id: 'ntf_2003',
    category: 'lease',
    title: 'Lease expiring soon',
    message: 'The lease for Cedar Point Offices, Suite 210 ends in 30 days.',
    createdAt: minutesAgo(60 * 5),
    read: false,
  },
  {
    id: 'ntf_2004',
    category: 'tenant',
    title: 'New tenant application',
    message: 'Priya Raman applied for Willow Residences, Unit 7A.',
    createdAt: minutesAgo(60 * 26),
    read: true,
  },
  {
    id: 'ntf_2005',
    category: 'system',
    title: 'Monthly report ready',
    message: 'Your September portfolio summary is ready to review.',
    createdAt: minutesAgo(60 * 24 * 3),
    read: true,
  },
]
