import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { prismaClient } from '@/lib/prismaClient'
import { EmailSettings } from '../_components/EmailSettings'

/** The creator's own outgoing email, shared by Form, callback requests, Reviews and webinar reminders. */
export default async function EmailIntegrationPage() {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const row = await prismaClient.emailConnection.findUnique({
    where: { userId: auth.user.id },
    select: { provider: true, host: true, port: true, secure: true, username: true, fromEmail: true, fromName: true, verifiedAt: true, lastError: true },
  })
  const platformFallback = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)

  return (
    <PageViewport scrollable>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2">
        <Link href="/integrations" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Integrations
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Email</h1>
          <p className="text-sm text-muted-foreground">
            Send from your own address. Form answers, callback requests, review requests and webinar reminders all use this one
            account.
          </p>
        </div>
        <EmailSettings
          ownerEmail={auth.user.email ?? ''}
          platformFallback={platformFallback}
          connection={row ? { ...row, verifiedAt: row.verifiedAt?.toISOString() ?? null } : null}
        />
      </div>
    </PageViewport>
  )
}
