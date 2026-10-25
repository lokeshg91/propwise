import { CircleAlert, MailCheck, MailOpen, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { AuthCard, DemoNotice, DemoResult } from '@/features/auth/components/auth-card'
import { demoLinkFor } from '@/features/auth/lib/demo-tokens'
import { useDemoToken } from '@/features/auth/lib/use-demo-token'
import { useNext } from '@/features/auth/lib/use-next'
import { DEFAULT_NEXT } from '@/lib/safe-next'
import { signIn } from '@/lib/session'

/** Demo email verification. DEMO ONLY: no address is checked; continuing signs in as the demo user. */
export function VerifyEmailPage() {
  const navigate = useNavigate()
  const { next, withNext } = useNext()
  const status = useDemoToken('verify', '/verify-email')
  const [failure, setFailure] = useState<string | null>(null)
  const openDemoLink = () => void navigate(demoLinkFor('verify', next === DEFAULT_NEXT ? undefined : next))

  if (status === 'valid') {
    return (
      <DemoResult
        icon={MailCheck}
        title="Demo complete — no email was verified"
        action={
          <div className="flex flex-col gap-2">
            {failure ? (
              <p role="alert" className="flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-caption text-foreground dark:bg-danger/15">
                <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-danger" aria-hidden="true" />
                {failure}
              </p>
            ) : null}
            <Button
              size="lg"
              className="w-full"
              onClick={() => {
                if (!signIn()) {
                  setFailure('This browser didn’t allow Propwise to save the sign-in. Check that site data is allowed, then try again.')
                  return
                }
                void navigate(next, { replace: true })
              }}
            >
              Continue to Propwise
            </Button>
          </div>
        }
      >
        <p>This is a demonstration. No email address was checked or verified, and no account was created.</p>
        <p>You’ll continue as the demo user, Alex Morgan.</p>
      </DemoResult>
    )
  }

  if (status === 'invalid') {
    return (
      <DemoResult
        icon={TriangleAlert}
        title="This verification link is invalid or has expired"
        action={
          <div className="flex flex-col gap-2">
            <Button size="lg" className="w-full" onClick={openDemoLink}>
              <MailOpen data-icon="inline-start" />
              Demo: open a new link
            </Button>
            <Button asChild variant="ghost" className="w-full">
              <Link to={withNext('/login')}>Back to sign in</Link>
            </Button>
          </div>
        }
      >
        <p>Verification links work once. In a live app, you’d request a new email; here, the demo button opens a new link.</p>
      </DemoResult>
    )
  }

  return (
    <AuthCard
      title="Verify your email"
      description="In a live app, we’d send you a link to verify your email address. This demo doesn’t send email."
      footer={
        <Link to={withNext('/login')} className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Button size="lg" className="w-full" onClick={openDemoLink}>
        <MailOpen data-icon="inline-start" />
        Demo: open the link from the email
      </Button>
      <DemoNotice>Demo: no email is sent, and demo links aren’t saved.</DemoNotice>
    </AuthCard>
  )
}
