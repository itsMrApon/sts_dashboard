'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkle } from 'lucide-react'
import { toast } from 'sonner'
import { setBusinessAgent } from '@/actions/business'

/** Which /ai-agents agent powers Chat AI, Speak AI, Form and Wizard. */
export function BusinessAgentPicker({
  agents,
  currentAgentId,
}: {
  agents: { id: string; name: string }[]
  currentAgentId: string
}) {
  const router = useRouter()
  const [value, setValue] = useState(currentAgentId)
  const [isPending, startTransition] = useTransition()

  const change = (agentId: string) => {
    setValue(agentId)
    startTransition(async () => {
      const result = await setBusinessAgent(agentId)
      if (!result.ok) {
        toast.error(result.error)
        setValue(currentAgentId)
        return
      }
      toast.success('All services now use this agent')
      router.refresh()
    })
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2 text-xs text-muted-foreground">
      <Sparkle className="h-3.5 w-3.5 text-primary" aria-hidden />
      <label htmlFor="business-agent">Powered by</label>
      <select
        id="business-agent"
        value={value}
        disabled={isPending}
        onChange={(event) => change(event.target.value)}
        className="h-8 max-w-[220px] rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
      >
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            {agent.name}
          </option>
        ))}
      </select>
      {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
      <Link href="/ai-agents" className="text-primary underline-offset-4 hover:underline">
        Edit in AI Agents
      </Link>
    </div>
  )
}
