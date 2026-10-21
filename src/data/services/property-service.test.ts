import { properties as seedProperties } from '@/data/mock/properties'
import {
  createProperty,
  createUnit,
  getProperties,
  getPropertyDetail,
  updateProperty,
  updateUnit,
} from '@/data/services/property-service'
import { isServiceError } from '@/data/services/service-error'
import { readDatabase, resetDemoData } from '@/data/store/demo-store'
import { STORAGE_KEYS } from '@/lib/storage'
import { type PropertyInput, type UnitInput } from '@/types'

const propertyInput: PropertyInput = {
  name: '  Juniper Commons  ',
  type: 'residential',
  status: 'lease-up',
  street: '18 Juniper Way',
  city: 'Boise',
  state: 'ID',
  postalCode: '83702',
  totalUnits: 2,
  description: '',
  yearBuilt: 2025,
  areaSqft: null,
}

const unitInput: UnitInput = {
  number: '101',
  type: '1-bed',
  floor: 1,
  areaSqft: 700,
  rent: 1_800,
  status: 'vacant',
}

describe('property service', () => {
  it('seeds units that match every property total', async () => {
    const list = await getProperties()
    expect(list).toHaveLength(seedProperties.length)

    for (const seed of seedProperties) {
      const detail = await getPropertyDetail(seed.id)
      const units = detail?.units ?? []
      const occupied = units.filter((unit) => unit.status === 'occupied')
      expect(units).toHaveLength(seed.totalUnits)
      expect(occupied).toHaveLength(seed.occupiedUnits)
      expect(units.filter((unit) => unit.status === 'maintenance')).toHaveLength(seed.maintenanceUnits)
      expect(occupied.reduce((sum, unit) => sum + unit.rent, 0)).toBe(seed.monthlyRevenue)
      expect(occupied.every((unit) => unit.tenantName && unit.leaseEndDate)).toBe(true)
      expect(new Set(units.map((unit) => unit.number)).size).toBe(units.length)
    }
  })

  it('creates a property, persists it and records an event', async () => {
    const created = await createProperty(propertyInput)
    expect(created).toMatchObject({ name: 'Juniper Commons', occupiedUnits: 0, monthlyRevenue: 0 })
    expect(created.location).toEqual({ street: '18 Juniper Way', city: 'Boise', state: 'ID', postalCode: '83702' })
    expect((await getProperties())[0]?.id).toBe(created.id)
    expect(window.localStorage.getItem(STORAGE_KEYS.demoData)).toContain('Juniper Commons')

    const detail = await getPropertyDetail(created.id)
    expect(detail?.events[0]).toMatchObject({ kind: 'property-created', title: 'Property added' })
  })

  it('survives a reload from localStorage', async () => {
    const created = await createProperty(propertyInput)
    const saved = window.localStorage.getItem(STORAGE_KEYS.demoData)
    resetDemoData()
    window.localStorage.setItem(STORAGE_KEYS.demoData, saved ?? '')
    expect(readDatabase().properties.some((property) => property.id === created.id)).toBe(true)
  })

  it('updates units and keeps property totals in sync', async () => {
    const property = await createProperty(propertyInput)
    const unit = await createUnit(property.id, unitInput)
    await createUnit(property.id, { ...unitInput, number: '102' })

    let detail = await getPropertyDetail(property.id)
    expect(detail?.property).toMatchObject({ occupiedUnits: 0, maintenanceUnits: 0, monthlyRevenue: 0 })
    expect(detail?.units.find((entry) => entry.number === '102')).toMatchObject({ tenantName: null, leaseEndDate: null })

    await updateUnit(unit.id, { ...unitInput, status: 'maintenance' })
    detail = await getPropertyDetail(property.id)
    expect(detail?.property).toMatchObject({ occupiedUnits: 0, maintenanceUnits: 1, monthlyRevenue: 0 })
    expect(detail?.events.map((event) => event.kind)).toEqual(['unit-updated', 'unit-added', 'unit-added', 'property-created'])
  })

  it('leaves occupancy to the Tenants module', async () => {
    const property = await createProperty(propertyInput)
    await expect(createUnit(property.id, { ...unitInput, status: 'occupied' })).rejects.toMatchObject({ field: 'status' })
    const unit = await createUnit(property.id, unitInput)
    await expect(updateUnit(unit.id, { ...unitInput, status: 'occupied' })).rejects.toMatchObject({ field: 'status' })
  })

  it('enforces unique unit numbers, capacity and minimum total units', async () => {
    const property = await createProperty(propertyInput)
    await createUnit(property.id, unitInput)

    await expect(createUnit(property.id, { ...unitInput, number: ' 101 ' })).rejects.toMatchObject({ code: 'conflict', field: 'number' })

    await createUnit(property.id, { ...unitInput, number: '102' })
    const full = await createUnit(property.id, { ...unitInput, number: '103' }).catch((error: unknown) => error)
    expect(isServiceError(full) && full.code).toBe('conflict')

    await expect(updateProperty(property.id, { ...propertyInput, totalUnits: 1 })).rejects.toMatchObject({ field: 'totalUnits' })
    await expect(updateProperty(property.id, { ...propertyInput, totalUnits: 3 })).resolves.toMatchObject({ totalUnits: 3 })
  })

  it('returns null for unknown properties', async () => {
    await expect(getPropertyDetail('prop_missing')).resolves.toBeNull()
  })
})
