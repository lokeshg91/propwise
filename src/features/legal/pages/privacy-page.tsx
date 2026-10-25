import { Link } from 'react-router'

import { LegalDocument, LegalList, Placeholder, type LegalSection } from '@/features/legal/components/legal-document'
import { LEGAL_DETAILS } from '@/features/legal/lib/policies'

const { product, operator, contactEmail } = LEGAL_DETAILS

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'scope',
    title: 'About this policy',
    content: (
      <>
        <p>
          This policy explains how {product}, operated by <Placeholder>{operator}</Placeholder>, handles information when you use this property-management
          workspace. It covers the information you enter, where it is kept and the choices you have.
        </p>
        <p>
          In this version, {product} runs entirely in your web browser. Sign-in is a demonstration: no account is created, and there is no server-side
          database and no connection to payment, email or messaging services.
        </p>
      </>
    ),
  },
  {
    id: 'information',
    title: 'Information the workspace holds',
    content: (
      <>
        <p>The workspace holds the information you enter or change, for example:</p>
        <LegalList
          items={[
            'properties and units, including addresses, rents and occupancy;',
            'tenants and leases, including names, email addresses, phone numbers, emergency contacts and lease terms;',
            'maintenance requests and work orders, including descriptions, notes and costs;',
            'vendors, including company and contact details;',
            'staff members, including names, email addresses, phone numbers, job titles, roles and the properties they look after;',
            'finance records such as charges, payments and bills, and the settings and history of the workspace;',
            'your profile on the Account page: name, email address, phone number, job title, an optional photo and your notification preferences;',
            'your in-app notifications, which repeat details of the records they are about (such as a tenant’s name or an amount), and which ones you’ve read.',
          ]}
        />
        <p>
          A new workspace starts with fictional sample records, a fictional sample profile and a fictional sample team so you can explore {product}. They don’t describe real people
          or properties.
        </p>
        <p>
          A profile photo is cropped and resized to 256 × 256 pixels in your browser, and only that small copy is kept. The original file isn’t saved or
          uploaded.
        </p>
      </>
    ),
  },
  {
    id: 'sign-in',
    title: 'Sign-in and password forms',
    content: (
      <>
        <p>
          The sign-in, sign-up, forgot-password, reset-password and email-verification pages, and Change password on the Account page, are a
          demonstration. What you type into them, including your name, email address and password, is checked in the browser and then discarded. It isn’t
          saved or sent anywhere, and no email is sent. Passwords are never stored.
        </p>
        <p>
          The only thing kept is a “signed out” flag, saved when you sign out and removed when you sign in, so the app knows to show the sign-in page.
        </p>
      </>
    ),
  },
  {
    id: 'storage',
    title: 'Where it is stored',
    content: (
      <>
        <p>
          Everything is stored in your browser’s local storage, on the device you are using. {product} does not send workspace information to a server and
          does not store it in a cloud database. Another browser or device doesn’t see your workspace.
        </p>
        <p>
          The <Link to="/cookies" className="font-medium text-primary underline-offset-4 hover:underline">Cookies and local storage</Link> page lists exactly
          what is saved.
        </p>
      </>
    ),
  },
  {
    id: 'use',
    title: 'How it is used',
    content: (
      <p>
        The information is used only inside the workspace on your device: to show your records, calculate figures such as balances and reports, and
        remember your settings. {product} doesn’t use it for advertising, profiling or analytics, and doesn’t include tracking or analytics scripts.
      </p>
    ),
  },
  {
    id: 'sharing',
    title: 'Sharing and files you create',
    content: (
      <>
        <p>{product} doesn’t share your information with anyone. Information leaves the workspace only when you choose to:</p>
        <LegalList
          items={[
            'export a report as a CSV file;',
            'print a report or save it as a PDF;',
            'download a backup of the workspace.',
          ]}
        />
        <p>These files are saved where you choose and may contain personal information. Store and share them with care.</p>
      </>
    ),
  },
  {
    id: 'others',
    title: 'Information about other people',
    content: (
      <p>
        If you enter information about other people, such as tenants, emergency contacts, vendors or staff members, make sure you are allowed to do so under the laws
        that apply to you, and only enter what you need to manage the property.
      </p>
    ),
  },
  {
    id: 'retention',
    title: 'Keeping and deleting information',
    content: (
      <>
        <p>Information stays in your browser until you remove it. You can:</p>
        <LegalList
          items={[
            <>
              reset the workspace in <Link to="/settings?tab=data" className="font-medium text-primary underline-offset-4 hover:underline">Settings → Data &amp; storage</Link>,
              which deletes your records and profile and restores the sample workspace;
            </>,
            'change or remove your profile details and photo on the Account page;',
            'clear this site’s data in your browser settings, which removes everything Propwise saved;',
            'delete any backups, exports or PDFs you downloaded.',
          ]}
        />
        <p>Clearing your browser data or using a private window can also remove the workspace, so keep a backup of anything you need.</p>
      </>
    ),
  },
  {
    id: 'hosting',
    title: 'Hosting',
    content: (
      <p>
        The organisation that hosts this copy of {product} may receive standard technical information when your browser loads the app, such as your IP
        address and browser type, under its own policies. {product} itself doesn’t add any data collection to those requests.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to this policy',
    content: <p>When this policy changes, the “Last updated” date at the top of the page changes too.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    content: (
      <p>
        Questions about this policy: <Placeholder>{operator}</Placeholder>, <Placeholder>{contactEmail}</Placeholder>.
      </p>
    ),
  },
]

export function PrivacyPage() {
  return <LegalDocument policy="privacy" sections={SECTIONS} />
}
