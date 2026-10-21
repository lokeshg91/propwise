import {
  type PaginationState,
  type RowData,
  type SortingState,
  type TableOptions,
  useTable,
} from '@tanstack/react-table'
import { ArrowDown, ArrowDownWideNarrow, ArrowUp, ArrowUpNarrowWide, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react'
import { type ReactNode, useState } from 'react'

import { type DataTableFeatures, dataTableFeatures } from '@/components/tables/data-table-features'
import { IconButton } from '@/components/shared/icon-button'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'

interface DataTableProps<TData extends RowData> {
  data: TData[]
  columns: TableOptions<DataTableFeatures, TData>['columns']
  /** Accessible description of the table (visually hidden). */
  caption: string
  /** Search text applied across searchable columns. */
  globalFilter?: string
  /** Column ids included in the global search. Defaults to all string/number columns. */
  searchableColumns?: readonly string[]
  initialSorting?: SortingState
  pageSize?: number
  getRowId?: (row: TData) => string
  /** Noun used in the footer count, e.g. "properties". */
  itemLabel?: string
  emptyState: ReactNode
  /** Minimum table width before it scrolls horizontally. */
  minWidth?: string
  /**
   * Optional card layout used below 1024px instead of the table. Sorting,
   * search and pagination still apply; a "Sort by" control replaces headers.
   */
  renderMobileRow?: (row: TData) => ReactNode
}

export function DataTable<TData extends RowData>({
  data,
  columns,
  caption,
  globalFilter = '',
  searchableColumns,
  initialSorting = [],
  pageSize = 10,
  getRowId,
  itemLabel = 'rows',
  emptyState,
  minWidth = '40rem',
  renderMobileRow,
}: DataTableProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>(initialSorting)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })

  // Return to the first page whenever the search or dataset changes.
  const [resetKey, setResetKey] = useState({ globalFilter, data })
  if (resetKey.globalFilter !== globalFilter || resetKey.data !== data) {
    setResetKey({ globalFilter, data })
    setPagination((current) => ({ ...current, pageIndex: 0 }))
  }

  const table = useTable({
    features: dataTableFeatures,
    columns,
    data,
    getRowId,
    state: { sorting, pagination, globalFilter },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    onGlobalFilterChange: () => undefined,
    globalFilterFn: 'includesString',
    getColumnCanGlobalFilter: searchableColumns
      ? (column) => searchableColumns.includes(column.id)
      : undefined,
    autoResetPageIndex: false,
  })

  const rows = table.getRowModel().rows
  const rowCount = table.getRowCount()
  const pageCount = table.getPageCount()
  const firstRow = rowCount === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1
  const lastRow = Math.min(rowCount, (pagination.pageIndex + 1) * pagination.pageSize)

  const sortableColumns = table
    .getAllLeafColumns()
    .filter((column) => column.getCanSort() && typeof column.columnDef.header === 'string')
  const activeSort = sorting[0]

  return (
    <div className="flex flex-col">
      {renderMobileRow ? (
        <div className="flex flex-col gap-3 px-5 pb-4 lg:hidden">
          {sortableColumns.length > 0 ? (
            <div className="flex items-center gap-2 md:max-w-sm">
              <Select
                value={activeSort?.id ?? ''}
                onValueChange={(id) => {
                  const column = table.getColumn(id)
                  if (column) setSorting([{ id, desc: column.getFirstSortDir() === 'desc' }])
                }}
              >
                <SelectTrigger aria-label="Sort by" className="flex-1">
                  <SelectValue placeholder="Sort by…" />
                </SelectTrigger>
                <SelectContent>
                  {sortableColumns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      Sort by {String(column.columnDef.header).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <IconButton
                variant="outline"
                label={activeSort?.desc ? 'Sorted descending' : 'Sorted ascending'}
                disabled={!activeSort}
                onClick={() => activeSort && setSorting([{ ...activeSort, desc: !activeSort.desc }])}
              >
                {activeSort?.desc ? <ArrowDownWideNarrow /> : <ArrowUpNarrowWide />}
              </IconButton>
            </div>
          ) : null}
          {rows.length > 0 ? (
            <ul className="grid gap-2 md:grid-cols-2" aria-label={caption}>
              {rows.map((row) => (
                <li key={row.id} className="rounded-lg border border-border p-3.5">
                  {renderMobileRow(row.original)}
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-lg border border-dashed border-border">{emptyState}</div>
          )}
        </div>
      ) : null}

      <Table style={{ minWidth }} containerClassName={cn(renderMobileRow && 'max-lg:hidden')}>
        <TableCaption className="sr-only">{caption}</TableCaption>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const meta = header.column.columnDef.meta
                const sorted = header.column.getIsSorted()
                const canSort = header.column.getCanSort()
                return (
                  <TableHead
                    key={header.id}
                    aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}
                    className={cn(
                      'h-10 text-caption font-semibold tracking-wide text-muted-foreground uppercase first:pl-5 last:pr-5',
                      meta?.align === 'end' && 'text-right',
                      meta?.headerClassName,
                    )}
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        onClick={header.column.getToggleSortingHandler()}
                        className={cn(
                          '-mx-1.5 inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 uppercase transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                          sorted && 'text-foreground',
                          meta?.align === 'end' && 'flex-row-reverse',
                        )}
                      >
                        <table.FlexRender header={header} />
                        {sorted === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : sorted === 'desc' ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {rows.length > 0 ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getAllCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'py-3 first:pl-5 last:pr-5',
                        meta?.align === 'end' && 'text-right tabular-nums',
                        meta?.cellClassName,
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          ) : (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={table.getAllLeafColumns().length} className="p-0">
                {emptyState}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 pt-4 text-caption text-muted-foreground',
          renderMobileRow && 'max-lg:border-t-0 max-lg:pt-0',
        )}
      >
        <p aria-live="polite">
          {rowCount === 0
            ? `No ${itemLabel}`
            : `Showing ${firstRow}–${lastRow} of ${rowCount} ${itemLabel}`}
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Page {pagination.pageIndex + 1} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Previous page of ${itemLabel}`}
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label={`Next page of ${itemLabel}`}
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
