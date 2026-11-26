'use client'

import { Check, Copy } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/toast'
import { AGENT_CLIENT_LABEL, stsInitCommand } from '@/lib/social/library/buildPrompt'
import type { AgentClient } from '@/lib/social/library/types'
import { copyText, useAgentClient } from '@/app/(protectedRoutes)/social/_lib/useSocialPrefs'
import { ConnectedAgents, type ConnectedAgent } from './ConnectedAgents'

/**
 * Step one for every card: the sts-ai CLI connects the creator's own agent to their business brain.
 * The agent picked here is the one every copied prompt is written for.
 */
export function CliCommand({ className, agents = [] }: { className?: string; agents?: ConnectedAgent[] }) {
  const [client, setClient] = useAgentClient()
  const [copied, setCopied] = useState(false)
  const command = stsInitCommand(client)

  return (
    <section className={cn('w-full rounded-xl border border-border', className)} aria-labelledby="sts-cli-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5">
        <div>
          <h2 id="sts-cli-heading" className="text-sm font-medium">
            Connect your AI agent once
          </h2>
          <p className="text-muted-foreground text-xs">It gets your business brain; every prompt here starts from it.</p>
        </div>
        <div role="radiogroup" aria-label="Your agent" className="bg-muted inline-flex rounded-md p-0.5">
          {(Object.keys(AGENT_CLIENT_LABEL) as AgentClient[]).map((key) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={client === key}
              onClick={() => setClient(key)}
              className={cn(
                'h-7 rounded px-2.5 text-xs font-medium transition-colors',
                client === key ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {AGENT_CLIENT_LABEL[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="m-3 flex items-center gap-2 rounded-lg bg-zinc-950 py-1.5 pr-1.5 pl-3 text-zinc-100 dark:bg-black/60">
        <span className="text-zinc-500 select-none" aria-hidden>
          $
        </span>
        <code className="min-w-0 flex-1 overflow-x-auto font-mono text-[12.5px] whitespace-nowrap">{command}</code>
        <button
          type="button"
          aria-label="Copy command"
          onClick={async () => {
            if (await copyText(command)) {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            } else toast.error('Couldn’t copy. Select the command and copy it by hand.')
          }}
          className="inline-flex size-8 flex-none items-center justify-center rounded-md text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
      <ConnectedAgents agents={agents} />
    </section>
  )
}
