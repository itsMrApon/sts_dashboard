'use client'

import Link from 'next/link'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useWorkspaceWizard } from '../WorkspaceWizardContext'

export function MessagesStep() {
  const { draft, patchDraft, agents } = useWorkspaceWizard()
  const selected = new Set(draft.messages.agentIds)

  const toggle = (id: string) => {
    const next = selected.has(id)
      ? draft.messages.agentIds.filter((x) => x !== id)
      : [...draft.messages.agentIds, id]
    patchDraft({ messages: { agentIds: next } })
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Room attaches to workspace{' '}
        <span className="font-medium text-foreground">{draft.workspaceName || '…'}</span> by default.
        No separate room name — configure channels after create.
      </p>

      {agents.length === 0 ? (
        <p className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          No AI agents yet. Create one in{' '}
          <Link href="/ai-agents" className="font-medium text-primary underline">
            AI Agents
          </Link>{' '}
          first, then return here.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {agents.map((agent) => {
            const on = selected.has(agent.id)
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => toggle(agent.id)}
                className={cn(
                  'flex items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors',
                  on ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted/50',
                )}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">
                    {agent.roomName}
                  </p>
                </div>
                {on ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
