import { type ComponentProps } from 'react'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

type ButtonProps = ComponentProps<typeof Button>

interface IconButtonProps extends Omit<ButtonProps, 'size' | 'aria-label'> {
  /** Accessible name. Also shown as the tooltip unless `tooltip` is false. */
  label: string
  size?: 'icon' | 'icon-sm' | 'icon-lg' | 'icon-xs'
  tooltip?: boolean
  tooltipSide?: ComponentProps<typeof TooltipContent>['side']
}

/**
 * Icon-only button with a required accessible label and an optional tooltip.
 * Works as a child of Radix `asChild` triggers (dropdowns, dialogs, sheets).
 */
export function IconButton({
  label,
  size = 'icon',
  variant = 'ghost',
  tooltip = true,
  tooltipSide = 'bottom',
  ...props
}: IconButtonProps) {
  const button = <Button size={size} variant={variant} aria-label={label} {...props} />

  if (!tooltip) return button

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side={tooltipSide} sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}
