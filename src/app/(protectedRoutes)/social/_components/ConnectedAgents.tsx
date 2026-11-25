'use client'

import { formatDistanceToNow } from 'date-fns'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from '@/lib/toast'
import { guardAction } from '@/lib/clientActionErrors'
import { revokeCliTokenAction } from '@/actions/cli'

export type ConnectedAgent = {
  id: string
  clientLabel: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt: string | null
}

/** The computers and agents the CLI connected to this business, each one revocable. */
export function ConnectedAgents({ agents }: { agents: ConnectedAgent[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  if (agents.length === 0) return null

  return (
    <div className="border-t border-border px-4 py-3">
      <h3 className="text-muted-foreground mb-2 text-[11px] font-medium tracking-wide uppercase">Connected agents</h3>
      <ul className="divide-border divide-y">
        {agents.map((agent) => (
          <li key={agent.id} className="flex items-center gap-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">
                {agent.clientLabel} · {agent.name}
              </div>
              <div className="text-muted-foreground truncate text-xs">
                <span className="font-mono">{agent.prefix}…</span> · connected {formatDistanceToNow(new Date(agent.createdAt), { addSuffix: true })}
                {agent.lastUsedAt ? ` · used ${formatDistanceToNow(new Date(agent.lastUsedAt), { addSuffix: true })}` : ' · not used yet'}
              </div>
            </div>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(
                  guardAction(async () => {
                    const res = await revokeCliTokenAction({ tokenId: agent.id })
                    if (!res.ok) toast.error(res.error)
                    else toast.success('Disconnected', { description: `${agent.clientLabel} on ${agent.name} can no longer read your business.` })
                    router.refresh()
                  }),
                )
              }
              className="text-muted-foreground hover:text-destructive h-8 flex-none rounded-md px-2.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              Disconnect
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
