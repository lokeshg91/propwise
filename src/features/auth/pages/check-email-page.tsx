import { MailOpen } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { AuthCard, DemoNotice } from '@/features/auth/components/auth-card'
import { demoLinkFor, type DemoTokenKind } from '@/features/auth/lib/demo-tokens'
import { pendingEmail } from '@/features/auth/lib/pending-email'
import { useNext } from '@/features/auth/lib/use-next'
import { DEFAULT_NEXT } from '@/lib/safe-next'

const RESEND_SECONDS = 30
const KINDS: Record<DemoTokenKind, { title: string; link: string }> = {
  reset: { title: 'Check your email', link: 'a link to choose a new password' },
  verify: { title: 'Verify your email', link: 'a link to verify your email address' },
}

/**
 * "Check your email" for the reset and sign-up flows. DEMO ONLY: no email is
 * sent. The demo button stands in for the link a real email would contain.
 */
export function CheckEmailPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { next, withNext } = useNext()
  const kind = params.get('for') === 'verify' ? 'verify' : params.get('for') === 'reset' ? 'reset' : null
  const email = pendingEmail()
  const [cooldown, setCooldown] = useState(0)
  const [resent, setResent] = useState(false)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  const copy = kind ? KINDS[kind] : null
  return (
    <AuthCard
      title={copy?.title ?? 'Check your email'}
      description={
        <>
          In a live app, we’d send {copy?.link ?? 'you a link'} to{' '}
          {email ? <strong className="font-medium text-foreground">{email}</strong> : 'your email address'}. This demo doesn’t send email.
        </>
      }
      footer={
        <Link to={withNext('/login')} className="font-medium text-primary underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      {kind ? (
        <>
          <Button size="lg" className="w-full" onClick={() => void navigate(demoLinkFor(kind, next === DEFAULT_NEXT ? undefined : next))}>
            <MailOpen data-icon="inline-start" />
            Demo: open the link from the email
          </Button>
          <div className="flex flex-col items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              disabled={cooldown > 0}
              onClick={() => {
                setResent(true)
                setCooldown(RESEND_SECONDS)
              }}
            >
              {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend email'}
            </Button>
            <p role="status" className="text-caption text-muted-foreground">
              {resent ? 'Demo: nothing was sent. In a live app, we’d send another email.' : ''}
            </p>
          </div>
        </>
      ) : (
        <Button asChild size="lg" className="w-full">
          <Link to={withNext('/login')}>Back to sign in</Link>
        </Button>
      )}
      <DemoNotice>Demo: no email is sent, and demo links aren’t saved. The demo button opens the page a real email link would open.</DemoNotice>
    </AuthCard>
  )
}
