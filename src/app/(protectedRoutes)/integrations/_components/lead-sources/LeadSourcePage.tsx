import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { onAuthenticateUser } from '@/actions/auth'
import { PageViewport } from '@/components/ReusableComponent/PageViewport'
import { loadLeadConnectionSettings, type LeadConnectionSettings } from '@/lib/leads/leadConnectionSettings'

/** The frame for /integrations/fathom, /google and /serper: a way back, a title, and the box. */
export async function LeadSourcePage({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: (settings: LeadConnectionSettings) => ReactNode
}) {
  const auth = await onAuthenticateUser()
  if (!auth.user) redirect('/sign-in')
  const settings = await loadLeadConnectionSettings(auth.user.id)

  return (
    <PageViewport scrollable>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-2">
        <Link href="/integrations" className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm">
          <ArrowLeft className="size-4" />
          Integrations
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        {children(settings)}
      </div>
    </PageViewport>
  )
}
