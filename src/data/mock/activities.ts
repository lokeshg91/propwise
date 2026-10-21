import { daysAgo, minutesAgo, monthsAgo } from '@/data/mock/mock-dates'
import { type Activity } from '@/types'

/** Fictional portfolio activity, newest first. */
export const activities: Activity[] = [
  { id: 'act_901', type: 'maintenance-created', title: 'Maintenance request created', description: 'Leaking kitchen faucet — Maple Court Apartments, Unit 4B', propertyId: 'prop_101', createdAt: minutesAgo(12) },
  { id: 'act_902', type: 'payment-received', title: 'Rent payment received', description: 'Jordan Ellis paid $1,850.00 — Harbor View Residences, Unit 12', propertyId: 'prop_102', createdAt: minutesAgo(48) },
  { id: 'act_903', type: 'work-order-completed', title: 'Work order completed', description: 'SecureLock Co. replaced the lobby entry lock at Oakridge Villas', propertyId: 'prop_106', createdAt: minutesAgo(60 * 3) },
  { id: 'act_904', type: 'lease-signed', title: 'Lease signed', description: 'Forge & Co. Workspace signed a 36-month lease — Ironworks Commons, Suite 205', propertyId: 'prop_204', createdAt: minutesAgo(60 * 7) },
  { id: 'act_905', type: 'tenant-added', title: 'New tenant added', description: 'Priya Raman moved in — Willow Residences, Unit 7A', propertyId: 'prop_103', createdAt: daysAgo(1.1) },
  { id: 'act_906', type: 'payment-received', title: 'Rent payment received', description: 'Harvest Table Café paid $5,400.00 — Market Street Retail, Unit 102', propertyId: 'prop_203', createdAt: daysAgo(1.6) },
  { id: 'act_907', type: 'maintenance-created', title: 'Maintenance request created', description: 'HVAC not cooling — Summit Business Park, Suite 310', propertyId: 'prop_202', createdAt: daysAgo(2.2) },
  { id: 'act_908', type: 'work-order-completed', title: 'Work order completed', description: 'GreenLeaf Landscaping repaired irrigation at Cedar Grove Townhomes', propertyId: 'prop_104', createdAt: daysAgo(5) },
  { id: 'act_909', type: 'property-added', title: 'Property added', description: 'Lakeshore Flats (30 units, Chicago, IL) joined the portfolio', propertyId: 'prop_107', createdAt: `${monthsAgo(2, 18)}T15:00:00.000Z` },
  { id: 'act_910', type: 'tenant-added', title: 'New tenant added', description: 'Bayfront Pediatrics moved in — Bayfront Medical Plaza, Suite 220', propertyId: 'prop_205', createdAt: daysAgo(53) },
]
