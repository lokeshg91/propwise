import { CornerDownLeft, Search, SearchX } from 'lucide-react'
import { type KeyboardEvent, useCallback, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'

import { NAV_ITEMS } from '@/app/routes/navigation'
import { IconButton } from '@/components/shared/icon-button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { useModifierHotkey } from '@/hooks/use-hotkey'
import { cn } from '@/lib/utils'

const isMac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.userAgent)

/**
 * Header search. In this release it searches app pages; connect it to your
 * own search API to include properties, tenants and work orders.
 */
export function HeaderSearch() {
  const [open, setOpen] = useState(false)
  const openSearch = useCallback(() => setOpen(true), [])
  useModifierHotkey('k', openSearch)

  return (
    <>
      <button
        type="button"
        onClick={openSearch}
        className="hidden h-9 w-64 cursor-pointer items-center gap-2 rounded-lg border border-input bg-card px-3 text-body text-muted-foreground shadow-xs transition-colors outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:flex lg:w-72"
      >
        <Search className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="pointer-events-none flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-sans text-[0.6875rem] font-medium text-muted-foreground">
          {isMac ? '⌘' : 'Ctrl'}
          <span>K</span>
        </kbd>
      </button>
      <IconButton label="Search" className="md:hidden" onClick={openSearch}>
        <Search />
      </IconButton>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          showCloseButton={false}
          className="top-[15%] max-w-[calc(100%-2rem)] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-lg"
        >
          {open ? <SearchPanel onClose={() => setOpen(false)} /> : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const results = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return NAV_ITEMS
    return NAV_ITEMS.filter(
      (item) =>
        item.label.toLowerCase().includes(term) || item.description.toLowerCase().includes(term),
    )
  }, [query])

  const go = (path: string) => {
    onClose()
    void navigate(path)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, results.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      const item = results[activeIndex]
      if (item) go(item.path)
    }
  }

  return (
    <>
      <DialogTitle className="sr-only">Search Propwise</DialogTitle>
      <DialogDescription className="sr-only">
        Type to filter pages, use the arrow keys to move and Enter to open.
      </DialogDescription>
      <div className="flex items-center gap-3 border-b border-border px-4">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-label="Search pages"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
          }}
          onKeyDown={onKeyDown}
          placeholder="Search pages…"
          className="h-12 w-full bg-transparent text-body-lg text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      {results.length > 0 ? (
        <ul id={listId} role="listbox" aria-label="Pages" className="max-h-80 overflow-y-auto p-2">
          {results.map((item, index) => {
            const Icon = item.icon
            const active = index === activeIndex
            return (
              <li
                key={item.path}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => go(item.path)}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5',
                  active && 'bg-accent text-accent-foreground',
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                  <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-foreground">{item.label}</span>
                  <span className="block truncate text-caption text-muted-foreground">
                    {item.description}
                  </span>
                </span>
                {active ? (
                  <CornerDownLeft className="size-4 text-muted-foreground" aria-hidden="true" />
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <SearchX className="size-5 text-muted-foreground" aria-hidden="true" />
          <p className="text-body font-medium text-foreground">No results for “{query}”</p>
          <p className="text-caption text-muted-foreground">Try a page name such as Tenants or Finance.</p>
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-2.5 text-caption text-muted-foreground">
        <span>Searching pages</span>
        <span className="hidden sm:inline">↑↓ to navigate · Enter to open · Esc to close</span>
      </div>
    </>
  )
}
