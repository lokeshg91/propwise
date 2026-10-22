import { type RequestCategory, type Vendor, type VendorV3 } from '@/types'

/** Vendor id from its name, e.g. "BlueLine Plumbing" → "ven_blueline-plumbing". */
export function vendorIdFor(name: string): string {
  return `ven_${name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`
}

const VENDORS: Array<[name: string, categories: RequestCategory[], contact: string, active: boolean]> = [
  ['Propwise In-house Team', ['general', 'appliance', 'cleaning', 'other'], 'Dana Whitfield', true],
  ['BlueLine Plumbing', ['plumbing'], 'Marco Ruiz', true],
  ['Summit HVAC Services', ['hvac'], 'Kendra Lowe', true],
  ['BrightSpark Electric', ['electrical'], 'Tom Becker', true],
  ['Apex Elevator Services', ['elevator'], 'Helen Park', true],
  ['SecureLock Co.', ['locks-security'], 'Ray Duncan', true],
  ['ClearView Glass', ['general'], 'Nadia Farouk', true],
  ['ProClean Facilities', ['cleaning', 'general'], 'Jules Martin', true],
  ['GreenLeaf Landscaping', ['landscaping'], 'Owen Price', true],
  ['Summit Roofing', ['roofing'], 'Carla Jensen', true],
  ['AquaCare Pools', ['other'], 'Pete Alvarez', true],
  ['Apex Door Systems', ['general', 'locks-security'], 'Lina Moss', true],
  ['CoolBreeze Appliance Repair', ['appliance'], 'Sam Ortega', true],
  ['Evergreen Pest Control', ['pest'], 'Iris Nolan', true],
  // Inactive: kept for history, can't take new work orders.
  ['Rapid Rooter Drains', ['plumbing'], 'Gus Fielding', false],
]

/** Fictional vendors (555-01xx phones, .example emails). */
export function buildSeedVendors(): VendorV3[] {
  return VENDORS.map(([name, categories, contactName, active], index) => {
    const id = vendorIdFor(name)
    return {
      id,
      name,
      categories,
      contactName,
      phone: `(555) 555-01${String(40 + index).padStart(2, '0')}`,
      email: `service@${id.replace('ven_', '')}.example`,
      active,
    }
  })
}

/* ------------------------------------------------------- Phase 7 profiles */

/** Company names and notes added to the seeded vendors by the v4 upgrade (only where missing). */
export const VENDOR_PROFILES: Record<string, { company: string; notes: string }> = {
  'ven_propwise-in-house-team': { company: '', notes: 'Our own maintenance technicians. First call for small repairs and turnovers.' },
  'ven_blueline-plumbing': { company: 'BlueLine Plumbing LLC', notes: '24/7 emergency line. Licensed for water heaters and backflow testing.' },
  'ven_summit-hvac-services': { company: 'Summit Mechanical Services, Inc.', notes: 'Preferred for commercial rooftop units.' },
  'ven_brightspark-electric': { company: 'BrightSpark Electric Co.', notes: 'Handles fire alarm panels and emergency lighting.' },
  'ven_apex-elevator-services': { company: 'Apex Vertical Transportation LLC', notes: 'Annual inspections under contract.' },
  'ven_securelock-co': { company: 'SecureLock Company', notes: 'Rekeys within 24 hours of move-out.' },
  'ven_clearview-glass': { company: 'ClearView Glass & Glazing LLC', notes: '' },
  'ven_proclean-facilities': { company: 'ProClean Facilities Group, Inc.', notes: 'Turnover cleans and mold remediation.' },
  'ven_greenleaf-landscaping': { company: 'GreenLeaf Grounds LLC', notes: 'Weekly grounds visits in season.' },
  'ven_summit-roofing': { company: 'Summit Roofing & Exteriors, Inc.', notes: 'Two-week lead time for membrane work.' },
  'ven_aquacare-pools': { company: 'AquaCare Pool Services LLC', notes: '' },
  'ven_apex-door-systems': { company: 'Apex Door Systems Ltd.', notes: 'Loading dock doors and storefront entries.' },
  'ven_coolbreeze-appliance-repair': { company: 'CoolBreeze Appliance Repair LLC', notes: '' },
  'ven_evergreen-pest-control': { company: 'Evergreen Pest Solutions, Inc.', notes: 'Quarterly treatments on all residential sites.' },
  'ven_rapid-rooter-drains': { company: 'Rapid Rooter Drains LLC', notes: 'No longer used: repeated missed appointments.' },
}

/** Three vendors added with the Vendors module (fixed ids, so upgrades never add them twice). */
export function buildPhase7Vendors(now: Date): Vendor[] {
  const at = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString()
  const securelockPhone = `(555) 555-01${String(40 + VENDORS.findIndex(([name]) => name === 'SecureLock Co.')).padStart(2, '0')}`
  return [
    {
      id: vendorIdFor('Northstar Painting Co.'),
      name: 'Northstar Painting Co.',
      company: 'Northstar Painting Company',
      categories: ['general', 'cleaning'],
      contactName: 'Mara Quill',
      phone: '(555) 555-0160',
      email: 'jobs@northstar-painting.example',
      notes: 'New vendor. Interior repaints and drywall touch-ups.',
      active: true,
      deactivatedAt: null,
      createdAt: at(20),
      updatedAt: at(20),
    },
    {
      id: vendorIdFor('Lakeside Locksmiths'),
      name: 'Lakeside Locksmiths',
      company: 'Lakeside Lock & Key LLC',
      categories: ['locks-security'],
      contactName: 'Theo Marsh',
      // Same number as SecureLock Co. (shared answering service): shows the duplicate-phone warning.
      phone: securelockPhone,
      email: 'service@lakeside-locksmiths.example',
      notes: 'Uses the same answering service as SecureLock Co.',
      active: true,
      deactivatedAt: null,
      createdAt: at(12),
      updatedAt: at(12),
    },
    {
      id: vendorIdFor('Prairie HVAC Partners'),
      name: 'Prairie HVAC Partners',
      company: 'Prairie HVAC Partners LLC',
      categories: ['hvac'],
      contactName: 'Jo Pruitt',
      phone: '(555) 555-0162',
      email: 'office@prairie-hvac.example',
      notes: 'Paused while their insurance certificate is renewed.',
      active: false,
      deactivatedAt: at(90),
      createdAt: at(200),
      updatedAt: at(90),
    },
  ]
}
