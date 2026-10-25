import { Link } from 'react-router'

import { LegalDocument, LegalList, Placeholder, type LegalSection } from '@/features/legal/components/legal-document'
import { LEGAL_DETAILS } from '@/features/legal/lib/policies'

const { product, operator, contactEmail, jurisdiction } = LEGAL_DETAILS

const SECTIONS: readonly LegalSection[] = [
  {
    id: 'agreement',
    title: 'Agreement',
    content: (
      <p>
        These terms apply to your use of {product}, provided by <Placeholder>{operator}</Placeholder>. By using {product}, you agree to them. If you use it on
        behalf of an organisation, you confirm that you may accept these terms for that organisation.
      </p>
    ),
  },
  {
    id: 'service',
    title: 'What Propwise does',
    content: (
      <>
        <p>
          {product} is a workspace for managing properties, units, tenants and leases, maintenance, vendors and finance records, with reports and settings.
          In this version:
        </p>
        <LegalList
          items={[
            'it runs in your browser and keeps its data on your device (see the Privacy policy);',
            'it records payments and bills but doesn’t process payments or move money;',
            'it doesn’t send emails or messages to tenants, vendors or anyone else;',
            'sign-in is a demonstration and doesn’t create or protect a user account.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'your-data',
    title: 'Your data and responsibilities',
    content: (
      <>
        <p>You are responsible for the information you enter and for how you use it. In particular, you agree to:</p>
        <LegalList
          items={[
            'enter information you are allowed to use, including personal information about tenants and other people;',
            'check that records, amounts and dates are correct;',
            <>
              keep your own backups. Data saved in a browser can be lost if site data is cleared; you can download a backup in{' '}
              <Link to="/settings?tab=data" className="font-medium text-primary underline-offset-4 hover:underline">Settings → Data &amp; storage</Link>.
            </>,
          ]}
        />
      </>
    ),
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable use',
    content: (
      <>
        <p>You agree not to use {product}:</p>
        <LegalList
          items={[
            'in breach of any law, including housing, consumer, privacy and anti-discrimination laws;',
            'to store information you have no right to hold;',
            'to interfere with the app or with other people’s use of it.',
          ]}
        />
      </>
    ),
  },
  {
    id: 'figures',
    title: 'Financial figures and reports',
    content: (
      <>
        <p>
          Balances, late fees, reports and other figures are calculated from the information you enter, using the rules you set. They aren’t accounting, tax,
          legal or financial advice, and they aren’t audited statements. Check important figures before relying on them.
        </p>
        <p>Changing the workspace currency relabels amounts; it doesn’t convert them at an exchange rate.</p>
      </>
    ),
  },
  {
    id: 'availability',
    title: 'Availability and changes',
    content: (
      <p>
        {product} may change, gain or lose features, or become unavailable. Because data is kept in your browser, updates to the app may upgrade the saved
        data format; keep backups before major updates.
      </p>
    ),
  },
  {
    id: 'ownership',
    title: 'Ownership and licence',
    content: (
      <p>
        The {product} software, design and content are owned by <Placeholder>{operator}</Placeholder> or its licensors and are licensed, not sold. Your use is
        subject to the licence that comes with your copy. Your data remains yours.
      </p>
    ),
  },
  {
    id: 'disclaimer',
    title: 'Disclaimer',
    content: (
      <p>
        {product} is provided “as is” and “as available”, without warranties of any kind, to the extent the law allows.{' '}
        <Placeholder>[Add any warranties, consumer rights or exclusions that apply to your business.]</Placeholder>
      </p>
    ),
  },
  {
    id: 'liability',
    title: 'Limitation of liability',
    content: (
      <p>
        <Placeholder>[Set out the limits of liability that apply to your business and jurisdiction, and any rights that can’t be limited.]</Placeholder>
      </p>
    ),
  },
  {
    id: 'law',
    title: 'Governing law',
    content: (
      <p>
        These terms are governed by the laws of <Placeholder>{jurisdiction}</Placeholder>.
      </p>
    ),
  },
  {
    id: 'changes',
    title: 'Changes to these terms',
    content: <p>When these terms change, the “Last updated” date at the top of the page changes too. Continuing to use {product} means you accept the new terms.</p>,
  },
  {
    id: 'contact',
    title: 'Contact',
    content: (
      <p>
        Questions about these terms: <Placeholder>{operator}</Placeholder>, <Placeholder>{contactEmail}</Placeholder>.
      </p>
    ),
  },
]

export function TermsPage() {
  return <LegalDocument policy="terms" sections={SECTIONS} />
}
