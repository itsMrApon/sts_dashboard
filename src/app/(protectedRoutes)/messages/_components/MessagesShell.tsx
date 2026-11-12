import type { ReactNode } from 'react'
import { MessagesSubnav } from './MessagesSubnav'

type Props = {
  businessName: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

/** Header + section nav shared by every /messages page (single business, no room picker). */
export function MessagesShell({ businessName, title, description, actions, children }: Props) {
  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-4 border-b border-border pb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">{businessName}</p>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description ? <p className="max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
          </div>
          {actions}
        </div>
        <MessagesSubnav />
      </div>
      {children}
    </div>
  )
}
