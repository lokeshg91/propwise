import { dateFromToday, mockNow } from '@/data/mock/mock-dates'
import { type Property, type Unit, type UnitStatus, type UnitType } from '@/types'

const RESIDENTS = {
  first: ['Avery', 'Jordan', 'Sofia', 'Marcus', 'Priya', 'Ethan', 'Amara', 'Daniel', 'Grace', 'Liam', 'Maya', 'Noah', 'Elena', 'Omar', 'Hannah', 'Lucas', 'Zoe', 'Isaac', 'Nina', 'Theo', 'Leah', 'Caleb', 'Aria', 'Mateo'],
  last: ['Chen', 'Ellis', 'Martinez', 'Raman', 'Brooks', 'Okafor', 'Kim', 'Liu', 'Patel', 'Nguyen', 'Foster', 'Reyes', 'Hart', 'Sato', 'Bennett', 'Moreau', 'Haddad', 'Novak', 'Quinn', 'Silva', 'Walsh', 'Duarte', 'Ibsen'],
}

const COMPANIES = [
  'Northwind Analytics', 'Lumen Architecture', 'Brightline Dental Group', 'Harvest Table Café', 'Forge & Co. Workspace',
  'Bluepeak Advisors', 'Copperleaf Studio', 'Meridian Legal LLP', 'Atlas Physical Therapy', 'Kestrel Labs',
  'Juniper Wellness', 'Orchard Lane Books', 'Signal Path Media', 'Tidewater Insurance', 'Ironclad Fitness',
  'Willowby Pediatrics', 'Sparrow & Finch Design', 'Granite Peak Capital', 'Clearwater Optometry', 'Ember Coffee Roasters',
  'Summit Ridge Consulting', 'Pioneer Data Systems',
]

const RESIDENTIAL_MIX: UnitType[] = ['1-bed', '2-bed', '1-bed', 'studio', '2-bed', '1-bed', '3-bed', '2-bed', '1-bed', '2-bed']
const AREA: Record<UnitType, number> = {
  studio: 480,
  '1-bed': 690,
  '2-bed': 980,
  '3-bed': 1_280,
  office: 2_400,
  retail: 1_900,
  medical: 2_200,
  flex: 3_200,
}

function commercialType(property: Property, index: number): UnitType {
  if (/retail|market/i.test(property.name)) return index % 4 === 3 ? 'office' : 'retail'
  if (/medical/i.test(property.name)) return 'medical'
  return index % 5 === 4 ? 'flex' : 'office'
}

/** Deterministic pseudo-random number in [0, 1) for a seed. */
function noise(seed: number): number {
  const x = Math.sin(seed * 9_301 + 49_297) * 233_280
  return x - Math.floor(x)
}

/**
 * Generates the unit roster for a seed property. Status counts, occupied
 * rent and totals match the property exactly, so module figures and
 * dashboard figures agree on first load.
 */
export function generateUnits(property: Property, propertyIndex: number): Unit[] {
  const residential = property.type === 'residential'
  const perFloor = residential ? Math.min(12, Math.ceil(property.totalUnits / 4)) : Math.min(6, Math.ceil(property.totalUnits / 3))

  // Spread statuses across floors rather than clustering them.
  const order = Array.from({ length: property.totalUnits }, (_, index) => index).sort(
    (a, b) => noise(propertyIndex * 1_000 + a) - noise(propertyIndex * 1_000 + b),
  )
  const status = new Map<number, UnitStatus>()
  order.forEach((unitIndex, rank) => {
    if (rank < property.occupiedUnits) status.set(unitIndex, 'occupied')
    else if (rank < property.occupiedUnits + property.maintenanceUnits) status.set(unitIndex, 'maintenance')
    else status.set(unitIndex, 'vacant')
  })

  const drafts = Array.from({ length: property.totalUnits }, (_, index) => {
    const floor = Math.floor(index / perFloor) + 1
    const type = residential ? (RESIDENTIAL_MIX[index % RESIDENTIAL_MIX.length] ?? '1-bed') : commercialType(property, index)
    const area = Math.round((AREA[type] * (0.9 + noise(propertyIndex * 77 + index) * 0.25)) / 10) * 10
    return { index, floor, number: `${floor}${String((index % perFloor) + 1).padStart(2, '0')}`, type, area, status: status.get(index) ?? 'vacant' }
  })

  // Price occupied units so their rent sums to the property's monthly revenue.
  const occupied = drafts.filter((draft) => draft.status === 'occupied')
  const occupiedArea = occupied.reduce((sum, draft) => sum + draft.area, 0)
  const ratePerSqft = occupiedArea === 0 ? 0 : property.monthlyRevenue / occupiedArea
  let assigned = 0

  return drafts.map((draft) => {
    const isOccupied = draft.status === 'occupied'
    let rent = Math.round((draft.area * ratePerSqft) / 5) * 5
    if (isOccupied) {
      const isLast = draft === occupied[occupied.length - 1]
      if (isLast) rent = property.monthlyRevenue - assigned
      assigned += rent
    } else {
      // Asking rent for vacant units sits slightly above in-place rent.
      rent = Math.round((draft.area * ratePerSqft * 1.03) / 25) * 25
    }

    const seed = propertyIndex * 131 + draft.index
    const tenant = residential
      ? `${RESIDENTS.first[seed % RESIDENTS.first.length]} ${RESIDENTS.last[(seed * 7) % RESIDENTS.last.length]}`
      : (COMPANIES[seed % COMPANIES.length] ?? 'Tenant')

    return {
      id: `unit_${property.id.replace('prop_', '')}_${draft.number}`,
      propertyId: property.id,
      number: draft.number,
      type: draft.type,
      floor: draft.floor,
      areaSqft: draft.area,
      rent,
      status: draft.status,
      tenantName: isOccupied ? tenant : null,
      leaseEndDate: isOccupied ? dateFromToday(30 + Math.floor(noise(seed + 5) * 480)) : null,
      updatedAt: mockNow.toISOString(),
    }
  })
}

export function generateSeedUnits(portfolio: Property[]): Unit[] {
  return portfolio.flatMap((property, index) => generateUnits(property, index))
}
