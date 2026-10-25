import { ChevronDown, Info } from 'lucide-react'
import { type ReactNode } from 'react'
import { NavLink } from 'react-router'

import { LEGAL_DETAILS, POLICY_PAGES, policyPage, type PolicyId } from '@/features/legal/lib/policies'
import { useFormat } from '@/hooks/use-format'
import { cn } from '@/lib/utils'

export interface LegalSection {
  id: string
  title: string
  content: ReactNode
}

/** Long-form policy page: title, sample-content notice, policy switcher, contents and sections. */
export function LegalDocument({ policy, sections }: { policy: PolicyId; sections: readonly LegalSection[] }) {
  const page = policyPage(policy)
  const { longDate } = useFormat()

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="flex flex-col gap-3 border-b border-border pb-6">
        <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">Legal</p>
        <h1 className="text-h1 text-foreground sm:text-display">{page.title}</h1>
        <p className="max-w-[68ch] text-body-lg text-muted-foreground">{page.summary}</p>
        <p className="text-caption text-muted-foreground">
          Last updated <time dateTime={LEGAL_DETAILS.lastUpdated}>{longDate(LEGAL_DETAILS.lastUpdated)}</time>
        </p>
      </header>

      <nav aria-label="Policies" className="mt-4 border-b border-border print:hidden">
        <ul className="-mb-px flex gap-1 overflow-x-auto">
          {POLICY_PAGES.map((entry) => (
            <li key={entry.id} className="shrink-0">
              <NavLink
                to={entry.path}
                aria-label={entry.title}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-10 items-center border-b-2 px-3 text-body font-medium transition-colors outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50',
                    isActive ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <span className="sm:hidden">{entry.label}</span>
                <span className="max-sm:hidden">{entry.title}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8 grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <aside className="hidden lg:block print:hidden" aria-label="On this page">
          <div className="sticky top-8">
            <p className="text-label text-foreground">On this page</p>
            <Contents sections={sections} />
          </div>
        </aside>

        <article className="flex min-w-0 max-w-[68ch] flex-col gap-10">
          <details className="group rounded-lg border border-border lg:hidden print:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-label text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              On this page
              <ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="px-4 pb-3">
              <Contents sections={sections} />
            </div>
          </details>
          <aside aria-label="About this document" className="flex gap-3 rounded-lg border border-info/30 bg-info/10 p-4 dark:bg-info/15">
            <Info className="mt-0.5 size-5 shrink-0 text-info" aria-hidden="true" />
            <div className="flex flex-col gap-1">
              <p className="text-body font-semibold text-foreground">Sample content — review and replace before production use</p>
              <p className="text-body text-foreground/80">
                This page is template text that comes with {LEGAL_DETAILS.product}. It isn’t legal advice and hasn’t been reviewed by a lawyer. Before you use
                {` ${LEGAL_DETAILS.product}`} with real customers, have it reviewed for your business and jurisdiction, and replace the placeholders shown in
                brackets, such as <Placeholder>{LEGAL_DETAILS.operator}</Placeholder>.
              </p>
            </div>
          </aside>

          {sections.map((section, index) => (
            <section key={section.id} id={section.id} aria-labelledby={`${section.id}-title`} className="flex scroll-mt-8 flex-col gap-3">
              <h2 id={`${section.id}-title`} className="text-h2 text-foreground">
                <span className="mr-2 text-muted-foreground tabular-nums">{index + 1}.</span>
                {section.title}
              </h2>
              <div className="flex flex-col gap-3 text-body-lg leading-7 text-foreground/90">{section.content}</div>
            </section>
          ))}
        </article>
      </div>
    </div>
  )
}

function Contents({ sections }: { sections: readonly LegalSection[] }) {
  return (
    <ol className="mt-2 flex flex-col gap-1.5 border-l border-border">
      {sections.map((section) => (
        <li key={section.id}>
          <a
            href={`#${section.id}`}
            className="-ml-px block border-l border-transparent py-0.5 pl-3 text-caption text-muted-foreground transition-colors outline-none hover:border-foreground/40 hover:text-foreground focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {section.title}
          </a>
        </li>
      ))}
    </ol>
  )
}

/** A detail the operator must fill in, shown in brackets. */
export function Placeholder({ children }: { children: ReactNode }) {
  return <span className="rounded bg-muted px-0.5 font-medium text-foreground">{children}</span>
}

/** A bulleted list inside a policy section. */
export function LegalList({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}
