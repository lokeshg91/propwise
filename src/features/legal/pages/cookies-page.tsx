import { Link } from 'react-router'

import { LegalDocument, LegalList, type LegalSection } from '@/features/legal/components/legal-document'
import { LEGAL_DETAILS, STORAGE_ENTRIES } from '@/features/legal/lib/policies'

const { product } = LEGAL_DETAILS

/** The storage items as a table from 640 px (and in print), and as stacked entries on phones, so every column stays readable. */
function StorageTable() {
  return (
    <>
      <ul aria-label={`What ${product} saves in your browser’s local storage`} className="flex flex-col divide-y divide-border rounded-lg border border-border sm:hidden print:hidden">
        {STORAGE_ENTRIES.map((entry) => (
          <li key={entry.key} className="flex flex-col gap-2 p-3">
            <code className="self-start rounded bg-muted px-1.5 py-0.5 font-mono text-caption break-all text-foreground">{entry.key}</code>
            <dl className="flex flex-col gap-2 text-body">
              <div>
                <dt className="text-label text-foreground">What it holds</dt>
                <dd className="text-foreground">{entry.purpose}</dd>
                <dd className="text-caption text-muted-foreground">{entry.contents}</dd>
              </div>
              <div>
                <dt className="text-label text-foreground">When it’s saved</dt>
                <dd className="text-caption text-muted-foreground">{entry.written}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
      <div className="hidden rounded-lg border border-border sm:block print:block">
        <table className="w-full border-collapse text-left text-body">
          <caption className="sr-only">What {product} saves in your browser’s local storage</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="px-3 py-2 text-label text-foreground">Key</th>
              <th scope="col" className="px-3 py-2 text-label text-foreground">What it holds</th>
              <th scope="col" className="px-3 py-2 text-label text-foreground">When it’s saved</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE_ENTRIES.map((entry) => (
              <tr key={entry.key} className="border-t border-border align-top">
                <th scope="row" className="px-3 py-2.5 font-normal">
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-caption whitespace-nowrap text-foreground">{entry.key}</code>
                </th>
                <td className="px-3 py-2.5">
                  <span className="block text-foreground">{entry.purpose}</span>
                  <span className="block text-caption text-muted-foreground">{entry.contents}</span>
                </td>
                <td className="px-3 py-2.5 text-caption text-muted-foreground">{entry.written}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'summary',
    title: 'Summary',
    content: (
      <p>
        {product} <strong className="font-semibold text-foreground">doesn’t use cookies</strong>. It saves a small number of items in your browser’s local
        storage so your workspace and preferences are still there next time. Nothing is used for advertising, analytics or tracking.
      </p>
    ),
  },
  {
    id: 'difference',
    title: 'Cookies and local storage',
    content: (
      <>
        <p>Both are ways for a website to save information in your browser, but they work differently:</p>
        <LegalList
          items={[
            <>
              <strong className="font-semibold text-foreground">Cookies</strong> are small pieces of data that the browser sends back to the website with every
              request, so a server can read them. They are often used for sign-in sessions, analytics and advertising.
            </>,
            <>
              <strong className="font-semibold text-foreground">Local storage</strong> keeps data in the browser for that website only. It isn’t sent with
              requests; only the page running in your browser can read it.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'what-we-store',
    title: 'What Propwise saves',
    content: (
      <>
        <p>{product} saves these items in local storage and nothing else:</p>
        <StorageTable />
        <p>The workspace data is not sent to a server or stored in a cloud database.</p>
        <p>
          The sign-in, sign-up and password forms, including Change password on the Account page, are a demonstration: what you type into them isn’t
          saved or sent, and the demo email links and their tokens aren’t stored. Your profile on the Account page is saved with the workspace data.
        </p>
      </>
    ),
  },
  {
    id: 'not-used',
    title: 'What Propwise doesn’t use',
    content: (
      <LegalList
        items={[
          'cookies of any kind, first-party or third-party;',
          'analytics, advertising or tracking scripts;',
          'session storage or other browser databases.',
        ]}
      />
    ),
  },
  {
    id: 'control',
    title: 'Managing what is saved',
    content: (
      <LegalList
        items={[
          <>
            <Link to="/settings?tab=data" className="font-medium text-primary underline-offset-4 hover:underline">Settings → Data &amp; storage</Link> shows how
            much storage the workspace uses. Reset workspace deletes your records and profile and restores the sample workspace; your theme and sidebar preferences are kept.
          </>,
          'Clearing this site’s data in your browser settings removes everything Propwise saved, including your theme and sidebar preferences, and signs you back in to the demo.',
          'In a private or incognito window, the browser usually deletes local storage when the window closes.',
        ]}
      />
    ),
  },
  {
    id: 'consent',
    title: 'Consent',
    content: (
      <p>
        {product} doesn’t show a cookie banner, because it sets no cookies and only saves what the app needs to work. Whether you need a consent notice
        depends on the rules where you operate. If you add services that set cookies or track usage, such as analytics, sign-in or chat, update this page and
        check whether you need to ask for consent first.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this page',
    content: <p>When this page changes, the “Last updated” date at the top of the page changes too.</p>,
  },
]

export function CookiesPage() {
  return <LegalDocument policy="cookies" sections={SECTIONS} />
}
