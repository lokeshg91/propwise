import { RefreshCw } from 'lucide-react'

import { IconButton } from '@/components/shared/icon-button'
import { SegmentedControl } from '@/components/shared/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { isDateRange, RANGE_OPTIONS, TYPE_OPTIONS } from '@/features/dashboard/lib/dashboard-filters'
import { cn } from '@/lib/utils'
import { type DashboardFilters } from '@/types'

interface DashboardToolbarProps {
  filters: DashboardFilters
  onFilterChange: <TKey extends keyof DashboardFilters>(key: TKey, value: DashboardFilters[TKey]) => void
  onRefresh: () => void
  refreshing: boolean
}

export function DashboardToolbar({ filters, onFilterChange, onRefresh, refreshing }: DashboardToolbarProps) {
  return (
    <>
      <SegmentedControl
        label="Property type"
        value={filters.type}
        options={TYPE_OPTIONS}
        onValueChange={(value) => onFilterChange('type', value)}
      />
      <Select
        value={filters.range}
        onValueChange={(value) => {
          if (isDateRange(value)) onFilterChange('range', value)
        }}
      >
        <SelectTrigger aria-label="Date range" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {RANGE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <IconButton
        label={refreshing ? 'Refreshing data' : 'Refresh data'}
        variant="outline"
        onClick={onRefresh}
        aria-disabled={refreshing}
        className="aria-disabled:pointer-events-none"
      >
        <RefreshCw className={cn(refreshing && 'animate-spin')} />
      </IconButton>
    </>
  )
}
