import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { onAuthenticateUser } from '@/actions/auth'
import { LeadPageHeaderControls } from './LeadPageHeaderControls'
import { LeadViewport } from './LeadViewport'
import { LeadUnavailableState } from './LeadUnavailableState'

type SignedInUser = { id: string; email: string; name: string }

/**
 * Shared frame for /lead/<section>: the section tabs and the link to the lead connections, with the
 * section filling the rest of the height.
 */
export async function LeadSectionPage({ children }: { children: (user: SignedInUser) => ReactNode }) {
  const auth = await onAuthenticateUser()
  if (auth.status === 500) return <LeadUnavailableState />
  if (!auth.user) redirect('/sign-in')
  const user = { id: auth.user.id, email: auth.user.email || '', name: auth.user.name }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex shrink-0 justify-end">
        {/* Five tabs need about 760px at full size; below that the compact bar fits. */}
        <div className="md:hidden">
          <LeadPageHeaderControls compact />
        </div>
        <div className="hidden md:block">
          <LeadPageHeaderControls />
        </div>
      </div>

      <LeadViewport>{children(user)}</LeadViewport>
    </div>
  )
}

/** A section with nothing in it yet. */
export function LeadSectionEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-full min-h-[320px] items-center justify-center rounded-xl p-8 text-center">
      <div className="max-w-sm space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  )
}
