import { ToggleGroup } from 'radix-ui'

import { cn } from '@/lib/utils'

interface SegmentedControlProps<TValue extends string> {
  value: TValue
  onValueChange: (value: TValue) => void
  options: ReadonlyArray<{ value: TValue; label: string }>
  /** Accessible name for the group. */
  label: string
  className?: string
}

/** Single-select pill group for switching between a few mutually exclusive views. */
export function SegmentedControl<TValue extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
}: SegmentedControlProps<TValue>) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(next) => {
        const option = options.find((entry) => entry.value === next)
        // Radix emits "" when the active item is clicked again; keep a selection.
        if (option) onValueChange(option.value)
      }}
      className={cn(
        'inline-flex h-9 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5',
        className,
      )}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            'h-full cursor-pointer rounded-md px-3 text-label text-muted-foreground transition-[color,background-color,box-shadow] outline-none',
            'hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
            'data-[state=on]:bg-card data-[state=on]:text-foreground data-[state=on]:shadow-xs',
          )}
        >
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
