import { type RequestCategory, type Vendor } from '@/types'

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
export function buildSeedVendors(): Vendor[] {
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
