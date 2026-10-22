/**
 * Compact storage format for the demo database (save format v5).
 *
 * Each array of records is stored column by column instead of as repeated
 * objects, so property names are written once per collection. A column with
 * few distinct values (categories, property ids, dates, the migration
 * timestamp…) is stored as a dictionary plus small indexes. Nothing is lost:
 * `decodeDatabase(encodeDatabase(db))` deep-equals `db`, including the
 * difference between a missing field and `null`.
 *
 * Only the stored string changes. Everything in memory stays plain objects.
 */

export const STORAGE_ENCODING = 'columns-1'

/** All values present and mostly distinct. */
interface PlainColumn {
  v: unknown[]
}
/** Distinct values once, then one index per row; -1 means the field is absent. */
interface DictionaryColumn {
  d: unknown[]
  i: number[]
}
type Column = PlainColumn | DictionaryColumn

export interface EncodedTable {
  /** Field names in first-seen order. */
  k: string[]
  /** Number of records. */
  n: number
  c: Column[]
}

export interface EncodedDatabase {
  version: number
  encoding: typeof STORAGE_ENCODING
  tables: Record<string, EncodedTable>
  [field: string]: unknown
}

const isRecordArray = (value: unknown): value is Array<Record<string, unknown>> =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry))

/** Finds a value's dictionary index; strings and numbers (almost every cell) skip JSON.stringify. */
class Dictionary {
  readonly values: unknown[] = []
  private readonly strings = new Map<string, number>()
  private readonly numbers = new Map<number, number>()
  private readonly others = new Map<string, number>()

  indexOf(value: unknown): number {
    const [map, key] =
      typeof value === 'string' ? [this.strings, value] : typeof value === 'number' ? [this.numbers, value] : [this.others, JSON.stringify(value)]
    let index = (map as Map<unknown, number>).get(key)
    if (index === undefined) {
      index = this.values.length
      this.values.push(value)
      ;(map as Map<unknown, number>).set(key, index)
    }
    return index
  }
}

export function encodeTable(records: ReadonlyArray<Record<string, unknown>>): EncodedTable {
  const keys: string[] = []
  const seen = new Set<string>()
  for (const record of records) {
    for (const key of Object.keys(record)) {
      if (!seen.has(key)) {
        seen.add(key)
        keys.push(key)
      }
    }
  }
  const columns = keys.map((key): Column => {
    const dictionary = new Dictionary()
    const indexes: number[] = new Array<number>(records.length)
    let present = 0
    for (let row = 0; row < records.length; row += 1) {
      const value = (records[row] as Record<string, unknown>)[key]
      if (value === undefined) {
        indexes[row] = -1
        continue
      }
      present += 1
      indexes[row] = dictionary.indexOf(value)
    }
    if (present === records.length && dictionary.values.length > records.length / 2) {
      return { v: records.map((record) => record[key]) }
    }
    return { d: dictionary.values, i: indexes }
  })
  return { k: keys, n: records.length, c: columns }
}

export function decodeTable(table: EncodedTable): Array<Record<string, unknown>> {
  const records: Array<Record<string, unknown>> = Array.from({ length: table.n }, () => ({}))
  table.k.forEach((key, column) => {
    const encoded = table.c[column]
    if (!encoded) return
    if ('v' in encoded) {
      encoded.v.forEach((value, row) => {
        ;(records[row] as Record<string, unknown>)[key] = value
      })
      return
    }
    encoded.i.forEach((index, row) => {
      if (index >= 0) (records[row] as Record<string, unknown>)[key] = encoded.d[index]
    })
  })
  return records
}

/** Encodes every top-level array of records; other fields are kept as they are. */
export function encodeDatabase(db: { version: number } & Record<string, unknown>): EncodedDatabase {
  const encoded: EncodedDatabase = { version: db.version, encoding: STORAGE_ENCODING, tables: {} }
  for (const [field, value] of Object.entries(db)) {
    if (field === 'version') continue
    if (isRecordArray(value)) encoded.tables[field] = encodeTable(value)
    else encoded[field] = value
  }
  return encoded
}

export function isEncodedDatabase(value: unknown): value is EncodedDatabase {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as Record<string, unknown>).encoding === STORAGE_ENCODING &&
    typeof (value as Record<string, unknown>).tables === 'object'
  )
}

export function decodeDatabase(encoded: EncodedDatabase): Record<string, unknown> {
  const db: Record<string, unknown> = {}
  for (const [field, value] of Object.entries(encoded)) {
    if (field === 'encoding' || field === 'tables') continue
    db[field] = value
  }
  for (const [field, table] of Object.entries(encoded.tables)) db[field] = decodeTable(table)
  return db
}
