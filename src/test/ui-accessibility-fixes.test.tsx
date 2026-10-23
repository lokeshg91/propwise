import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

import { buttonVariants } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import css from '@/styles/globals.css?raw'

/**
 * Phase 9 Stage 5A regression tests for two shared-component fixes:
 * F1 — destructive buttons meet WCAG AA contrast in dark mode, at rest and on hover;
 * F2 — closing a dialog returns focus to the element that opened it.
 */

/* ------------------------------------------------------------------ F1 */

function token(block: ':root' | '.dark', name: string): string {
  const start = css.indexOf(`${block} {`)
  const body = css.slice(start, css.indexOf('}', start))
  const value = body.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`))?.[1]
  if (!value) throw new Error(`--${name} not found in ${block}`)
  return value
}
const rgb = (hex: string) => [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16))
const luminance = (channels: number[]) => {
  const [r, g, b] = channels.map((value) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
const contrast = (a: number[], b: number[]) => {
  const [x, y] = [luminance(a), luminance(b)]
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
/** The danger text on a `bg-destructive/<percent>` tint over the given background. */
const onTint = (danger: string, background: string, percent: number) => {
  const tint = rgb(danger).map((value, index) => value * (percent / 100) + (rgb(background)[index] as number) * (1 - percent / 100))
  return contrast(rgb(danger), tint)
}
const tintOf = (classes: string, prefix: string) => Number(classes.match(new RegExp(`(?:^|\\s)${prefix}bg-destructive/(\\d+)(?:\\s|$)`))?.[1])

describe('F1: destructive button contrast', () => {
  const classes = buttonVariants({ variant: 'destructive' })

  it('meets 4.5:1 in dark mode at rest and on hover, on cards and dialogs', () => {
    const danger = token('.dark', 'danger')
    for (const surface of ['card', 'popover', 'background']) {
      const background = token('.dark', surface)
      expect(onTint(danger, background, tintOf(classes, 'dark:')), `dark rest on ${surface}`).toBeGreaterThanOrEqual(4.5)
      expect(onTint(danger, background, tintOf(classes, 'dark:hover:')), `dark hover on ${surface}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('keeps the light-mode styles unchanged (and above 4.5:1)', () => {
    expect(tintOf(classes, '')).toBe(10)
    expect(tintOf(classes, 'hover:')).toBe(20)
    const danger = token(':root', 'danger')
    expect(onTint(danger, token(':root', 'card'), 10)).toBeGreaterThanOrEqual(4.5)
    expect(onTint(danger, token(':root', 'card'), 20)).toBeGreaterThanOrEqual(4.5)
  })
})

/* ------------------------------------------------------------------ F2 */

function StateDialog({ onCloseAutoFocus, removeOpener = false }: { onCloseAutoFocus?: (event: Event) => void; removeOpener?: boolean }) {
  const [open, setOpen] = useState(false)
  const [opener, setOpener] = useState(true)
  return (
    <>
      <button type="button">Before</button>
      {opener ? (
        <button type="button" onClick={() => setOpen(true)}>
          Open from state
        </button>
      ) : null}
      <button type="button">Elsewhere</button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next && removeOpener) setOpener(false)
        }}
      >
        <DialogContent onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>State dialog</DialogTitle>
          <DialogDescription>Opened without a trigger.</DialogDescription>
          <button type="button" onClick={() => setOpen(false)}>
            Done
          </button>
        </DialogContent>
      </Dialog>
    </>
  )
}

describe('F2: dialog focus restoration', () => {
  it('returns focus to the invoking element when a dialog opened from state closes with Escape', async () => {
    const user = userEvent.setup()
    render(<StateDialog />)
    await user.click(screen.getByRole('button', { name: 'Open from state' }))
    expect(await screen.findByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open from state' })).toHaveFocus())
  })

  it('returns focus after a button inside the dialog closes it', async () => {
    const user = userEvent.setup()
    render(<StateDialog />)
    screen.getByRole('button', { name: 'Open from state' }).focus()
    await user.keyboard('{Enter}')
    await user.click(await screen.findByRole('button', { name: 'Done' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open from state' })).toHaveFocus())
  })

  it('returns focus to the invoking element when the dialog content focuses itself on mount (autoFocus)', async () => {
    function AutoFocusDialog() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open search
          </button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogTitle>Search</DialogTitle>
              <DialogDescription>Content with an autofocused field.</DialogDescription>
              {open ? <input aria-label="Query" autoFocus /> : null}
            </DialogContent>
          </Dialog>
        </>
      )
    }
    const user = userEvent.setup()
    render(<AutoFocusDialog />)
    await user.click(screen.getByRole('button', { name: 'Open search' }))
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Query' })).toHaveFocus())
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open search' })).toHaveFocus())
  })

  it('keeps Radix focus handling with a DialogTrigger', async () => {
    const user = userEvent.setup()
    render(
      <Dialog>
        <DialogTrigger>Open with trigger</DialogTrigger>
        <DialogContent>
          <DialogTitle>Trigger dialog</DialogTitle>
          <DialogDescription>Has a trigger.</DialogDescription>
        </DialogContent>
      </Dialog>,
    )
    await user.click(screen.getByRole('button', { name: 'Open with trigger' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open with trigger' })).toHaveFocus())
  })

  it('calls a caller-provided onCloseAutoFocus, and leaves focus to it when it prevents the default', async () => {
    const user = userEvent.setup()
    const handler = vi.fn((event: Event) => {
      event.preventDefault()
      screen.getByRole('button', { name: 'Elsewhere' }).focus()
    })
    render(<StateDialog onCloseAutoFocus={handler} />)
    await user.click(screen.getByRole('button', { name: 'Open from state' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1))
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByRole('button', { name: 'Elsewhere' })).toHaveFocus()
  })

  it('calls a caller handler that does not prevent the default, then still restores focus', async () => {
    const user = userEvent.setup()
    const handler = vi.fn()
    render(<StateDialog onCloseAutoFocus={handler} />)
    await user.click(screen.getByRole('button', { name: 'Open from state' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Open from state' })).toHaveFocus())
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('does nothing (and does not throw) when the invoking element is no longer in the document', async () => {
    const user = userEvent.setup()
    render(<StateDialog removeOpener />)
    await user.click(screen.getByRole('button', { name: 'Open from state' }))
    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole('button', { name: 'Open from state' })).not.toBeInTheDocument()
    expect(document.activeElement).toBe(document.body)
  })
})
