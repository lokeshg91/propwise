import { Link } from 'react-router'

import { SidebarNav } from '@/app/layouts/components/sidebar-nav'
import { BrandLogo } from '@/components/shared/brand-logo'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  unreadCount: number
}

/** Navigation drawer for screens below 1024px. */
export function MobileNav({ open, onOpenChange, unreadCount }: MobileNavProps) {
  const close = () => onOpenChange(false)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0 sm:max-w-72">
        <SheetHeader className="h-header shrink-0 justify-center border-b border-sidebar-border px-5 py-0">
          <SheetTitle asChild>
            <Link to="/dashboard" onClick={close} className="w-fit rounded-lg outline-none">
              <BrandLogo />
            </Link>
          </SheetTitle>
          <SheetDescription className="sr-only">Navigate between Propwise modules</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <SidebarNav unreadCount={unreadCount} onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
