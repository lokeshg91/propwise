import { useEffect, useId, useRef, useState, type RefObject } from 'react'
import { ArrowLeftRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type ReportColumn, type ReportRow, type ReportTableData } from '@/features/reports/lib/report-table'
import { useFormat } from '@/hooks/use-format'
import { type CsvValue } from '@/lib/csv'
import { cn } from '@/lib/utils'

const SCREEN_LIMIT = 25

function useCell() {
  const { money, number, percent, date } = useFormat()
  return (column: ReportColumn, value: CsvValue): string => {
    if (value === null || value === '') return '—'
    switch (column.kind) {
      case 'amount':
        return money(Number(value))
      case 'number':
        return number(Number(value))
      case 'percent':
        return percent(Number(value))
      case 'date':
        return date(String(value))
      case 'text':
        return String(value)
    }
  }
}

const isNumeric = (column: ReportColumn) => column.kind !== 'text' && column.kind !== 'date'

/** Whether the table is wider than its box, and whether it is scrolled to either edge. */
function useSideScroll(ref: RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState({ overflow: false, atStart: true, atEnd: true, pinned: 0 })
  useEffect(() => {
    const box = ref.current
    if (!box) return
    const update = () => {
      const overflow = box.scrollWidth > box.clientWidth + 1
      const atStart = box.scrollLeft <= 1
      const atEnd = box.scrollLeft + box.clientWidth >= box.scrollWidth - 1
      const pinned = overflow ? (box.querySelector('thead th')?.getBoundingClientRect().width ?? 0) : 0
      setState((old) => (old.overflow === overflow && old.atStart === atStart && old.atEnd === atEnd && Math.abs(old.pinned - pinned) < 1 ? old : { overflow, atStart, atEnd, pinned }))
    }
    update()
    box.addEventListener('scroll', update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(box)
    if (box.firstElementChild) observer.observe(box.firstElementChild)
    return () => {
      box.removeEventListener('scroll', update)
      observer.disconnect()
    }
  })
  return state
}

/* The first column stays in place while the table scrolls sideways; its background matches the row's. */
const STICKY = 'sticky left-0 z-10 print:static'
const STICKY_BODY = 'bg-card [tr:hover>&]:bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))]'
const STICKY_FOOT = 'bg-[color-mix(in_srgb,var(--muted)_50%,var(--card))]'

/**
 * Report table: every row (long tables show the first 25 on screen with a
 * "Show all" button; print always shows all), a totals row, and cards on
 * small screens. Headers repeat on every printed page.
 */
export function ReportTable({ data, caption, emptyText }: { data: ReportTableData; caption: string; emptyText: string }) {
  const cell = useCell()
  const [showAll, setShowAll] = useState(false)
  const columns = data.columns.filter((column) => !column.exportOnly)
  const primary = columns.find((column) => column.primary) ?? columns[0]
  const limited = !showAll && data.rows.length > SCREEN_LIMIT
  const scroller = useRef<HTMLDivElement>(null)
  const scroll = useSideScroll(scroller)
  const hintId = useId()
  const sticky = (index: number, part: 'head' | 'body' | 'foot') =>
    scroll.overflow && index === 0 ? cn(STICKY, part === 'foot' ? STICKY_FOOT : STICKY_BODY, !scroll.atStart && 'shadow-[1px_0_0_var(--border)]') : undefined

  if (data.rows.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-6 text-center text-body text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative hidden md:block print:block">
        {scroll.overflow ? (
          <p id={hintId} className="flex items-center gap-1.5 px-5 pb-2 text-caption text-muted-foreground print:hidden">
            <ArrowLeftRight className="size-3.5 shrink-0" aria-hidden="true" />
            <span>
              {columns.length} columns — scroll sideways to see them all{' '}
              <span className="hidden lg:inline">(Shift + scroll, or Tab to the table and use ← →)</span>
            </span>
          </p>
        ) : null}
        <div className="relative">
          <div
            ref={scroller}
            data-report-scroll=""
            data-overflow={scroll.overflow ? '' : undefined}
            className="report-scroll peer w-full overflow-x-auto focus-visible:outline-none print:overflow-visible"
            {...(scroll.overflow ? { tabIndex: 0, role: 'region', 'aria-label': `${caption}, scrolls sideways`, 'aria-describedby': hintId } : {})}
          >
            <Table aria-label={caption} containerClassName="overflow-visible" className={cn('report-table', columns.length > 9 && 'report-table-wide')}>
              <TableHeader>
                <TableRow>
                  {columns.map((column, columnIndex) => (
                    <TableHead key={column.key} className={cn('whitespace-nowrap first:pl-5 last:pr-5 print:first:pl-0 print:last:pr-0', isNumeric(column) && 'text-right', sticky(columnIndex, 'head'))}>
                      {column.header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row, index) => (
                  <TableRow key={index} data-report-overflow={index >= SCREEN_LIMIT && limited ? '' : undefined} className={cn(index >= SCREEN_LIMIT && limited && 'hidden print:table-row')}>
                    {columns.map((column, columnIndex) => (
                      <TableCell key={column.key} className={cn('first:pl-5 last:pr-5 print:first:pl-0 print:last:pr-0', isNumeric(column) && 'text-right tabular-nums', column === primary && 'font-medium text-foreground', sticky(columnIndex, 'body'))}>
                        {cell(column, row[column.key] ?? null)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
              {data.total ? (
                <TableFooter>
                  <TableRow>
                    {columns.map((column, columnIndex) => (
                      <TableCell key={column.key} className={cn('font-semibold first:pl-5 last:pr-5 print:first:pl-0 print:last:pr-0', isNumeric(column) && 'text-right tabular-nums', sticky(columnIndex, 'foot'))}>
                        {cell(column, (data.total as ReportRow)[column.key] ?? null)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableFooter>
              ) : null}
            </Table>
          </div>
          {/* Focus ring drawn above the pinned column (an outline on the box would sit under it). */}
          <div aria-hidden="true" data-report-focus="" className="pointer-events-none absolute inset-0 z-20 rounded-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring print:hidden" />
          {/* Edge fades show there is more to either side; the left one starts at the pinned column's edge. */}
          <div
            aria-hidden="true"
            style={{ left: scroll.pinned }}
            className={cn('pointer-events-none absolute inset-y-0 z-10 w-14 bg-linear-to-r from-card to-transparent transition-opacity print:hidden', scroll.overflow && !scroll.atStart ? 'opacity-100' : 'opacity-0')}
            data-report-fade="start"
          />
          <div
            aria-hidden="true"
            className={cn('pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-card to-transparent transition-opacity print:hidden', scroll.overflow && !scroll.atEnd ? 'opacity-100' : 'opacity-0')}
            data-report-fade="end"
          />
        </div>
      </div>

      <ul aria-label={caption} className="flex flex-col divide-y divide-border px-5 md:hidden print:hidden">
        {[...(limited ? data.rows.slice(0, SCREEN_LIMIT) : data.rows), ...(data.total ? [data.total] : [])].map((row, index, list) => (
          <li key={index} className={cn('flex flex-col gap-2 py-3 first:pt-0 last:pb-0', data.total && index === list.length - 1 && 'font-semibold')}>
            <p className="font-medium text-foreground">{cell(primary as ReportColumn, row[(primary as ReportColumn).key] ?? null)}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
              {columns
                .filter((column) => column !== primary && !column.secondary)
                .map((column) => (
                  <div key={column.key} className="flex min-w-0 justify-between gap-2">
                    <dt className="truncate text-muted-foreground">{column.header}</dt>
                    <dd className="text-foreground tabular-nums">{cell(column, row[column.key] ?? null)}</dd>
                  </div>
                ))}
            </dl>
          </li>
        ))}
      </ul>

      {data.rows.length > SCREEN_LIMIT ? (
        <div className="px-5 print:hidden">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? `Show the first ${SCREEN_LIMIT}` : `Show all ${data.rows.length} rows`}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
