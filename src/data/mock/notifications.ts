import { type StoredNotification } from '@/types'

/**
 * The five fictional sample notifications (three unread). Their text and
 * read state are the ones Propwise has always shown; their times are kept as
 * ages relative to page load, so the demo always looks current.
 */
export const SAMPLE_NOTIFICATIONS: readonly StoredNotification[] = [
  {
    id: 'ntf_2001',
    kind: 'sample',
    category: 'maintenance',
    title: 'New work order',
    message: 'Leaking kitchen faucet reported at Maple Court, Unit 4B.',
    createdAt: null,
    ageMinutes: 12,
    read: false,
    link: null,
    demo: true,
  },
  {
    id: 'ntf_2002',
    kind: 'sample',
    category: 'payment',
    title: 'Rent payment received',
    message: 'Jordan Ellis paid $1,850.00 for Harbor View, Unit 12.',
    createdAt: null,
    ageMinutes: 48,
    read: false,
    link: null,
    demo: true,
  },
  {
    id: 'ntf_2003',
    kind: 'sample',
    category: 'lease',
    title: 'Lease expiring soon',
    message: 'The lease for Cedar Point Offices, Suite 210 ends in 30 days.',
    createdAt: null,
    ageMinutes: 60 * 5,
    read: false,
    link: null,
    demo: true,
  },
  {
    id: 'ntf_2004',
    kind: 'sample',
    category: 'tenant',
    title: 'New tenant application',
    message: 'Priya Raman applied for Willow Residences, Unit 7A.',
    createdAt: null,
    ageMinutes: 60 * 26,
    read: true,
    link: null,
    demo: true,
  },
  {
    id: 'ntf_2005',
    kind: 'sample',
    category: 'system',
    title: 'Monthly report ready',
    message: 'Your September portfolio summary is ready to review.',
    createdAt: null,
    ageMinutes: 60 * 24 * 3,
    read: true,
    link: null,
    demo: true,
  },
]

export const SAMPLE_NOTIFICATION_IDS: ReadonlySet<string> = new Set(SAMPLE_NOTIFICATIONS.map((item) => item.id))

export const sampleNotifications = (): StoredNotification[] => SAMPLE_NOTIFICATIONS.map((item) => ({ ...item }))
