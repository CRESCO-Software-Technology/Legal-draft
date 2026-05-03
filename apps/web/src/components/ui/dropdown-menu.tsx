/**
 * Minimal Radix DropdownMenu wrapper. Used by B.1 to collapse secondary
 * action buttons behind a kebab (⋯) on the contract detail page.
 */
import * as React from 'react'
import * as Radix from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'

export const DropdownMenu = Radix.Root
export const DropdownMenuTrigger = Radix.Trigger
export const DropdownMenuPortal = Radix.Portal

export const DropdownMenuContent = React.forwardRef<
  React.ElementRef<typeof Radix.Content>,
  React.ComponentPropsWithoutRef<typeof Radix.Content>
>(({ className, sideOffset = 6, align = 'end', ...props }, ref) => (
  <Radix.Portal>
    <Radix.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      className={cn(
        'z-50 min-w-[12rem] overflow-hidden rounded-lg border bg-white p-1 shadow-lg',
        'animate-in fade-in-0 zoom-in-95 data-[side=bottom]:slide-in-from-top-1',
        className,
      )}
      {...props}
    />
  </Radix.Portal>
))
DropdownMenuContent.displayName = 'DropdownMenuContent'

export const DropdownMenuItem = React.forwardRef<
  React.ElementRef<typeof Radix.Item>,
  React.ComponentPropsWithoutRef<typeof Radix.Item>
>(({ className, ...props }, ref) => (
  <Radix.Item
    ref={ref}
    className={cn(
      'flex items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 cursor-pointer outline-none',
      'hover:bg-gray-50 focus:bg-gray-50 data-[disabled]:opacity-50 data-[disabled]:cursor-not-allowed',
      className,
    )}
    {...props}
  />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

export const DropdownMenuSeparator = React.forwardRef<
  React.ElementRef<typeof Radix.Separator>,
  React.ComponentPropsWithoutRef<typeof Radix.Separator>
>(({ className, ...props }, ref) => (
  <Radix.Separator
    ref={ref}
    className={cn('my-1 h-px bg-gray-100', className)}
    {...props}
  />
))
DropdownMenuSeparator.displayName = 'DropdownMenuSeparator'

export const DropdownMenuLabel = React.forwardRef<
  React.ElementRef<typeof Radix.Label>,
  React.ComponentPropsWithoutRef<typeof Radix.Label>
>(({ className, ...props }, ref) => (
  <Radix.Label
    ref={ref}
    className={cn('px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400', className)}
    {...props}
  />
))
DropdownMenuLabel.displayName = 'DropdownMenuLabel'
