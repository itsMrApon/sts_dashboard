import type { ReactNode } from 'react'
import { loadSocialContext } from '../_lib/socialContext'
import { SocialSubnav } from './SocialSubnav'

type Props = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

/** Header + section nav shared by every /social page (same layout as ServicesShell). */
export async function SocialShell({ title, description, actions, children }: Props) {
  const { business } = await loadSocialContext()

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">{business.name}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
        <SocialSubnav />
      </div>
      {children}
    </div>
  )
}
