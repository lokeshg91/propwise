import { buildCsv, centsToCsv, CSV_BOM, formatCell, parseCsv, protectText, type CsvColumn } from '@/lib/csv'

describe('CSV amounts stay numeric', () => {
  it('writes cents as plain decimals, including negatives and zero', () => {
    expect(centsToCsv(125000)).toBe('1250.00')
    expect(centsToCsv(-125000)).toBe('-1250.00')
    expect(centsToCsv(0)).toBe('0.00')
    expect(centsToCsv(-5)).toBe('-0.05')
    expect(centsToCsv(98765432)).toBe('987654.32')
    expect(centsToCsv(1)).toBe('0.01')
    expect(() => centsToCsv(1.5)).toThrow()
  })

  it('never prefixes or quotes amounts, numbers or percentages', () => {
    const csv = buildCsv({
      columns: [
        { header: 'Net', kind: 'amount' },
        { header: 'Count', kind: 'number' },
        { header: 'Rate (%)', kind: 'percent' },
      ],
      rows: [
        [-125000, -3, -12.5],
        [0, 0, 0],
      ],
    })
    expect(csv).toBe(`${CSV_BOM}Net,Count,Rate (%)\r\n-1250.00,-3,-12.5\r\n0.00,0,0\r\n`)
    expect(csv).not.toContain("'-")
  })

  it('rejects values of the wrong type instead of writing them as text', () => {
    expect(() => formatCell('amount', '12.00')).toThrow()
    expect(() => formatCell('number', Number.NaN)).toThrow()
    expect(() => formatCell('date', '24/10/2026')).toThrow()
    expect(formatCell('date', '2026-10-24')).toBe('2026-10-24')
    expect(formatCell('amount', null)).toBe('')
  })
})

describe('CSV formula-injection protection (text cells only)', () => {
  it.each([
    ['=HYPERLINK("http://evil","x")', '\'=HYPERLINK("http://evil","x")'],
    ['+1+2', "'+1+2"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tTabbed', "'\tTabbed"],
    ['\rReturn', "'\rReturn"],
    ['-', "'-"],
    ['Harbor View', 'Harbor View'],
    ['A=B', 'A=B'],
  ])('%j → %j', (input, output) => {
    expect(protectText(input)).toBe(output)
    expect(formatCell('text', input)).toBe(output)
  })

  it('protects headers and comment lines too', () => {
    const csv = buildCsv({ comments: ['Property: =cmd'], columns: [{ header: '=Name', kind: 'text' }], rows: [] })
    expect(parseCsv(csv)).toEqual([['# Property: =cmd'], ["'=Name"]])
  })
})

describe('CSV encoding', () => {
  const columns: CsvColumn[] = [
    { header: 'Name', kind: 'text' },
    { header: 'Date', kind: 'date' },
    { header: 'Amount', kind: 'amount' },
  ]
  const rows = [
    ['Comma, Inc.', '2026-10-01', 125050],
    ['Quote "Q" Ltd', '2026-10-02', -500],
    ['Line\nbreak', '2026-10-03', 0],
    ['Café ünïcode — ✓', null, null],
  ] as const

  it('quotes per RFC 4180, uses CRLF and a UTF-8 BOM', () => {
    const csv = buildCsv({ comments: ['Report: Test', 'Period: Oct 1 – Oct 31, 2026'], columns, rows: rows.map((row) => [...row]) })
    expect(csv.startsWith(CSV_BOM)).toBe(true)
    expect(csv).toContain('"Comma, Inc."')
    expect(csv).toContain('"Quote ""Q"" Ltd"')
    expect(csv).toContain('"Line\nbreak"')
    expect(csv.split('\r\n').length).toBe(2 + 1 + rows.length + 1)
    expect([...new TextEncoder().encode(csv).slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
  })

  it('round-trips: parsing gives back the rows', () => {
    const csv = buildCsv({ columns, rows: rows.map((row) => [...row]) })
    expect(parseCsv(csv)).toEqual([
      ['Name', 'Date', 'Amount'],
      ['Comma, Inc.', '2026-10-01', '1250.50'],
      ['Quote "Q" Ltd', '2026-10-02', '-5.00'],
      ['Line\nbreak', '2026-10-03', '0.00'],
      ['Café ünïcode — ✓', '', ''],
    ])
  })

  it('requires one value per column', () => {
    expect(() => buildCsv({ columns, rows: [['only one']] })).toThrow()
  })
})
