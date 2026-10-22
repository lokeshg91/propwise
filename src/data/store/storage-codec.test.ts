import { readDatabase } from '@/data/store/demo-store'
import { decodeDatabase, decodeTable, encodeDatabase, encodeTable, isEncodedDatabase } from '@/data/store/storage-codec'

describe('storage codec', () => {
  it('round-trips records exactly, keeping missing fields apart from null', () => {
    const records = [
      { id: 'a', amount: 1, note: null, tags: ['x'], nested: { a: 1 } },
      { id: 'b', amount: 1, extra: true },
      { id: 'c', amount: 2, note: 'hi', nested: { a: 1 } },
      { id: 'd', amount: 0, flag: false, empty: '' },
    ]
    const decoded = decodeTable(JSON.parse(JSON.stringify(encodeTable(records))) as ReturnType<typeof encodeTable>)
    expect(decoded).toEqual(records)
    expect('note' in (decoded[1] as object)).toBe(false)
    expect(decoded[0]?.note).toBeNull()
  })

  it('handles empty tables and keeps non-array fields', () => {
    const db = { version: 5, list: [], settings: { currency: 'USD' }, sequences: { a: 1 } }
    const encoded = encodeDatabase(db)
    expect(isEncodedDatabase(JSON.parse(JSON.stringify(encoded)))).toBe(true)
    expect(decodeDatabase(encoded)).toEqual(db)
  })

  it('round-trips the full seeded database and makes it much smaller', () => {
    const db = readDatabase()
    const encoded = JSON.stringify(encodeDatabase(db as unknown as { version: number } & Record<string, unknown>))
    expect(decodeDatabase(JSON.parse(encoded) as ReturnType<typeof encodeDatabase>)).toEqual(db)
    expect(encoded.length).toBeLessThan(JSON.stringify(db).length * 0.5)
  })
})
